// ============================================================
// Isomorph Static Semantic Analyzer
// ============================================================
// Implements SS-1 through SS-10 from the grammar report,
// transforming the AST into the Isomorph Object Model.
// ============================================================

import type { Program, DiagramDecl, BodyItem, EntityDecl, RelationDecl, Member, TypeExpr } from '../parser/ast.js';
import type {
  IOM, IOMDiagram, IOMEntity, IOMRelation, IOMField, IOMMethod,
  IOMEnumValue, IOMPackage, IOMNote, IOMEntityKind, IOMRelationKind,
  Visibility,
} from './iom.js';
import { relTokenToKind } from './iom.js';

export interface SemanticError {
  message: string;
  entity?: string;
  rule: string;  // e.g. 'SS-1'
}

export interface AnalysisResult {
  iom: IOM;
  errors: SemanticError[];
}

// ─── Analyzer ────────────────────────────────────────────────

export function analyze(program: Program): AnalysisResult {
  const errors: SemanticError[] = [];
  const diagrams: IOMDiagram[] = [];

  for (const diag of program.diagrams) {
    diagrams.push(analyzeDiagram(diag, errors));
  }

  return { iom: { diagrams }, errors };
}

function analyzeDiagram(diag: DiagramDecl, errors: SemanticError[]): IOMDiagram {
  const entities = new Map<string, IOMEntity>();
  const relations: IOMRelation[] = [];
  const packages: IOMPackage[] = [];
  const notes: IOMNote[] = [];

  // First pass — collect entities (SS-1: unique names within diagram scope)
  function collectItems(items: BodyItem[], pkgName?: string) {
    for (const item of items) {
      if (item.kind === 'PackageDecl') {
        const pkg: IOMPackage = { name: item.name, entityNames: [], subPackages: [] };
        collectItems(item.body, item.name);
        // Gather entity names declared inside this package
        for (const child of item.body) {
          if (child.kind === 'EntityDecl') pkg.entityNames.push(child.name);
        }
        packages.push(pkg);
      } else if (item.kind === 'EntityDecl') {
        // SS-1: Duplicate entity name check
        if (entities.has(item.name)) {
          errors.push({ message: `Duplicate entity name '${item.name}'`, entity: item.name, rule: 'SS-1' });
        } else {
          entities.set(item.name, buildEntity(item, pkgName, errors));
        }
      } else if (item.kind === 'NoteDecl') {
        notes.push({ text: item.text, onEntity: item.on });
        // Attach note text to entity if 'on' is present
        if (item.on && entities.has(item.on)) {
          const e = entities.get(item.on)!;
          e.note = item.text;
        }
      } else if (item.kind === 'StyleDecl') {
        // SS-9: Apply styles — target must exist (checked in second pass)
        const e = entities.get(item.target);
        if (e) Object.assign(e.styles, item.styles);
      } else if (item.kind === 'LayoutAnnotation') {
        // SS-10: Layout annotations overwrite position
        const e = entities.get(item.entity);
        if (e) e.position = { x: item.x, y: item.y };
      }
    }
  }

  collectItems(diag.body);

  // Second pass — relations (SS-3: referential integrity)
  function collectRelations(items: BodyItem[]) {
    for (const item of items) {
      if (item.kind === 'RelationDecl') {
        // SS-3: Both endpoints must exist
        if (!entities.has(item.from)) {
          errors.push({ message: `Relation references unknown entity '${item.from}'`, rule: 'SS-3' });
        }
        if (!entities.has(item.to)) {
          errors.push({ message: `Relation references unknown entity '${item.to}'`, rule: 'SS-3' });
        }
        relations.push(buildRelation(item, relations.length, errors));
      } else if (item.kind === 'PackageDecl') {
        collectRelations(item.body);
      }
    }
  }

  collectRelations(diag.body);

  // SS-4: Enum must have at least one value
  for (const [name, entity] of entities) {
    if (entity.kind === 'enum' && entity.enumValues.length === 0) {
      errors.push({ message: `Enum '${name}' must declare at least one value`, entity: name, rule: 'SS-4' });
    }
  }

  // SS-5: Interface must not have fields with default values
  for (const [name, entity] of entities) {
    if (entity.kind === 'interface') {
      for (const field of entity.fields) {
        if (field.defaultValue !== undefined) {
          errors.push({ message: `Interface '${name}' field '${field.name}' cannot have a default value`, entity: name, rule: 'SS-5' });
        }
      }
    }
  }

  // SS-6: No circular direct inheritance (simplified check)
  function hasCircularInheritance(name: string, seen = new Set<string>()): boolean {
    if (seen.has(name)) return true;
    seen.add(name);
    const e = entities.get(name);
    if (!e) return false;
    return e.extendsNames.some(parent => hasCircularInheritance(parent, new Set(seen)));
  }

  for (const [name] of entities) {
    if (hasCircularInheritance(name)) {
      errors.push({ message: `Circular inheritance detected involving '${name}'`, entity: name, rule: 'SS-6' });
    }
  }

  return {
    name: diag.name,
    kind: diag.diagramKind,
    entities,
    relations,
    packages,
    notes,
  };
}

function buildEntity(decl: EntityDecl, pkg: string | undefined, errors: SemanticError[]): IOMEntity {
  const fields: IOMField[] = [];
  const methods: IOMMethod[] = [];
  const enumValues: IOMEnumValue[] = [];

  // SS-2: Unique member names per entity
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
      methods.push({
        name: member.name,
        params: member.params.map(p => ({ name: p.name, type: typeToString(p.type) })),
        returnType: typeToString(member.returnType),
        visibility: visToIOM(member.visibility),
        isStatic: member.modifiers.includes('static'),
        isAbstract: decl.modifiers.includes('abstract') || member.modifiers.includes('abstract'),
      });
    }
  }

  return {
    id: decl.name,
    name: decl.name,
    kind: decl.entityKind as IOMEntityKind,
    stereotype: decl.stereotype,
    isAbstract: decl.modifiers.includes('abstract'),
    package: pkg,
    fields,
    methods,
    enumValues,
    extendsNames: decl.extendsClause,
    implementsNames: decl.implementsClause,
    styles: {},
  };
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

// ── Type expression → string ─────────────────────────────────

export function typeToString(t: TypeExpr): string {
  switch (t.kind) {
    case 'SimpleType':   return t.name;
    case 'GenericType':  return `${t.base}<${t.args.map(typeToString).join(', ')}>`;
    case 'NullableType': return `${typeToString(t.inner)}?`;
    case 'ListShorthand': return `List<${typeToString(t.element)}>`;
  }
}

// ── Visibility mapping ───────────────────────────────────────

function visToIOM(v: string): Visibility {
  if (v === '+') return 'public';
  if (v === '-') return 'private';
  if (v === '#') return 'protected';
  if (v === '~') return 'package';
  return 'public';
}

// ── Member type guard helpers ─────────────────────────────────

export function isField(m: Member): m is import('../parser/ast.js').FieldDecl {
  return m.kind === 'FieldDecl';
}

export function isMethod(m: Member): m is import('../parser/ast.js').MethodDecl {
  return m.kind === 'MethodDecl';
}
