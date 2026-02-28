// ============================================================
// Isomorph DSL — Abstract Syntax Tree (AST) Type Definitions
// ============================================================

export type Span = { start: number; end: number; line: number; col: number };

/** Root node produced by the parser. */
export interface Program {
  kind: 'Program';
  imports: ImportDecl[];
  diagrams: DiagramDecl[];
  span: Span;
}

export interface ImportDecl {
  kind: 'ImportDecl';
  path: string;
  span: Span;
}

// ─── Diagram ────────────────────────────────────────────────

export type DiagramKind =
  | 'class'
  | 'usecase'
  | 'sequence'
  | 'component'
  | 'flow'
  | 'deployment';

export interface DiagramDecl {
  kind: 'DiagramDecl';
  name: string;
  diagramKind: DiagramKind;
  body: BodyItem[];
  span: Span;
}

export type BodyItem =
  | PackageDecl
  | EntityDecl
  | RelationDecl
  | NoteDecl
  | StyleDecl
  | LayoutAnnotation;

// ─── Package ─────────────────────────────────────────────────

export interface PackageDecl {
  kind: 'PackageDecl';
  name: string;
  body: BodyItem[];
  span: Span;
}

// ─── Entity ──────────────────────────────────────────────────

export type EntityKind =
  | 'class'
  | 'interface'
  | 'enum'
  | 'actor'
  | 'usecase'
  | 'component'
  | 'node';

export type Modifier = 'abstract' | 'static' | 'final';
export type Visibility = '+' | '-' | '#' | '~' | '';

export interface EntityDecl {
  kind: 'EntityDecl';
  modifiers: Modifier[];
  entityKind: EntityKind;
  name: string;
  stereotype?: string;
  extendsClause: string[];
  implementsClause: string[];
  members: Member[];
  span: Span;
}

// ─── Members ─────────────────────────────────────────────────

export type Member = FieldDecl | MethodDecl | EnumValueDecl;

export interface FieldDecl {
  kind: 'FieldDecl';
  visibility: Visibility;
  modifiers: Modifier[];
  name: string;
  type: TypeExpr;
  defaultValue?: LiteralExpr;
  span: Span;
}

export interface MethodDecl {
  kind: 'MethodDecl';
  visibility: Visibility;
  modifiers: Modifier[];
  name: string;
  params: ParamDecl[];
  returnType: TypeExpr;
  span: Span;
}

export interface ParamDecl {
  name: string;
  type: TypeExpr;
}

export interface EnumValueDecl {
  kind: 'EnumValueDecl';
  name: string;
  span: Span;
}

// ─── Types ───────────────────────────────────────────────────

/** List<T>/Map<K,V>/... shorthand syntax is desugared by the parser into GenericType. */
export type TypeExpr = SimpleType | GenericType | NullableType;

export interface SimpleType {
  kind: 'SimpleType';
  name: string;
  span: Span;
}

export interface GenericType {
  kind: 'GenericType';
  base: string;
  args: TypeExpr[];
  span: Span;
}

export interface NullableType {
  kind: 'NullableType';
  inner: TypeExpr;
  span: Span;
}

// ─── Relations ───────────────────────────────────────────────

export type RelationKind =
  | '--'    // association
  | '-->'   // directed association
  | '--|>'  // inheritance
  | '..|>'  // realization
  | '--o'   // aggregation
  | '--*'   // composition
  | '--x'   // restriction
  | '..>'   // dependency
  | '<|--'  // inheritance (reversed)
  | '<|..'  // realization (reversed)
  | '<..'   // dependency (reversed)
  | 'o--'   // aggregation (reversed)
  | '*--';  // composition (reversed)

export interface RelationDecl {
  kind: 'RelationDecl';
  from: string;
  relKind: RelationKind;
  to: string;
  label?: string;
  fromMult?: string;
  toMult?: string;
  style?: Record<string, string>;
  span: Span;
}

// ─── Notes / Style / Layout ──────────────────────────────────

export interface NoteDecl {
  kind: 'NoteDecl';
  text: string;
  on?: string;
  span: Span;
}

export interface StyleDecl {
  kind: 'StyleDecl';
  target: string;
  styles: Record<string, string>;
  span: Span;
}

/** @Entity at (x, y) — layout persistence annotation */
export interface LayoutAnnotation {
  kind: 'LayoutAnnotation';
  entity: string;
  x: number;
  y: number;
  span: Span;
}

// ─── Literals ────────────────────────────────────────────────

export interface LiteralExpr {
  kind: 'Literal';
  value: string | number | boolean;
  span: Span;
}
