// ============================================================
// ErrorFormatter — Converts raw errors into display strings (SRP)
// ============================================================
// Pure functions — no side effects, easily testable.
// ============================================================

import type { ParseError } from '../parser/index.js';
import type { SemanticError } from '../semantics/analyzer.js';

/** Format a single parse error for the error panel. */
export function formatParseError(e: ParseError): string {
  return `[${e.line}:${e.col}] ${e.message}`;
}

/** Format a single semantic error for the error panel. */
export function formatSemanticError(e: SemanticError): string {
  return e.line != null
    ? `[${e.line}:${e.col}] (${e.rule}) ${e.message}`
    : `(${e.rule}) ${e.message}`;
}

/** Format all errors (parse + semantic) into display strings. */
export function formatAllErrors(
  parseErrors: ParseError[],
  semanticErrors: SemanticError[],
): string[] {
  return [
    ...parseErrors.map(formatParseError),
    ...semanticErrors.map(formatSemanticError),
  ];
}
