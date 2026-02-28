import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser/index.js';
import { analyze } from '../src/semantics/analyzer.js';
import { typeToString } from '../src/semantics/analyzer.js';

function analyzeOk(source: string) {
  const { program, errors: parseErrors } = parse(source);
  expect(parseErrors).toHaveLength(0);
  const result = analyze(program);
  return result;
}

describe('Semantic Analyzer', () => {
  describe('SS-1: unique entity names', () => {
    it('accepts diagrams with unique entity names', () => {
      const { errors } = analyzeOk('diagram D : class { class A {} class B {} }');
      expect(errors.filter(e => e.rule === 'SS-1')).toHaveLength(0);
    });

    it('reports duplicate entity name', () => {
      const result = analyze(parse('diagram D : class { class A {} class A {} }').program);
      const ss1 = result.errors.filter(e => e.rule === 'SS-1');
      expect(ss1.length).toBeGreaterThan(0);
    });
  });

  describe('SS-2: unique member names', () => {
    it('reports duplicate field name within entity', () => {
      const result = analyze(parse('diagram D : class { class C { + name: string + name: int } }').program);
      const ss2 = result.errors.filter(e => e.rule === 'SS-2');
      expect(ss2.length).toBeGreaterThan(0);
    });
  });

  describe('SS-3: referential integrity in relations', () => {
    it('accepts relations between declared entities', () => {
      const { errors } = analyzeOk('diagram D : class { class A {} class B {} A -- B }');
      expect(errors.filter(e => e.rule === 'SS-3')).toHaveLength(0);
    });

    it('reports relation to undeclared entity', () => {
      const result = analyze(parse('diagram D : class { class A {} A -- Ghost }').program);
      const ss3 = result.errors.filter(e => e.rule === 'SS-3');
      expect(ss3.length).toBeGreaterThan(0);
    });
  });

  describe('SS-4: enum must have values', () => {
    it('accepts enum with values', () => {
      const { errors } = analyzeOk('diagram D : class { enum Status { ACTIVE } }');
      expect(errors.filter(e => e.rule === 'SS-4')).toHaveLength(0);
    });

    it('reports empty enum', () => {
      const result = analyze(parse('diagram D : class { enum Empty {} }').program);
      const ss4 = result.errors.filter(e => e.rule === 'SS-4');
      expect(ss4.length).toBeGreaterThan(0);
    });
  });

  describe('SS-5: interfaces cannot have fields with defaults', () => {
    it('accepts interface fields without defaults', () => {
      const { errors } = analyzeOk('diagram D : class { interface I { + name: string } }');
      expect(errors.filter(e => e.rule === 'SS-5')).toHaveLength(0);
    });

    it('reports interface field with default value', () => {
      const result = analyze(parse('diagram D : class { interface I { + count: int = 0 } }').program);
      const ss5 = result.errors.filter(e => e.rule === 'SS-5');
      expect(ss5.length).toBeGreaterThan(0);
    });
  });

  describe('SS-6: no circular inheritance', () => {
    it('accepts normal inheritance', () => {
      const { errors } = analyzeOk('diagram D : class { class Animal {} class Dog extends Animal {} }');
      expect(errors.filter(e => e.rule === 'SS-6')).toHaveLength(0);
    });

    it('reports self-inheritance', () => {
      const result = analyze(parse('diagram D : class { class A extends A {} }').program);
      const ss6 = result.errors.filter(e => e.rule === 'SS-6');
      expect(ss6.length).toBeGreaterThan(0);
    });
  });

  describe('IOM construction', () => {
    it('builds entities map', () => {
      const { iom } = analyzeOk('diagram D : class { class Book {} class Library {} }');
      expect(iom.diagrams[0].entities.has('Book')).toBe(true);
      expect(iom.diagrams[0].entities.has('Library')).toBe(true);
    });

    it('resolves visibility to IOM representation', () => {
      const { iom } = analyzeOk('diagram D : class { class C { + pub: string - priv: int # prot: bool ~ pkg: void } }');
      const entity = iom.diagrams[0].entities.get('C')!;
      expect(entity.fields[0].visibility).toBe('public');
      expect(entity.fields[1].visibility).toBe('private');
      expect(entity.fields[2].visibility).toBe('protected');
      expect(entity.fields[3].visibility).toBe('package');
    });

    it('applies layout annotations to entity positions', () => {
      const { iom } = analyzeOk('diagram D : class { class A {} @A at (100, 200) }');
      const entity = iom.diagrams[0].entities.get('A')!;
      expect(entity.position?.x).toBe(100);
      expect(entity.position?.y).toBe(200);
    });

    it('attaches notes to entities with "on" clause', () => {
      const { iom } = analyzeOk('diagram D : class { class A {} note "docs here" on A }');
      const entity = iom.diagrams[0].entities.get('A')!;
      expect(entity.note).toBe('docs here');
    });

    it('builds relations list with correct kind', () => {
      const { iom } = analyzeOk('diagram D : class { class A {} class B {} A --|> B }');
      expect(iom.diagrams[0].relations[0].kind).toBe('inheritance');
    });

    it('builds realization relations', () => {
      const { iom } = analyzeOk('diagram D : class { class A {} interface I {} A ..|> I }');
      expect(iom.diagrams[0].relations[0].kind).toBe('realization');
    });

    it('builds composition relations', () => {
      const { iom } = analyzeOk('diagram D : class { class A {} class B {} A --* B }');
      expect(iom.diagrams[0].relations[0].kind).toBe('composition');
    });
  });

  describe('typeToString', () => {
    it('converts SimpleType', () => {
      const span = { start: 0, end: 5, line: 1, col: 1 };
      expect(typeToString({ kind: 'SimpleType', name: 'string', span })).toBe('string');
    });

    it('converts GenericType', () => {
      const span = { start: 0, end: 5, line: 1, col: 1 };
      expect(typeToString({
        kind: 'GenericType', base: 'List',
        args: [{ kind: 'SimpleType', name: 'Book', span }],
        span,
      })).toBe('List<Book>');
    });

    it('converts NullableType', () => {
      const span = { start: 0, end: 5, line: 1, col: 1 };
      expect(typeToString({
        kind: 'NullableType',
        inner: { kind: 'SimpleType', name: 'string', span },
        span,
      })).toBe('string?');
    });
  });
});
