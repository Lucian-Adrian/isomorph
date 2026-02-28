// ============================================================
// Isomorph DSL — Lexer (Tokenizer)
// ============================================================
// Hand-crafted lexer for the Isomorph DSL.
// Produces a flat array of tokens from source text.
// ============================================================

export type TokenKind =
  // Literals
  | 'STRING'   | 'NUMBER'   | 'IDENT'    | 'COLOR'
  // Keywords
  | 'diagram'  | 'class'    | 'interface'| 'enum'
  | 'abstract' | 'package'  | 'import'   | 'note'
  | 'style'    | 'on'       | 'extends'  | 'implements'
  | 'at'       | 'static'   | 'final'    | 'void'
  | 'for'      | 'actor'    | 'usecase'  | 'component'
  | 'node'     | 'sequence' | 'flow'     | 'deployment'
  | 'list'     | 'map'      | 'set'      | 'optional'
  | 'int'      | 'float'    | 'bool'     | 'string_t'
  // Relation operators (longest-match-first in lexer)
  | 'INHERIT'    // --|>
  | 'REALIZE'    // ..|>
  | 'INHERIT_R'  // <|--
  | 'REALIZE_R'  // <|..
  | 'DEPEND_R'   // <..
  | 'AGGR_R'     // o--
  | 'COMPOSE_R'  // *--
  | 'ASSOC_DIR'  // -->
  | 'DEPEND'     // ..>
  | 'AGGR'       // --o
  | 'COMPOSE'    // --*
  | 'RESTR'      // --x
  | 'ASSOC'      // --
  | 'STEREO_O'   // <<
  | 'STEREO_C'   // >>
  | 'DOTDOT'     // ..
  // Punctuation
  | 'LBRACE' | 'RBRACE' | 'LPAREN' | 'RPAREN'
  | 'LBRACKET' | 'RBRACKET' | 'COMMA' | 'COLON'
  | 'SEMI' | 'DOT' | 'AT' | 'EQ' | 'PIPE'
  | 'PLUS' | 'MINUS' | 'HASH' | 'TILDE'
  | 'LT' | 'GT'
  // Meta
  | 'EOF' | 'UNKNOWN';

const KEYWORDS = new Set<string>([
  'diagram','class','interface','enum','abstract','package','import',
  'note','style','on','extends','implements','at','static','final',
  'void','for','actor','usecase','component','node','sequence',
  'flow','deployment','list','map','set','optional','int','float',
  'bool','string',
]);

const KEYWORD_MAP: Record<string, TokenKind> = {
  string: 'string_t',
};

export interface Token {
  kind: TokenKind;
  value: string;
  start: number;
  end: number;
  line: number;
  col: number;
}

export interface LexError {
  message: string;
  line: number;
  col: number;
  pos: number;
}

export interface LexResult {
  tokens: Token[];
  errors: LexError[];
}

// ─── Lexer ───────────────────────────────────────────────────

export function lex(source: string): LexResult {
  const tokens: Token[] = [];
  const errors: LexError[] = [];
  let pos = 0;
  let line = 1;
  let lineStart = 0;

  function col() { return pos - lineStart + 1; }

  function peek(offset = 0) { return source[pos + offset] ?? ''; }
  function advance(n = 1) { pos += n; }

  function makeToken(kind: TokenKind, value: string, start: number, startLine: number, startCol: number): Token {
    return { kind, value, start, end: pos, line: startLine, col: startCol };
  }

  function skipWhitespaceAndComments() {
    while (pos < source.length) {
      const c = source[pos];
      // Whitespace
      if (c === '\n') { line++; lineStart = pos + 1; advance(); continue; }
      if (c === '\r') { advance(); continue; }
      if (c === ' ' || c === '\t') { advance(); continue; }
      // Line comment
      if (c === '/' && peek(1) === '/') {
        while (pos < source.length && source[pos] !== '\n') advance();
        continue;
      }
      // Block comment
      if (c === '/' && peek(1) === '*') {
        advance(2);
        while (pos < source.length) {
          if (source[pos] === '\n') { line++; lineStart = pos + 1; }
          if (source[pos] === '*' && peek(1) === '/') { advance(2); break; }
          advance();
        }
        continue;
      }
      break;
    }
  }

  function readString(startLine: number, startCol: number, start: number): Token {
    advance(); // consume opening "
    let value = '';
    while (pos < source.length && source[pos] !== '"') {
      if (source[pos] === '\\') {
        advance();
        switch (source[pos]) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          default:  value += source[pos];
        }
      } else {
        value += source[pos];
      }
      advance();
    }
    if (pos < source.length) advance(); // consume closing "
    return makeToken('STRING', value, start, startLine, startCol);
  }

  function readNumber(startLine: number, startCol: number, start: number): Token {
    let value = '';
    while (pos < source.length && /[0-9.]/.test(source[pos])) {
      value += source[pos];
      advance();
    }
    return makeToken('NUMBER', value, start, startLine, startCol);
  }

  function readIdent(startLine: number, startCol: number, start: number): Token {
    let value = '';
    while (pos < source.length && /[a-zA-Z0-9_]/.test(source[pos])) {
      value += source[pos];
      advance();
    }
    if (KEYWORDS.has(value)) {
      const kind = (KEYWORD_MAP[value] ?? value) as TokenKind;
      return makeToken(kind, value, start, startLine, startCol);
    }
    return makeToken('IDENT', value, start, startLine, startCol);
  }

  function readColor(startLine: number, startCol: number, start: number): Token {
    // Peek ahead — if exactly 6 hex chars follow '#', it's a COLOR token
    let i = 0;
    while (i < 6 && /[0-9a-fA-F]/.test(peek(1 + i))) i++;
    if (i === 6) {
      const value = '#' + source.slice(pos + 1, pos + 7);
      advance(7);
      return makeToken('COLOR', value, start, startLine, startCol);
    }
    // Otherwise it's the visibility '#' operator
    advance();
    return makeToken('HASH', '#', start, startLine, startCol);
  }

  while (pos < source.length) {
    skipWhitespaceAndComments();
    if (pos >= source.length) break;

    const start = pos;
    const c = source[pos];
    const startLine = line;
    const startCol = col();

    // ----- String literal -----
    if (c === '"') { tokens.push(readString(startLine, startCol, start)); continue; }

    // ----- Number -----
    if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(peek(1)))) {
      tokens.push(readNumber(startLine, startCol, start)); continue;
    }

    // ----- Special: o-- aggregation operator (starts with letter, must check before ident) -----
    if (c === 'o' && source.slice(pos, pos + 3) === 'o--') {
      advance(3);
      tokens.push(makeToken('AGGR_R', 'o--', start, startLine, startCol));
      continue;
    }

    // ----- Identifier / keyword -----
    if (/[a-zA-Z_]/.test(c)) { tokens.push(readIdent(startLine, startCol, start)); continue; }

    // ----- Relation operators (longest match first) -----
    const rest = source.slice(pos);

    if (rest.startsWith('--|>'))   { advance(4); tokens.push(makeToken('INHERIT',   '--|>',  start, startLine, startCol)); continue; }
    if (rest.startsWith('..|>'))   { advance(4); tokens.push(makeToken('REALIZE',   '..|>',  start, startLine, startCol)); continue; }
    if (rest.startsWith('<|--'))   { advance(4); tokens.push(makeToken('INHERIT_R', '<|--',  start, startLine, startCol)); continue; }
    if (rest.startsWith('<|..'))   { advance(4); tokens.push(makeToken('REALIZE_R', '<|..',  start, startLine, startCol)); continue; }
    if (rest.startsWith('<..'))    { advance(3); tokens.push(makeToken('DEPEND_R',  '<..',   start, startLine, startCol)); continue; }
    if (rest.startsWith('o--'))    { advance(3); tokens.push(makeToken('AGGR_R',    'o--',   start, startLine, startCol)); continue; }
    if (rest.startsWith('*--'))    { advance(3); tokens.push(makeToken('COMPOSE_R', '*--',   start, startLine, startCol)); continue; }
    if (rest.startsWith('-->'))    { advance(3); tokens.push(makeToken('ASSOC_DIR', '-->',   start, startLine, startCol)); continue; }
    if (rest.startsWith('..>'))    { advance(3); tokens.push(makeToken('DEPEND',    '..>',   start, startLine, startCol)); continue; }
    if (rest.startsWith('--o'))    { advance(3); tokens.push(makeToken('AGGR',      '--o',   start, startLine, startCol)); continue; }
    if (rest.startsWith('--*'))    { advance(3); tokens.push(makeToken('COMPOSE',   '--*',   start, startLine, startCol)); continue; }
    if (rest.startsWith('--x'))    { advance(3); tokens.push(makeToken('RESTR',     '--x',   start, startLine, startCol)); continue; }
    if (rest.startsWith('--'))     { advance(2); tokens.push(makeToken('ASSOC',     '--',    start, startLine, startCol)); continue; }
    if (rest.startsWith('<<'))     { advance(2); tokens.push(makeToken('STEREO_O',  '<<',    start, startLine, startCol)); continue; }
    if (rest.startsWith('>>'))     { advance(2); tokens.push(makeToken('STEREO_C',  '>>',    start, startLine, startCol)); continue; }
    if (rest.startsWith('..'))     { advance(2); tokens.push(makeToken('DOTDOT',    '..',    start, startLine, startCol)); continue; }

    // ----- Single-character tokens -----
    switch (c) {
      case '{': advance(); tokens.push(makeToken('LBRACE',   '{', start, startLine, startCol)); break;
      case '}': advance(); tokens.push(makeToken('RBRACE',   '}', start, startLine, startCol)); break;
      case '(': advance(); tokens.push(makeToken('LPAREN',   '(', start, startLine, startCol)); break;
      case ')': advance(); tokens.push(makeToken('RPAREN',   ')', start, startLine, startCol)); break;
      case '[': advance(); tokens.push(makeToken('LBRACKET', '[', start, startLine, startCol)); break;
      case ']': advance(); tokens.push(makeToken('RBRACKET', ']', start, startLine, startCol)); break;
      case ',': advance(); tokens.push(makeToken('COMMA',    ',', start, startLine, startCol)); break;
      case ':': advance(); tokens.push(makeToken('COLON',    ':', start, startLine, startCol)); break;
      case ';': advance(); tokens.push(makeToken('SEMI',     ';', start, startLine, startCol)); break;
      case '.': advance(); tokens.push(makeToken('DOT',      '.', start, startLine, startCol)); break;
      case '@': advance(); tokens.push(makeToken('AT',       '@', start, startLine, startCol)); break;
      case '=': advance(); tokens.push(makeToken('EQ',       '=', start, startLine, startCol)); break;
      case '|': advance(); tokens.push(makeToken('PIPE',     '|', start, startLine, startCol)); break;
      case '+': advance(); tokens.push(makeToken('PLUS',     '+', start, startLine, startCol)); break;
      case '-': advance(); tokens.push(makeToken('MINUS',    '-', start, startLine, startCol)); break;
      case '#': tokens.push(readColor(startLine, startCol, start)); break;
      case '~': advance(); tokens.push(makeToken('TILDE',    '~', start, startLine, startCol)); break;
      case '<': advance(); tokens.push(makeToken('LT',       '<', start, startLine, startCol)); break;
      case '>': advance(); tokens.push(makeToken('GT',       '>', start, startLine, startCol)); break;
      default:
        errors.push({ message: `Unexpected character '${c}'`, line: startLine, col: startCol, pos });
        advance();
    }
  }

  tokens.push({ kind: 'EOF', value: '', start: pos, end: pos, line, col: col() });
  return { tokens, errors };
}
