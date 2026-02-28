import { describe, it, expect } from 'vitest';
import { lex } from '../src/parser/lexer.js';

describe('Lexer', () => {
  describe('keywords', () => {
    it('recognizes all reserved keywords', () => {
      const { tokens } = lex('diagram class interface enum abstract package import');
      const kinds = tokens.filter(t => t.kind !== 'EOF').map(t => t.kind);
      expect(kinds).toEqual(['diagram', 'class', 'interface', 'enum', 'abstract', 'package', 'import']);
    });

    it('maps "string" to string_t token', () => {
      const { tokens } = lex('string');
      expect(tokens[0].kind).toBe('string_t');
    });

    it('recognizes type keywords', () => {
      const { tokens } = lex('int float bool void');
      const kinds = tokens.filter(t => t.kind !== 'EOF').map(t => t.kind);
      expect(kinds).toEqual(['int', 'float', 'bool', 'void']);
    });
  });

  describe('identifiers', () => {
    it('produces IDENT tokens for user-defined names', () => {
      const { tokens } = lex('Library Book User');
      const kinds = tokens.filter(t => t.kind !== 'EOF').map(t => t.kind);
      expect(kinds).toEqual(['IDENT', 'IDENT', 'IDENT']);
    });

    it('captures identifier values', () => {
      const { tokens } = lex('MyClass');
      expect(tokens[0].value).toBe('MyClass');
    });

    it('allows underscores in identifiers', () => {
      const { tokens } = lex('_privateField my_method');
      expect(tokens[0].kind).toBe('IDENT');
      expect(tokens[1].kind).toBe('IDENT');
    });
  });

  describe('string literals', () => {
    it('lexes a quoted string', () => {
      const { tokens } = lex('"hello world"');
      expect(tokens[0].kind).toBe('STRING');
      expect(tokens[0].value).toBe('hello world');
    });

    it('handles escape sequences in strings', () => {
      const { tokens } = lex('"line1\\nline2"');
      expect(tokens[0].value).toBe('line1\nline2');
    });
  });

  describe('numbers', () => {
    it('lexes integer literals', () => {
      const { tokens } = lex('42');
      expect(tokens[0].kind).toBe('NUMBER');
      expect(tokens[0].value).toBe('42');
    });

    it('lexes float literals', () => {
      const { tokens } = lex('3.14');
      expect(tokens[0].kind).toBe('NUMBER');
      expect(tokens[0].value).toBe('3.14');
    });

    it('lexes negative integer literals (BUG-1 fix)', () => {
      const { tokens, errors } = lex('-42');
      expect(errors).toHaveLength(0);
      expect(tokens[0].kind).toBe('NUMBER');
      expect(tokens[0].value).toBe('-42');
    });

    it('lexes negative coordinates in layout annotations', () => {
      const { tokens, errors } = lex('@Entity at (-100, -50)');
      expect(errors).toHaveLength(0);
      // AT IDENT 'at' LPAREN NUMBER COMMA NUMBER RPAREN EOF
      expect(tokens[4].kind).toBe('NUMBER');
      expect(tokens[4].value).toBe('-100');
      expect(tokens[6].kind).toBe('NUMBER');
      expect(tokens[6].value).toBe('-50');
    });
  });

  describe('punctuation', () => {
    it('lexes ? as QUESTION token (INCON-1 fix)', () => {
      const { tokens } = lex('int?');
      expect(tokens[0].kind).toBe('int');
      expect(tokens[1].kind).toBe('QUESTION');
    });
  });

  describe('relation operators', () => {
    it('lexes all relation operators correctly', () => {
      // Unambiguous operators (don't start with a letter)
      const ops = [
        ['--|>', 'INHERIT'],   ['..|>', 'REALIZE'],  ['<|--', 'INHERIT_R'],
        ['<|..', 'REALIZE_R'], ['<..', 'DEPEND_R'],
        ['*--', 'COMPOSE_R'],  ['-->', 'ASSOC_DIR'], ['..>', 'DEPEND'],
        ['--o', 'AGGR'],       ['--*', 'COMPOSE'],   ['--x', 'RESTR'],
        ['--', 'ASSOC'],
      ] as const;

      for (const [op, kind] of ops) {
        const { tokens } = lex(op);
        expect(tokens[0].kind).toBe(kind);
      }

      // o-- starts with 'o' (valid identifier char), must be tested in context
      // The parser disambiguates via position: after an entity name, o-- is AGGR_R
      const { tokens: ctxTokens } = lex('Foo o-- Bar');
      expect(ctxTokens[1].kind).toBe('AGGR_R');
    });

    it('greedily matches --|> before --', () => {
      const { tokens } = lex('--|>');
      expect(tokens[0].kind).toBe('INHERIT');
      expect(tokens[0].value).toBe('--|>');
    });

    it('greedily matches ..|> before ..', () => {
      const { tokens } = lex('..|>');
      expect(tokens[0].kind).toBe('REALIZE');
    });
  });

  describe('visibility symbols', () => {
    it('lexes + as PLUS', () => {
      expect(lex('+').tokens[0].kind).toBe('PLUS');
    });
    it('lexes - as MINUS', () => {
      expect(lex('-').tokens[0].kind).toBe('MINUS');
    });
    it('lexes ~ as TILDE', () => {
      expect(lex('~').tokens[0].kind).toBe('TILDE');
    });
  });

  describe('color tokens', () => {
    it('lexes a 6-hex color as COLOR', () => {
      const { tokens } = lex('#ff0099');
      expect(tokens[0].kind).toBe('COLOR');
      expect(tokens[0].value).toBe('#ff0099');
    });

    it('lexes # without 6 hex chars as HASH', () => {
      const { tokens } = lex('#protected');
      expect(tokens[0].kind).toBe('HASH');
    });
  });

  describe('stereotype delimiters', () => {
    it('lexes << as STEREO_O', () => {
      const { tokens } = lex('<<Entity>>');
      expect(tokens[0].kind).toBe('STEREO_O');
      expect(tokens[1].kind).toBe('IDENT');
      // '>>' is intentionally lexed as two GT tokens (never as STEREO_C).
      // This prevents ambiguity with closing nested generics: Map<K, List<V>>
      // The parser consumes GT GT for stereotype close — see parser.ts for details.
      expect(tokens[2].kind).toBe('GT');
      expect(tokens[3].kind).toBe('GT');
    });

    it('lexes nested generic closing >> as two GT tokens (INCON-5 fix)', () => {
      // Map<String, List<T>> must not be mangled by a greedy >> → STEREO_C rule
      const { tokens, errors } = lex('Map<String,List<T>>');
      expect(errors).toHaveLength(0);
      // Expect: IDENT LT IDENT COMMA IDENT LT IDENT GT GT EOF
      const kinds = tokens.map(t => t.kind);
      expect(kinds).toEqual(['IDENT','LT','IDENT','COMMA','IDENT','LT','IDENT','GT','GT','EOF']);
    });
  });

  describe('comments', () => {
    it('skips line comments', () => {
      const { tokens } = lex('// this is a comment\nclass');
      expect(tokens[0].kind).toBe('class');
    });

    it('skips block comments', () => {
      const { tokens } = lex('/* block */ class');
      expect(tokens[0].kind).toBe('class');
    });
  });

  describe('line tracking', () => {
    it('tracks line numbers across newlines', () => {
      const { tokens } = lex('class\ninterface\nenum');
      expect(tokens[0].line).toBe(1);
      expect(tokens[1].line).toBe(2);
      expect(tokens[2].line).toBe(3);
    });
  });

  describe('error recovery', () => {
    it('reports unknown characters in errors array', () => {
      const { errors } = lex('class ^ interface');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toMatch(/Unexpected character/);
    });

    it('produces EOF token at end', () => {
      const { tokens } = lex('class');
      expect(tokens[tokens.length - 1].kind).toBe('EOF');
    });
  });
});
