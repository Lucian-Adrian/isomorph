// ============================================================
// Isomorph DSL — Recursive Descent Parser (LL(1))
// ============================================================
// Implements all 55 BNF production rules from the grammar spec.
// ============================================================

import { Token, TokenKind } from './lexer.js';
import type {
  Program, ImportDecl, DiagramDecl, DiagramKind, BodyItem,
  PackageDecl, EntityDecl, EntityKind, Modifier, Member,
  FieldDecl, MethodDecl, EnumValueDecl, ParamDecl, TypeExpr,
  SimpleType, GenericType, NullableType, RelationDecl, RelationKind,
  NoteDecl, StyleDecl, LayoutAnnotation, LiteralExpr, Span, Visibility,
} from './ast.js';

export interface ParseError {
  message: string;
  line: number;
  col: number;
  pos: number;
}

export interface ParseResult {
  program: Program;
  errors: ParseError[];
}

// ─── Parser class ─────────────────────────────────────────────

export class Parser {
  private pos = 0;
  private errors: ParseError[] = [];

  constructor(private tokens: Token[]) {}

  // ── Primitives ──────────────────────────────────────────────

  private peek(offset = 0): Token {
    const idx = this.pos + offset;
    return this.tokens[idx] ?? this.tokens[this.tokens.length - 1];
  }

  private at(kind: TokenKind): boolean {
    return this.peek().kind === kind;
  }

  private atAny(...kinds: TokenKind[]): boolean {
    return kinds.includes(this.peek().kind);
  }

  private advance(): Token {
    const t = this.peek();
    if (t.kind !== 'EOF') this.pos++;
    return t;
  }

  private expect(kind: TokenKind): Token {
    const t = this.peek();
    if (t.kind !== kind) {
      this.errors.push({
        message: `Expected '${kind}' but got '${t.kind}' ('${t.value}')`,
        line: t.line, col: t.col, pos: t.start,
      });
      // Error recovery: return the invalid token but don't consume it
      return t;
    }
    return this.advance();
  }

  private spanFrom(t: Token): Span {
    return { start: t.start, end: t.end, line: t.line, col: t.col };
  }

  private spanTo(from: Token, to: Token): Span {
    return { start: from.start, end: to.end, line: from.line, col: from.col };
  }

  // ── Rule 1: program ─────────────────────────────────────────

  parse(): ParseResult {
    const first = this.peek();
    const imports = this.parseImportList();
    const diagrams = this.parseDiagramList();
    const span = this.spanTo(first, this.peek());
    return {
      program: { kind: 'Program', imports, diagrams, span },
      errors: this.errors,
    };
  }

  // ── Rule 2-3: import-list, import-decl ───────────────────────

  private parseImportList(): ImportDecl[] {
    const result: ImportDecl[] = [];
    while (this.at('import')) result.push(this.parseImportDecl());
    return result;
  }

  private parseImportDecl(): ImportDecl {
    const kw = this.expect('import');
    const path = this.expect('STRING').value;
    if (this.at('SEMI')) this.advance();
    return { kind: 'ImportDecl', path, span: this.spanFrom(kw) };
  }

  // ── Rule 4-5: diagram-list, diagram-decl ────────────────────

  private parseDiagramList(): DiagramDecl[] {
    const result: DiagramDecl[] = [];
    while (!this.at('EOF')) {
      if (this.at('diagram')) result.push(this.parseDiagramDecl());
      else { this.errors.push({ message: `Unexpected token '${this.peek().value}'`, ...this.currentPos() }); this.advance(); }
    }
    return result;
  }

  private parseDiagramDecl(): DiagramDecl {
    const kw = this.expect('diagram');
    const name = this.expect('IDENT').value;
    this.expect('COLON');
    const diagramKind = this.parseDiagramKind();
    this.expect('LBRACE');
    const body = this.parseDiagramBody();
    const close = this.expect('RBRACE');
    return { kind: 'DiagramDecl', name, diagramKind, body, span: this.spanTo(kw, close) };
  }

  // ── Rule 6: diagram-kind ────────────────────────────────────

  private parseDiagramKind(): DiagramKind {
    const t = this.peek();
    const kinds: Record<string, DiagramKind> = {
      class: 'class', usecase: 'usecase', sequence: 'sequence',
      component: 'component', flow: 'flow', deployment: 'deployment',
    };
    const kind = kinds[t.value];
    if (kind) { this.advance(); return kind; }
    this.errors.push({ message: `Unknown diagram kind '${t.value}'`, ...this.currentPos() });
    this.advance();
    return 'class';
  }

  // ── Rule 7-8: diagram-body, body-item ───────────────────────

  private parseDiagramBody(): BodyItem[] {
    const items: BodyItem[] = [];
    while (!this.at('RBRACE') && !this.at('EOF')) {
      const item = this.parseBodyItem();
      if (item) items.push(item);
    }
    return items;
  }

  private parseBodyItem(): BodyItem | null {
    const t = this.peek();

    // ── Layout annotation: @Name at (x, y) ──
    if (t.kind === 'AT') return this.parseLayoutAnnotation();

    // ── Package ──
    if (t.kind === 'package') return this.parsePackageDecl();

    // ── Note ──
    if (t.kind === 'note') return this.parseNoteDecl();

    // ── Style ──
    if (t.kind === 'style') return this.parseStyleDecl();

    // ── Entity (class/interface/enum/actor/usecase/component/node or with abstract modifier) ──
    if (this.isEntityStart()) return this.parseEntityDecl();

    // ── Relation (IDENT followed by a relation operator) ──
    if (t.kind === 'IDENT' && this.isRelationOperator(this.peek(1).kind)) return this.parseRelationDecl();

    // Unknown — skip with error
    this.errors.push({ message: `Unexpected token '${t.value}' in diagram body`, ...this.currentPos() });
    this.advance();
    return null;
  }

  private isEntityStart(): boolean {
    const k = this.peek().kind;
    if (k === 'abstract' || k === 'static' || k === 'final') return true;
    return ['class', 'interface', 'enum', 'actor', 'usecase', 'component', 'node'].includes(k);
  }

  private isRelationOperator(k: TokenKind): boolean {
    return ['ASSOC','ASSOC_DIR','INHERIT','REALIZE','AGGR','COMPOSE','RESTR',
            'DEPEND','INHERIT_R','REALIZE_R','DEPEND_R','AGGR_R','COMPOSE_R'].includes(k);
  }

  // ── Rule 9: package-decl ────────────────────────────────────

  private parsePackageDecl(): PackageDecl {
    const kw = this.expect('package');
    const name = this.expect('IDENT').value;
    this.expect('LBRACE');
    const body = this.parseDiagramBody();
    const close = this.expect('RBRACE');
    return { kind: 'PackageDecl', name, body, span: this.spanTo(kw, close) };
  }

  // ── Rules 10-19: entity-decl ────────────────────────────────

  private parseEntityDecl(): EntityDecl {
    const first = this.peek();
    const modifiers = this.parseModifierList();
    const entityKindToken = this.advance(); // consume the entity kind keyword
    const entityKind = entityKindToken.value as EntityKind;
    const name = this.expect('IDENT').value;

    // Optional stereotype: << IDENT >>
    let stereotype: string | undefined;
    if (this.at('STEREO_O')) {
      this.advance();
      stereotype = this.expect('IDENT').value;
      this.expect('STEREO_C');
    }

    // Optional extends / implements
    const extendsClause: string[] = [];
    const implementsClause: string[] = [];

    if (this.at('extends')) {
      this.advance();
      extendsClause.push(...this.parseIdentList());
      if (this.at('implements')) {
        this.advance();
        implementsClause.push(...this.parseIdentList());
      }
    } else if (this.at('implements')) {
      this.advance();
      implementsClause.push(...this.parseIdentList());
    }

    // Optional body
    const members: Member[] = [];
    let closeToken = this.peek();
    if (this.at('LBRACE')) {
      this.advance();
      while (!this.at('RBRACE') && !this.at('EOF')) {
        const m = this.parseMember(entityKind);
        if (m) members.push(m);
      }
      closeToken = this.expect('RBRACE');
    }

    return {
      kind: 'EntityDecl', modifiers, entityKind, name, stereotype,
      extendsClause, implementsClause, members,
      span: this.spanTo(first, closeToken),
    };
  }

  private parseModifierList(): Modifier[] {
    const mods: Modifier[] = [];
    while (this.atAny('abstract', 'static', 'final')) {
      mods.push(this.advance().value as Modifier);
    }
    return mods;
  }

  private parseIdentList(): string[] {
    const list: string[] = [];
    list.push(this.expect('IDENT').value);
    while (this.at('COMMA')) {
      this.advance();
      list.push(this.expect('IDENT').value);
    }
    return list;
  }

  // ── Rules 20-24: members ────────────────────────────────────

  private parseMember(entityKind: EntityKind): Member | null {
    // Separator line (just a semicolon)
    if (this.at('SEMI')) { this.advance(); return null; }

    // Enum values have no visibility/type prefix
    if (entityKind === 'enum' && this.at('IDENT') && !this.isVisibility(this.peek().kind)) {
      return this.parseEnumValue();
    }

    const vis = this.parseVisibility();
    const mods = this.parseMemberModifiers();

    const name = this.expect('IDENT').value;
    const nameStart = this.peek(-1);

    // Method: name ( ...
    if (this.at('LPAREN')) {
      return this.parseMethodRest(vis, mods, name, nameStart);
    }

    // Field: name : type
    return this.parseFieldRest(vis, mods, name, nameStart);
  }

  private isVisibility(k: TokenKind): boolean {
    return ['PLUS','MINUS','HASH','TILDE'].includes(k);
  }

  private parseVisibility(): Visibility {
    const k = this.peek().kind;
    if (k === 'PLUS')  { this.advance(); return '+'; }
    if (k === 'MINUS') { this.advance(); return '-'; }
    if (k === 'HASH')  { this.advance(); return '#'; }
    if (k === 'TILDE') { this.advance(); return '~'; }
    return '';
  }

  private parseMemberModifiers(): Modifier[] {
    const mods: Modifier[] = [];
    while (this.atAny('abstract', 'static', 'final')) {
      mods.push(this.advance().value as Modifier);
    }
    return mods;
  }

  private parseFieldRest(vis: Visibility, mods: Modifier[], name: string, _start: Token): FieldDecl {
    this.expect('COLON');
    const type = this.parseTypeExpr();
    let defaultValue: LiteralExpr | undefined;
    if (this.at('EQ')) {
      this.advance();
      defaultValue = this.parseLiteral();
    }
    if (this.at('SEMI')) this.advance();
    const span: Span = { start: _start.start, end: this.peek().end, line: _start.line, col: _start.col };
    return { kind: 'FieldDecl', visibility: vis, modifiers: mods, name, type, defaultValue, span };
  }

  private parseMethodRest(vis: Visibility, mods: Modifier[], name: string, _start: Token): MethodDecl {
    this.expect('LPAREN');
    const params = this.parseParamList();
    this.expect('RPAREN');
    this.expect('COLON');
    const returnType = this.parseTypeExpr();
    if (this.at('SEMI')) this.advance();
    const span: Span = { start: _start.start, end: this.peek().end, line: _start.line, col: _start.col };
    return { kind: 'MethodDecl', visibility: vis, modifiers: mods, name, params, returnType, span };
  }

  private parseParamList(): ParamDecl[] {
    const params: ParamDecl[] = [];
    if (this.at('RPAREN')) return params;
    params.push(this.parseParam());
    while (this.at('COMMA')) {
      this.advance();
      params.push(this.parseParam());
    }
    return params;
  }

  private parseParam(): ParamDecl {
    const name = this.expect('IDENT').value;
    this.expect('COLON');
    const type = this.parseTypeExpr();
    return { name, type };
  }

  private parseEnumValue(): EnumValueDecl {
    const t = this.expect('IDENT');
    if (this.at('SEMI')) this.advance();
    return { kind: 'EnumValueDecl', name: t.value, span: this.spanFrom(t) };
  }

  // ── Rules 25-30: type expressions ───────────────────────────

  private parseTypeExpr(): TypeExpr {
    const first = this.peek();
    let base: TypeExpr;

    // Generic shorthand: List<T>, Map<K,V>, Set<T>
    const genericBuiltins = new Set(['list','map','set','optional','List','Map','Set','Optional']);
    if ((this.at('IDENT') || this.atAny('list','map','set','optional')) && !genericBuiltins.has(this.peek().value)) {
      // Simple or generic named type
      const name = this.advance().value;
      if (this.at('LT')) {
        const args = this.parseTypeArgList();
        const span = this.spanTo(first, this.peek(-1));
        base = { kind: 'GenericType', base: name, args, span } satisfies GenericType;
      } else {
        base = { kind: 'SimpleType', name, span: this.spanFrom(first) } satisfies SimpleType;
      }
    } else if (this.atAny('list','map','set','optional','int','float','bool','string_t','void','IDENT')) {
      const name = this.advance().value;
      if (this.at('LT')) {
        const args = this.parseTypeArgList();
        const span = this.spanTo(first, this.peek(-1));
        base = { kind: 'GenericType', base: name, args, span } satisfies GenericType;
      } else {
        base = { kind: 'SimpleType', name, span: this.spanFrom(first) } satisfies SimpleType;
      }
    } else {
      // Fallback
      this.errors.push({ message: `Expected type expression`, ...this.currentPos() });
      base = { kind: 'SimpleType', name: 'any', span: this.spanFrom(first) };
    }

    // Nullable suffix: type?
    if (this.at('UNKNOWN') && this.peek().value === '?') {
      this.advance();
      const span = this.spanTo(first, this.peek(-1));
      return { kind: 'NullableType', inner: base, span } satisfies NullableType;
    }

    return base;
  }

  private parseTypeArgList(): TypeExpr[] {
    this.expect('LT');
    const args: TypeExpr[] = [];
    args.push(this.parseTypeExpr());
    while (this.at('COMMA')) {
      this.advance();
      args.push(this.parseTypeExpr());
    }
    this.expect('GT');
    return args;
  }

  // ── Rules 31-38: relations ──────────────────────────────────

  private parseRelationDecl(): RelationDecl {
    const fromToken = this.expect('IDENT');
    const from = fromToken.value;
    const relOp = this.advance();
    const relKind = this.tokenToRelKind(relOp.kind);
    const to = this.expect('IDENT').value;

    let label: string | undefined;
    let fromMult: string | undefined;
    let toMult: string | undefined;
    const style: Record<string, string> = {};

    // Optional attrs: [label="...", fromMult="...", toMult="...", color="#..."]
    if (this.at('LBRACKET')) {
      this.advance();
      while (!this.at('RBRACKET') && !this.at('EOF')) {
        const key = this.expect('IDENT').value;
        this.expect('EQ');
        const val = this.expect('STRING').value;
        if (key === 'label') label = val;
        else if (key === 'fromMult') fromMult = val;
        else if (key === 'toMult') toMult = val;
        else style[key] = val;
        if (this.at('COMMA')) this.advance();
      }
      this.expect('RBRACKET');
    }

    const span = this.spanTo(fromToken, this.peek(-1));
    return { kind: 'RelationDecl', from, relKind, to, label, fromMult, toMult, style, span };
  }

  private tokenToRelKind(k: TokenKind): RelationKind {
    const map: Partial<Record<TokenKind, RelationKind>> = {
      ASSOC: '--', ASSOC_DIR: '-->', INHERIT: '--|>', REALIZE: '..|>',
      AGGR: '--o', COMPOSE: '--*', RESTR: '--x', DEPEND: '..>',
      INHERIT_R: '<|--', REALIZE_R: '<|..', DEPEND_R: '<..', AGGR_R: 'o--', COMPOSE_R: '*--',
    };
    return map[k] ?? '--';
  }

  // ── Notes ────────────────────────────────────────────────────

  private parseNoteDecl(): NoteDecl {
    const kw = this.expect('note');
    const text = this.expect('STRING').value;
    let on: string | undefined;
    if (this.at('on')) {
      this.advance();
      on = this.expect('IDENT').value;
    }
    return { kind: 'NoteDecl', text, on, span: this.spanFrom(kw) };
  }

  // ── Style ────────────────────────────────────────────────────

  private parseStyleDecl(): StyleDecl {
    const kw = this.expect('style');
    const target = this.expect('IDENT').value;
    this.expect('LBRACE');
    const styles: Record<string, string> = {};
    while (!this.at('RBRACE') && !this.at('EOF')) {
      const key = this.expect('IDENT').value;
      this.expect('EQ');
      const val = this.at('COLOR') ? this.advance().value : this.expect('STRING').value;
      styles[key] = val;
      if (this.at('SEMI')) this.advance();
    }
    const close = this.expect('RBRACE');
    return { kind: 'StyleDecl', target, styles, span: this.spanTo(kw, close) };
  }

  // ── Layout annotation: @Name at (x, y) ──────────────────────

  private parseLayoutAnnotation(): LayoutAnnotation {
    const at = this.expect('AT');
    const entity = this.expect('IDENT').value;
    this.expect('at');
    this.expect('LPAREN');
    const x = parseFloat(this.expect('NUMBER').value);
    this.expect('COMMA');
    const y = parseFloat(this.expect('NUMBER').value);
    const close = this.expect('RPAREN');
    return { kind: 'LayoutAnnotation', entity, x, y, span: this.spanTo(at, close) };
  }

  // ── Literals ─────────────────────────────────────────────────

  private parseLiteral(): LiteralExpr {
    const t = this.peek();
    if (this.at('STRING')) {
      this.advance();
      return { kind: 'Literal', value: t.value, span: this.spanFrom(t) };
    }
    if (this.at('NUMBER')) {
      this.advance();
      return { kind: 'Literal', value: parseFloat(t.value), span: this.spanFrom(t) };
    }
    // bool
    if (t.value === 'true' || t.value === 'false') {
      this.advance();
      return { kind: 'Literal', value: t.value === 'true', span: this.spanFrom(t) };
    }
    this.errors.push({ message: `Expected literal value`, ...this.currentPos() });
    return { kind: 'Literal', value: '', span: this.spanFrom(t) };
  }

  // ── Helpers ──────────────────────────────────────────────────

  private currentPos() {
    const t = this.peek();
    return { line: t.line, col: t.col, pos: t.start };
  }
}
