// ============================================================
// Isomorph Static Semantic Analyzer
// ============================================================
// Implements SS-1 through SS-14 from the grammar report,
// transforming the AST into the Isomorph Object Model.
// ============================================================

import type { Program, DiagramDecl, BodyItem, EntityDecl, RelationDecl, Member, TypeExpr, ConfigDecl } from '../parser/ast.js';
import type {
  IOM, IOMDiagram, IOMEntity, IOMRelation, IOMField, IOMMethod,
  IOMEnumValue, IOMPackage, IOMNote, IOMEntityKind, IOMRelationKind,
  Visibility, IOMConfig, IOMFragment, IOMActivation, IOMPartition
} from './iom.js';
import { relTokenToKind } from './iom.js';

export interface SemanticError {
  message: string;
  rule: string;
  line?: number;
  col?: number;
  entity?: string;
}

export interface AnalysisResult {
  iom: IOM;
  errors: SemanticError[];
}

export function analyze(program: Program): AnalysisResult {
  const errors: SemanticError[] = [];
  const diagrams: IOMDiagram[] = [];

  for (const diag of program.diagrams) {
    diagrams.push(analyzeDiagram(diag, errors));
  }

  return { iom: { diagrams }, errors };
}

export function analyzeDiagram(diag: DiagramDecl, errors: SemanticError[]): IOMDiagram {
  const entities = new Map<string, IOMEntity>();
  const relations: IOMRelation[] = [];
  const packages:  IOMPackage[]  = [];
  const notes:     IOMNote[]     = [];
  const config:    IOMConfig     = {};
  const styles:    Record<string, string> = {};
  const fragments: IOMFragment[] = [];
  const activations: IOMActivation[] = [];
  const partitions: IOMPartition[] = [];

  // Tracks source location of each entity declaration for error reporting
  const entitySpans = new Map<string, { line: number; col: number }>();

  function collectItems(items: BodyItem[], pkgName?: string) {
    for (const item of items) {
      if (item.kind === 'PackageDecl') {
        const pkg: IOMPackage = { name: item.name, entityNames: [], subPackages: [] };
        collectItems(item.body, item.name);
        for (const child of item.body) {
          if (child.kind === 'EntityDecl') pkg.entityNames.push(child.name);
        }
        packages.push(pkg);
      } else if (item.kind === 'EntityDecl') {
        if (entities.has(item.name)) {
          errors.push({ message: `Duplicate entity name '${item.name}'`, entity: item.name, rule: 'SS-1', line: item.span.line, col: item.span.col });
        } else {
          entitySpans.set(item.name, { line: item.span.line, col: item.span.col });
          entities.set(item.name, buildEntity(item, pkgName, errors));
        }
        // Support nested entities in collectItems but buildEntity handles the hierarchy
      } else if (item.kind === 'NoteDecl') {
        notes.push({ text: item.text, onEntity: item.on });
        if (item.on && entities.has(item.on)) {
          const e = entities.get(item.on);
          if (e) e.note = item.text;
        }
      } else if (item.kind === 'ConfigDecl') {
        const cfg = item as ConfigDecl;
        if (cfg.key === 'strict') config.strict = true;
        else if (cfg.key === 'autonumber') config.autonumber = true;
        else if (cfg.key === 'autoactivation') config.autoactivation = true;
        else (config as any)[cfg.key] = cfg.value;
      }
    }
  }

  collectItems(diag.body);

  for (const item of diag.body) {
    if (item.kind === 'StyleDecl') {
      if (item.target === 'diagram') {
        Object.assign(styles, item.styles);
      } else {
        const e = entities.get(item.target);
        if (e) Object.assign(e.styles, item.styles);
        else {
          const kind = item.target as any;
          entities.forEach(entity => {
            if (entity.kind === kind) Object.assign(entity.styles, item.styles);
          });
        }
      }
    }
  }

  for (const note of notes) {
    if (note.onEntity) {
      const e = entities.get(note.onEntity);
      if (e && !e.note) e.note = note.text;
    }
  }

  function collectRelationsInner(items: BodyItem[]) {
    for (const item of items) {
      if (item.kind === 'RelationDecl') {
        if (!entities.has(item.from)) {
          errors.push({ message: `Relation references unknown entity '${item.from}'`, rule: 'SS-3', line: item.span.line, col: item.span.col });
        }
        if (!entities.has(item.to)) {
          errors.push({ message: `Relation references unknown entity '${item.to}'`, rule: 'SS-3', line: item.span.line, col: item.span.col });
        }
        relations.push(buildRelation(item, relations.length, errors));
      } else if (item.kind === 'PackageDecl') {
        collectRelationsInner(item.body);
      } else if (item.kind === 'FragmentDecl') {
        const startRelIdx = relations.length;
        collectRelationsInner(item.body);
        const endRelIdx = relations.length;
        const mainRelIds = relations.slice(startRelIdx, endRelIdx).map(r => r.id);

        const elseBlocks: { label?: string; relationIds: string[] }[] = [];
        if (item.elseBlocks) {
          for (const block of item.elseBlocks) {
            const sIdx = relations.length;
            collectRelationsInner(block.body);
            const eIdx = relations.length;
            elseBlocks.push({ label: block.label, relationIds: relations.slice(sIdx, eIdx).map(r => r.id) });
          }
        }

        fragments.push({
          id: `frag_${fragments.length + 1}`,
          kind: item.fragmentKind,
          label: item.label,
          relationIds: mainRelIds,
          elseBlocks: elseBlocks.length > 0 ? elseBlocks : undefined,
        });
      } else if (item.kind === 'ActivateDecl') {
        if (!entities.has(item.entity)) {
          errors.push({ message: `Activation references unknown entity '${item.entity}'`, rule: 'SS-17', line: item.span.line, col: item.span.col });
        }
        activations.push({ id: `act_${activations.length}`, entity: item.entity, kind: 'activate', afterRelationIdx: relations.length });
      } else if (item.kind === 'DeactivateDecl') {
        if (!entities.has(item.entity)) {
          errors.push({ message: `Deactivation references unknown entity '${item.entity}'`, rule: 'SS-17', line: item.span.line, col: item.span.col });
        }
        activations.push({ id: `act_${activations.length}`, entity: item.entity, kind: 'deactivate', afterRelationIdx: relations.length });
      } else if (item.kind === 'PartitionDecl') {
        const pContent = collectRegionItems(item.body);
        partitions.push({
          id: `part_${partitions.length}`,
          name: item.name,
          entityNames: pContent.entityNames,
          relationIds: pContent.relationIds,
        });
      } else if (item.kind === 'CreateDecl') {
        if (!entities.has(item.entity)) {
          errors.push({ message: `Create references unknown entity '${item.entity}'`, rule: 'SS-17', line: item.span.line, col: item.span.col });
        }
        activations.push({ id: `act_${activations.length}`, entity: item.entity, kind: 'create', afterRelationIdx: relations.length });
      } else if (item.kind === 'DestroyDecl') {
        if (!entities.has(item.entity)) {
          errors.push({ message: `Destroy references unknown entity '${item.entity}'`, rule: 'SS-17', line: item.span.line, col: item.span.col });
        }
        activations.push({ id: `act_${activations.length}`, entity: item.entity, kind: 'destroy', afterRelationIdx: relations.length });
      }
    }
  }

  collectRelationsInner(diag.body);

  // Third pass: Layout annotations (ensure partitions/entities/packages exist)
  function applyLayout(items: BodyItem[]) {
    for (const item of items) {
      if (item.kind === 'LayoutAnnotation') {
        const e = entities.get(item.entity);
        if (e) e.position = { x: item.x, y: item.y, w: item.w, h: item.h };
        else {
          const p = packages.find(pkg => pkg.name === item.entity);
          if (p) p.position = { x: item.x, y: item.y, w: item.w, h: item.h };
          else {
            const part = partitions.find(part => part.name === item.entity);
            if (part) part.position = { x: item.x, y: item.y, w: item.w, h: item.h };
          }
        }
      } else if (item.kind === 'PackageDecl') {
        applyLayout(item.body);
      }
    }
  }
  applyLayout(diag.body);

  // Validations
  for (const [name, entity] of entities) {
    if (entity.kind === 'enum' && entity.enumValues.length === 0) {
      const sp = entitySpans.get(name);
      errors.push({ message: `Enum '${name}' must declare at least one value`, entity: name, rule: 'SS-4', ...sp });
    }
    if (entity.kind === 'interface') {
      for (const field of entity.fields) {
        if (field.defaultValue !== undefined) {
          const sp = entitySpans.get(name);
          errors.push({ message: `Interface '${name}' field '${field.name}' cannot have a default value`, entity: name, rule: 'SS-5', ...sp });
        }
      }
    }
  }

  function hasCircularInheritance(name: string, seen = new Set<string>()): boolean {
    if (seen.has(name)) return true;
    seen.add(name);
    const e = entities.get(name);
    if (!e) return false;
    return e.extendsNames.some(parent => hasCircularInheritance(parent, new Set(seen)));
  }

  const reportedInCycle = new Set<string>();
  for (const [name] of entities) {
    if (reportedInCycle.has(name)) continue;
    if (hasCircularInheritance(name)) {
      const sp = entitySpans.get(name);
      errors.push({ message: `Circular inheritance detected involving '${name}'`, entity: name, rule: 'SS-6', ...sp });
      const e = entities.get(name);
      if (e) for (const p of e.extendsNames) reportedInCycle.add(p);
      reportedInCycle.add(name);
    }
  }

  function checkStyleTargets(items: BodyItem[]) {
    for (const item of items) {
      if (item.kind === 'StyleDecl' && !entities.has(item.target) && item.target !== 'diagram') {
          // Check if it's a kind
          const kinds = new Set(['class','interface','enum','actor','usecase','component','node','state']);
          if (!kinds.has(item.target)) {
            errors.push({ message: `Style references unknown entity '${item.target}'`, rule: 'SS-7', line: item.span.line, col: item.span.col });
          }
      }
      if (item.kind === 'PackageDecl') checkStyleTargets(item.body);
    }
  }
  checkStyleTargets(diag.body);

  for (const [name, entity] of entities) {
    if (entity.kind === 'enum') {
      const seen = new Set<string>();
      for (const v of entity.enumValues) {
        if (seen.has(v.name)) {
          const sp = entitySpans.get(name);
          errors.push({ message: `Duplicate enum value '${v.name}' in '${name}'`, entity: name, rule: 'SS-8', ...sp });
        }
        seen.add(v.name);
      }
    }
  }

  const ALLOWED_KINDS: Record<string, Set<string>> = {
    class:      new Set(['class', 'interface', 'enum']),
    usecase:    new Set(['actor', 'usecase', 'boundary', 'system']),
    sequence:   new Set(['actor', 'participant']),
    component:  new Set(['component', 'interface']),
    deployment: new Set(['component', 'node', 'device', 'artifact', 'environment']),
    activity:   new Set(['partition', 'decision', 'merge', 'fork', 'join', 'start', 'stop', 'action', 'state']),
    state:      new Set(['state', 'composite', 'concurrent', 'choice', 'history', 'start', 'stop', 'decision']),
    collaboration: new Set(['multiobject', 'active_object', 'collaboration', 'composite_object', 'actor', 'object'])
  };
  const allowed = ALLOWED_KINDS[diag.diagramKind];
  if (allowed) {
    for (const [name, entity] of entities) {
      if (!allowed.has(entity.kind)) {
        const sp = entitySpans.get(name);
        errors.push({ message: `Entity kind '${entity.kind}' is not valid in '${diag.diagramKind}' diagrams`, entity: name, rule: 'SS-9', ...sp });
      }
    }
  }

  function checkLayoutTargets(items: BodyItem[]) {
    for (const item of items) {
      if (
        item.kind === 'LayoutAnnotation'
        && !entities.has(item.entity)
        && !packages.some(p => p.name === item.entity)
        && !partitions.some(part => part.name === item.entity)
      ) {
        errors.push({ message: `Layout annotation references unknown entity or package '${item.entity}'`, rule: 'SS-10', line: item.span.line, col: item.span.col });
      }
      if (item.kind === 'PackageDecl') checkLayoutTargets(item.body);
    }
  }
  checkLayoutTargets(diag.body);

  if (diag.diagramKind === 'usecase' || diag.diagramKind === 'collaboration') {
    for (const [name, entity] of entities) {
      const sp = entitySpans.get(name);
      const startsWithVerb = /^(get|set|is|has|can|do|create|update|delete|process|manage|run|save|load|print|send|receive|calculate|authenticate|borrow|return|reserve|search|generate|find|check|verify|validate|main)/i.test(name);
      
      if (entity.kind === 'actor' || entity.kind === 'object' || entity.kind === 'multiobject' || entity.kind === 'active_object' || entity.kind === 'boundary' || entity.kind === 'system') {
        if (startsWithVerb) {
          errors.push({ message: `Naming Convention: '${entity.kind}' names should typically be Nouns, but '${name}' looks like a Verb.`, entity: name, rule: 'SS-15', ...sp });
        }
      } else if (entity.kind === 'usecase' || entity.kind === 'collaboration') {
        if (!startsWithVerb) {
          errors.push({ message: `Naming Convention: '${entity.kind}' names must be Verbs, but '${name}' does not start with a recognized verb.`, entity: name, rule: 'SS-15', ...sp });
        }
      }
    }
  }

  for (const [name] of entities) {
    const decl = findEntityDecl(diag.body, name);
    if (decl?.modifiers.includes('abstract') && decl.modifiers.includes('final')) {
      const sp = entitySpans.get(name);
      errors.push({ message: `Entity '${name}' cannot be both abstract and final`, entity: name, rule: 'SS-11', ...sp });
    }
  }

  for (const [name, entity] of entities) {
    for (const parent of entity.extendsNames) {
      if (!entities.has(parent)) {
        const sp = entitySpans.get(name);
        errors.push({ message: `Entity '${name}' extends unknown entity '${parent}'`, entity: name, rule: 'SS-13', ...sp });
      }
    }
    for (const iface of entity.implementsNames) {
      const target = entities.get(iface);
      if (target && target.kind !== 'interface') {
          errors.push({ message: `Entity '${name}' cannot implement '${iface}' (it is not an interface)`, entity: name, rule: 'SS-14' });
      } else if (!target) {
          const sp = entitySpans.get(name);
          errors.push({ message: `Entity '${name}' implements unknown entity '${iface}'`, entity: name, rule: 'SS-14', ...sp });
      }
    }
  }

  // SS-16: provides/requires relations only valid in component/deployment diagrams
  if (diag.diagramKind !== 'component' && diag.diagramKind !== 'deployment') {
    for (const rel of relations) {
      if (rel.kind === 'provides' || rel.kind === 'requires') {
        errors.push({ message: `'${rel.kind}' relation operator is only valid in component/deployment diagrams`, rule: 'SS-16' });
      }
    }
  }

  return {
    name: diag.name,
    kind: diag.diagramKind,
    entities,
    relations,
    packages,
    notes,
    config,
    styles,
    fragments,
    activations,
    partitions,
  };
}

function buildEntity(decl: EntityDecl, pkg: string | undefined, errors: SemanticError[]): IOMEntity {
  const fields: IOMField[] = [];
  const methods: IOMMethod[] = [];
  const enumValues: IOMEnumValue[] = [];
  const children: IOMEntity[] = [];
  const regions: { id: string, entityNames: string[], relationIds: string[] }[] = [];

  const memberNames = new Set<string>();

  for (const member of decl.members) {
    if (member.kind === 'EnumValueDecl') {
      enumValues.push({ name: member.name });
    } else if (member.kind === 'FieldDecl') {
      if (memberNames.has(member.name)) {
        errors.push({ message: `Duplicate member '${member.name}' in '${decl.name}'`, entity: decl.name, rule: 'SS-2' });
      }
      memberNames.add(member.name);
      fields.push({
        name: member.name,
        type: typeToString(member.type),
        visibility: visToIOM(member.visibility),
        isStatic: member.modifiers.includes('static'),
        isFinal: member.modifiers.includes('final'),
        defaultValue: member.defaultValue ? String(member.defaultValue.value) : undefined,
      });
    } else if (member.kind === 'MethodDecl') {
      if (memberNames.has(member.name)) {
        errors.push({ message: `Duplicate member '${member.name}' in '${decl.name}'`, entity: decl.name, rule: 'SS-2' });
      }
      memberNames.add(member.name);
      
      const paramNames = new Set<string>();
      for (const p of member.params) {
          if (paramNames.has(p.name)) {
              errors.push({ message: `Duplicate parameter '${p.name}' in method '${decl.name}.${member.name}'`, entity: decl.name, rule: 'SS-12', line: member.span.line, col: member.span.col });
          }
          paramNames.add(p.name);
      }

      methods.push({
        name: member.name,
        params: member.params.map(p => ({ name: p.name, type: typeToString(p.type) })),
        returnType: typeToString(member.returnType),
        visibility: visToIOM(member.visibility),
        isStatic: member.modifiers.includes('static'),
        isAbstract: decl.modifiers.includes('abstract') || member.modifiers.includes('abstract'),
      });
    } else if (member.kind === 'EntityDecl') {
      children.push(buildEntity(member, pkg, errors));
    } else if (member.kind === 'RegionDecl') {
      const regContent = collectRegionItems(member.body);
      regions.push({
        id: `reg_${regions.length}`,
        entityNames: regContent.entityNames,
        relationIds: regContent.relationIds,
      });
    }
  }

  return {
    id: decl.name,
    name: decl.name,
    kind: decl.entityKind as IOMEntityKind,
    stereotype: decl.stereotype,
    isAbstract: decl.modifiers.includes('abstract') || decl.entityKind === 'interface',
    package: pkg,
    children,
    regions,
    fields,
    methods,
    enumValues,
    extendsNames: decl.extendsClause,
    implementsNames: decl.implementsClause,
    styles: {},
  };
}

function collectRegionItems(body: BodyItem[]) {
  const entityNames: string[] = [];
  const relationIds: string[] = [];
  for (const item of body) {
    if (item.kind === 'EntityDecl') entityNames.push(item.name);
  }
  return { entityNames, relationIds };
}

function buildRelation(decl: RelationDecl, idx: number, _errors: SemanticError[]): IOMRelation {
  return {
    id: `rel_${idx}`,
    from: decl.from,
    to: decl.to,
    kind: relTokenToKind(decl.relKind) as IOMRelationKind,
    label: decl.label,
    fromMult: decl.fromMult,
    toMult: decl.toMult,
    styles: decl.style ?? {},
  };
}

export function typeToString(t: TypeExpr): string {
  switch (t.kind) {
    case 'SimpleType':   return t.name;
    case 'GenericType':  return `${t.base}<${t.args.map(typeToString).join(', ')}>`;
    case 'NullableType': return `${typeToString(t.inner)}?`;
  }
}

function visToIOM(v: string): Visibility {
  if (v === '+') return 'public';
  if (v === '-') return 'private';
  if (v === '#') return 'protected';
  if (v === '~') return 'package';
  return 'public';
}

export function isField(m: Member): m is import('../parser/ast.js').FieldDecl {
  return m.kind === 'FieldDecl';
}

export function isMethod(m: Member): m is import('../parser/ast.js').MethodDecl {
  return m.kind === 'MethodDecl';
}

function findEntityDecl(items: BodyItem[], name: string): EntityDecl | undefined {
  for (const item of items) {
    if (item.kind === 'EntityDecl' && item.name === name) return item;
    if (item.kind === 'PackageDecl') {
      const found = findEntityDecl(item.body, name);
      if (found) return found;
    }
  }
  return undefined;
}
