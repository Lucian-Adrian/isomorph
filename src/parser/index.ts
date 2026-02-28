// Public parse() API
export { lex } from './lexer.js';
export type { Token, TokenKind, LexResult, LexError } from './lexer.js';
export { Parser } from './parser.js';
export type { ParseResult, ParseError } from './parser.js';
export type * from './ast.js';

import { lex } from './lexer.js';
import { Parser } from './parser.js';
import type { ParseResult } from './parser.js';

/**
 * Parse an Isomorph DSL source string into an AST.
 * Returns the AST program node and any parse/lex errors.
 */
export function parse(source: string): ParseResult {
  const { tokens, errors: lexErrors } = lex(source);
  const parser = new Parser(tokens);
  const result = parser.parse();
  return {
    program: result.program,
    errors: [
      ...lexErrors.map(e => ({ ...e })),
      ...result.errors,
    ],
  };
}
