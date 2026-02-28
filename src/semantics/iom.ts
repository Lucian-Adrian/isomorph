// ============================================================
// Isomorph Object Model (IOM)
// ============================================================
// The IOM is the semantic representation of a parsed Isomorph
// program. It is the output of semantic analysis and the input
// to the renderers and the bidirectional sync engine.
// ============================================================

/** Position in 2D canvas space */
export interface Position {
  x: number;
  y: number;
}

/** UML visibility levels */
export type Visibility = 'public' | 'protected' | 'private' | 'package';

export type IOMEntityKind =
  | 'class'
  | 'interface'
  | 'enum'
  | 'actor'
  | 'usecase'
  | 'component'
  | 'node';

/** Resolved field descriptor */
export interface IOMField {
  name: string;
  type: string;        // resolved type name string
  visibility: Visibility;
  isStatic: boolean;
  isFinal: boolean;
  defaultValue?: string;
}

/** Resolved method descriptor */
export interface IOMMethod {
  name: string;
  params: Array<{ name: string; type: string }>;
  returnType: string;
  visibility: Visibility;
  isStatic: boolean;
  isAbstract: boolean;
}

/** Resolved enum value */
export interface IOMEnumValue {
  name: string;
}

export type IOMMember = IOMField | IOMMethod | IOMEnumValue;

/** Resolved entity (class / interface / enum / actor / …) */
export interface IOMEntity {
  id: string;              // unique — same as name within diagram scope
  name: string;
  kind: IOMEntityKind;
  stereotype?: string;
  isAbstract: boolean;
  package?: string;
  fields: IOMField[];
  methods: IOMMethod[];
  enumValues: IOMEnumValue[];
  extendsNames: string[];
  implementsNames: string[];
  position?: Position;     // from @Entity at (x, y) annotations
  styles: Record<string, string>;
  note?: string;
}

export type IOMRelationKind =
  | 'association'
  | 'directed-association'
  | 'inheritance'
  | 'realization'
  | 'aggregation'
  | 'composition'
  | 'dependency'
  | 'restriction';

/** Resolved relation between two entities */
export interface IOMRelation {
  id: string;
  from: string;            // entity name
  to: string;              // entity name
  kind: IOMRelationKind;
  label?: string;
  fromMult?: string;
  toMult?: string;
  styles: Record<string, string>;
}

/** A diagram within the IOM */
export interface IOMDiagram {
  name: string;
  kind: 'class' | 'usecase' | 'sequence' | 'component' | 'flow' | 'deployment';
  entities: Map<string, IOMEntity>;
  relations: IOMRelation[];
  packages: IOMPackage[];
  notes: IOMNote[];
}

export interface IOMPackage {
  name: string;
  entityNames: string[];
  subPackages: IOMPackage[];
}

export interface IOMNote {
  text: string;
  onEntity?: string;
}

/** Root of the IOM — the whole program */
export interface IOM {
  diagrams: IOMDiagram[];
}

// ── Helpers ──────────────────────────────────────────────────

/** Canonical rendering of an IOMField to a type string */
export function renderType(type: string): string {
  return type;
}

/** Map AST relation kind token to IOM relation kind */
export function relTokenToKind(tok: string): IOMRelationKind {
  const map: Record<string, IOMRelationKind> = {
    '--':   'association',
    '-->':  'directed-association',
    '--|>': 'inheritance',
    '..|>': 'realization',
    '--o':  'aggregation',
    '--*':  'composition',
    '..>':  'dependency',
    '--x':  'restriction',
    '<|--': 'inheritance',
    '<|..': 'realization',
    '<..':  'dependency',
    'o--':  'aggregation',
    '*--':  'composition',
  };
  return map[tok] ?? 'association';
}
