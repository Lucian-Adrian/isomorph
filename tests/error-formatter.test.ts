// ============================================================
// Error Formatter + Exporter Module Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { formatParseError, formatSemanticError, formatAllErrors } from '../src/utils/error-formatter.js';
import type { ParseError } from '../src/parser/index.js';
import type { SemanticError } from '../src/semantics/analyzer.js';

// ── Helpers ──────────────────────────────────────────────────

function pe(message: string, line: number, col: number): ParseError {
  return { message, line, col, pos: 0 };
}

function se(message: string, rule: string, line?: number, col?: number): SemanticError {
  return { message, rule, line, col };
}

// ── Tests ────────────────────────────────────────────────────

describe('ErrorFormatter', () => {
  describe('formatParseError', () => {
    it('formats with line and column', () => {
      expect(formatParseError(pe('Unexpected token', 3, 5))).toBe('[3:5] Unexpected token');
    });

    it('formats at origin', () => {
      expect(formatParseError(pe('EOF', 1, 1))).toBe('[1:1] EOF');
    });

    it('handles long messages', () => {
      const msg = 'A'.repeat(200);
      expect(formatParseError(pe(msg, 1, 1))).toContain(msg);
    });
  });

  describe('formatSemanticError', () => {
    it('formats with line, col, and rule', () => {
      expect(formatSemanticError(se('Duplicate entity', 'SS-1', 10, 3))).toBe('[10:3] (SS-1) Duplicate entity');
    });

    it('formats without line (rule only)', () => {
      expect(formatSemanticError(se('Bad enum', 'SS-4'))).toBe('(SS-4) Bad enum');
    });

    it('includes entity name in message when present', () => {
      const err: SemanticError = { message: "Dup 'Foo'", rule: 'SS-1', entity: 'Foo', line: 1, col: 1 };
      expect(formatSemanticError(err)).toContain('Foo');
    });
  });

  describe('formatAllErrors', () => {
    it('returns empty array for no errors', () => {
      expect(formatAllErrors([], [])).toEqual([]);
    });

    it('combines parse and semantic errors preserving order', () => {
      const result = formatAllErrors(
        [pe('parse fail', 1, 1)],
        [se('sem fail', 'SS-1', 2, 3)],
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toContain('parse fail');
      expect(result[1]).toContain('sem fail');
    });

    it('parse errors always come first', () => {
      const result = formatAllErrors(
        [pe('P1', 5, 1)],
        [se('S1', 'SS-1')],
      );
      expect(result[0]).toMatch(/^\[5:1\]/);
      expect(result[1]).toMatch(/^\(SS-1\)/);
    });

    it('handles many errors', () => {
      const parseErrs = Array.from({ length: 10 }, (_, i) => pe(`err${i}`, i + 1, 1));
      const semErrs = Array.from({ length: 10 }, (_, i) => se(`sem${i}`, `SS-${i + 1}`));
      expect(formatAllErrors(parseErrs, semErrs)).toHaveLength(20);
    });

    it('handles only parse errors', () => {
      expect(formatAllErrors([pe('x', 1, 1)], [])).toHaveLength(1);
    });

    it('handles only semantic errors', () => {
      expect(formatAllErrors([], [se('x', 'SS-1')])).toHaveLength(1);
    });
  });
});
