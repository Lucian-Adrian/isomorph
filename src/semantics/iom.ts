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
  w?: number;
  h?: number;
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
  | 'node'
  | 'participant'
  | 'partition' | 'decision' | 'merge' | 'fork' | 'join' | 'start' | 'stop' | 'action'
  | 'state' | 'composite' | 'concurrent' | 'choice' | 'history'
  | 'device' | 'artifact' | 'environment'
  | 'boundary' | 'system' | 'multiobject' | 'active_object' | 'collaboration' | 'composite_object' | 'object';

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
  children: IOMEntity[];
  regions: { id: string, entityNames: string[], relationIds: string[] }[];
}

export type IOMRelationKind =
  | 'association'
  | 'directed-association'
  | 'inheritance'
  | 'realization'
  | 'aggregation'
  | 'composition'
  | 'dependency'
  | 'restriction'
  | 'provides'
  | 'requires';

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
  kind: 'class' | 'usecase' | 'sequence' | 'component' | 'flow' | 'deployment' | 'activity' | 'state' | 'collaboration';
  entities: Map<string, IOMEntity>;
  relations: IOMRelation[];
  packages: IOMPackage[];
  notes: IOMNote[];
  config: IOMConfig;
  styles: Record<string, string>;
  fragments: IOMFragment[];
  activations: IOMActivation[];
  partitions: IOMPartition[];
}

export interface IOMPartition {
  id: string;
  name: string;
  entityNames: string[];
  relationIds: string[];
  position?: Position;
}

export interface IOMActivation {
  id: string;
  entity: string;
  kind: 'activate' | 'deactivate' | 'create' | 'destroy';
  afterRelationIdx: number;
  source?: 'auto' | 'manual' | 'lifecycle';
}

export interface IOMFragment {
  id: string;
  kind: 'alt' | 'loop' | 'opt' | 'par' | 'break' | 'critical';
  label?: string;
  relationIds: string[];
  elseBlocks?: { label?: string; relationIds: string[] }[];
}

export interface IOMConfig {
  title?: string;
  subtitle?: string;
  caption?: string;
  legend?: string;
  direction?: string;
  strict?: boolean;
  autonumber?: boolean;
  autoactivation?: boolean;
}

export interface IOMPackage {
  name: string;
  entityNames: string[];
  position?: { x: number, y: number, w?: number, h?: number };
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


/** Map AST relation kind token to IOM relation kind */
export function relTokenToKind(tok: string): IOMRelationKind {
  const map: Record<string, IOMRelationKind> = {
    '--':   'association',
    '-->':  'directed-association',
    '->':   'directed-association',
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
    '--()': 'provides',
    '--(': 'requires',
  };
  return map[tok] ?? 'association';
}
