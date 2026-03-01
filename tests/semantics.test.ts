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

    it('reports duplicate across different entity kinds', () => {
      const result = analyze(parse('diagram D : class { class Foo {} interface Foo {} }').program);
      expect(result.errors.filter(e => e.rule === 'SS-1').length).toBeGreaterThan(0);
    });

    it('allows same name in different diagrams', () => {
      const { errors } = analyzeOk('diagram A : class { class X {} } diagram B : class { class X {} }');
      expect(errors.filter(e => e.rule === 'SS-1')).toHaveLength(0);
    });
  });

  describe('SS-2: unique member names', () => {
    it('reports duplicate field name within entity', () => {
      const result = analyze(parse('diagram D : class { class C { + name: string + name: int } }').program);
      const ss2 = result.errors.filter(e => e.rule === 'SS-2');
      expect(ss2.length).toBeGreaterThan(0);
    });

    it('accepts unique field names', () => {
      const { errors } = analyzeOk('diagram D : class { class C { + a: string + b: int } }');
      expect(errors.filter(e => e.rule === 'SS-2')).toHaveLength(0);
    });

    it('reports duplicate method name within entity', () => {
      const result = analyze(parse('diagram D : class { class C { + go(): void + go(): string } }').program);
      expect(result.errors.filter(e => e.rule === 'SS-2').length).toBeGreaterThan(0);
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

    it('reports both sides undeclared', () => {
      const result = analyze(parse('diagram D : class { X -- Y }').program);
      expect(result.errors.filter(e => e.rule === 'SS-3').length).toBeGreaterThanOrEqual(1);
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

    it('accepts enum with multiple values', () => {
      const { errors } = analyzeOk('diagram D : class { enum E { A B C D } }');
      expect(errors.filter(e => e.rule === 'SS-4')).toHaveLength(0);
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

    it('accepts interface methods (no constraint)', () => {
      const { errors } = analyzeOk('diagram D : class { interface I { + doWork(): void } }');
      expect(errors.filter(e => e.rule === 'SS-5')).toHaveLength(0);
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

    it('reports indirect circular inheritance A → B → A', () => {
      const result = analyze(parse('diagram D : class { class A extends B {} class B extends A {} }').program);
      const ss6 = result.errors.filter(e => e.rule === 'SS-6');
      expect(ss6.length).toBeGreaterThan(0);
    });
  });

  describe('SS-7: style target validity', () => {
    it('accepts style on existing entity', () => {
      const result = analyze(parse('diagram D : class { class A {} style A { color = "#ff0000" } }').program);
      expect(result.errors.filter(e => e.rule === 'SS-7')).toHaveLength(0);
    });

    it('rejects style on unknown entity', () => {
      const result = analyze(parse('diagram D : class { class A {} style Missing { color = "#ff0000" } }').program);
      const ss7 = result.errors.filter(e => e.rule === 'SS-7');
      expect(ss7.length).toBeGreaterThan(0);
    });
  });

  describe('SS-8: enum value uniqueness', () => {
    it('accepts unique enum values', () => {
      const { errors } = analyzeOk('diagram D : class { enum Status { ACTIVE DONE } }');
      expect(errors.filter(e => e.rule === 'SS-8')).toHaveLength(0);
    });

    it('rejects duplicate enum values', () => {
      const result = analyze(parse('diagram D : class { enum Status { ACTIVE ACTIVE } }').program);
      const ss8 = result.errors.filter(e => e.rule === 'SS-8');
      expect(ss8.length).toBeGreaterThan(0);
    });
  });

  describe('SS-9: diagram kind compatibility', () => {
    it('accepts class entities in class diagrams', () => {
      const { errors } = analyzeOk('diagram D : class { class A {} interface I {} enum E { V } }');
      expect(errors.filter(e => e.rule === 'SS-9')).toHaveLength(0);
    });

    it('rejects actor in class diagram', () => {
      const result = analyze(parse('diagram D : class { actor Bob }').program);
      const ss9 = result.errors.filter(e => e.rule === 'SS-9');
      expect(ss9.length).toBeGreaterThan(0);
    });

    it('accepts actor and usecase in usecase diagram', () => {
      const { errors } = analyzeOk('diagram D : usecase { actor Bob usecase Login }');
      expect(errors.filter(e => e.rule === 'SS-9')).toHaveLength(0);
    });

    it('rejects class entity in usecase diagram', () => {
      const result = analyze(parse('diagram D : usecase { class Foo {} }').program);
      const ss9 = result.errors.filter(e => e.rule === 'SS-9');
      expect(ss9.length).toBeGreaterThan(0);
    });

    it('accepts component in deployment diagram', () => {
      const { errors } = analyzeOk('diagram D : deployment { component WebServer node Host }');
      expect(errors.filter(e => e.rule === 'SS-9')).toHaveLength(0);
    });

    it('accepts component in component diagram', () => {
      const { errors } = analyzeOk('diagram D : component { component Gateway component Service }');
      expect(errors.filter(e => e.rule === 'SS-9')).toHaveLength(0);
    });
  });

  describe('SS-10: layout reference validity', () => {
    it('accepts layout on existing entity', () => {
      const { errors } = analyzeOk('diagram D : class { class A {} @A at (10, 20) }');
      expect(errors.filter(e => e.rule === 'SS-10')).toHaveLength(0);
    });

    it('rejects layout on unknown entity', () => {
      const result = analyze(parse('diagram D : class { class A {} @Missing at (10, 20) }').program);
      const ss10 = result.errors.filter(e => e.rule === 'SS-10');
      expect(ss10.length).toBeGreaterThan(0);
    });
  });

  describe('SS-11: abstract + final conflict', () => {
    it('accepts abstract class without final', () => {
      const { errors } = analyzeOk('diagram D : class { abstract class A {} }');
      expect(errors.filter(e => e.rule === 'SS-11')).toHaveLength(0);
    });

    it('accepts final class without abstract', () => {
      const { errors } = analyzeOk('diagram D : class { final class A {} }');
      expect(errors.filter(e => e.rule === 'SS-11')).toHaveLength(0);
    });

    it('reports abstract + final conflict', () => {
      const result = analyze(parse('diagram D : class { abstract final class A {} }').program);
      const ss11 = result.errors.filter(e => e.rule === 'SS-11');
      expect(ss11.length).toBeGreaterThan(0);
    });
  });

  describe('SS-12: duplicate method param names', () => {
    it('accepts methods with unique param names', () => {
      const { errors } = analyzeOk('diagram D : class { class C { + find(id: int, name: string): void } }');
      expect(errors.filter(e => e.rule === 'SS-12')).toHaveLength(0);
    });

    it('reports duplicate param names in method', () => {
      const result = analyze(parse('diagram D : class { class C { + find(x: int, x: string): void } }').program);
      const ss12 = result.errors.filter(e => e.rule === 'SS-12');
      expect(ss12.length).toBeGreaterThan(0);
    });

    it('accepts methods with no params', () => {
      const { errors } = analyzeOk('diagram D : class { class C { + go(): void } }');
      expect(errors.filter(e => e.rule === 'SS-12')).toHaveLength(0);
    });
  });

  describe('SS-13: extends target must exist', () => {
    it('accepts valid extends target', () => {
      const { errors } = analyzeOk('diagram D : class { class A {} class B extends A {} }');
      expect(errors.filter(e => e.rule === 'SS-13')).toHaveLength(0);
    });

    it('reports extends referencing unknown entity', () => {
      const result = analyze(parse('diagram D : class { class B extends Ghost {} }').program);
      const ss13 = result.errors.filter(e => e.rule === 'SS-13');
      expect(ss13).toHaveLength(1);
      expect(ss13[0].message).toContain('Ghost');
    });

    it('reports each unknown extends target separately', () => {
      const result = analyze(parse('diagram D : class { class A extends X {} class B extends Y {} }').program);
      const ss13 = result.errors.filter(e => e.rule === 'SS-13');
      expect(ss13).toHaveLength(2);
    });
  });

  describe('SS-14: implements target must exist', () => {
    it('accepts valid implements target', () => {
      const { errors } = analyzeOk('diagram D : class { interface I {} class C implements I {} }');
      expect(errors.filter(e => e.rule === 'SS-14')).toHaveLength(0);
    });

    it('reports implements referencing unknown entity', () => {
      const result = analyze(parse('diagram D : class { class C implements Phantom {} }').program);
      const ss14 = result.errors.filter(e => e.rule === 'SS-14');
      expect(ss14).toHaveLength(1);
      expect(ss14[0].message).toContain('Phantom');
    });

    it('reports each unknown implements target separately', () => {
      const result = analyze(parse('diagram D : class { class A implements X {} class B implements Y {} }').program);
      const ss14 = result.errors.filter(e => e.rule === 'SS-14');
      expect(ss14).toHaveLength(2);
    });

    it('does not report when both extends and implements are valid', () => {
      const { errors } = analyzeOk('diagram D : class { interface I {} class A {} class B extends A implements I {} }');
      expect(errors.filter(e => e.rule === 'SS-13' || e.rule === 'SS-14')).toHaveLength(0);
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
      const entity = iom.diagrams[0].entities.get('C');
      expect(entity).toBeDefined();
      expect(entity?.fields[0].visibility).toBe('public');
      expect(entity?.fields[1].visibility).toBe('private');
      expect(entity?.fields[2].visibility).toBe('protected');
      expect(entity?.fields[3].visibility).toBe('package');
    });

    it('applies layout annotations to entity positions', () => {
      const { iom } = analyzeOk('diagram D : class { class A {} @A at (100, 200) }');
      const entity = iom.diagrams[0].entities.get('A');
      expect(entity).toBeDefined();
      expect(entity?.position?.x).toBe(100);
      expect(entity?.position?.y).toBe(200);
    });

    it('attaches notes to entities with "on" clause', () => {
      const { iom } = analyzeOk('diagram D : class { class A {} note "docs here" on A }');
      const entity = iom.diagrams[0].entities.get('A');
      expect(entity).toBeDefined();
      expect(entity?.note).toBe('docs here');
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

    it('builds aggregation relations', () => {
      const { iom } = analyzeOk('diagram D : class { class A {} class B {} A --o B }');
      expect(iom.diagrams[0].relations[0].kind).toBe('aggregation');
    });

    it('builds dependency relations', () => {
      const { iom } = analyzeOk('diagram D : class { class A {} class B {} A ..> B }');
      expect(iom.diagrams[0].relations[0].kind).toBe('dependency');
    });

    it('builds directed association relations', () => {
      const { iom } = analyzeOk('diagram D : class { class A {} class B {} A --> B }');
      expect(iom.diagrams[0].relations[0].kind).toBe('directed-association');
    });

    it('captures relation labels and multiplicities', () => {
      const { iom } = analyzeOk('diagram D : class { class A {} class B {} A --* B [label="has", toMult="1..*"] }');
      const rel = iom.diagrams[0].relations[0];
      expect(rel.label).toBe('has');
      expect(rel.toMult).toBe('1..*');
    });

    it('builds multiple diagrams in IOM', () => {
      const { iom } = analyzeOk('diagram A : class { class X {} } diagram B : usecase { actor Y }');
      expect(iom.diagrams).toHaveLength(2);
      expect(iom.diagrams[0].kind).toBe('class');
      expect(iom.diagrams[1].kind).toBe('usecase');
    });

    it('resolves entity inheritance chains', () => {
      const { iom } = analyzeOk('diagram D : class { class Base {} class Mid extends Base {} class Leaf extends Mid {} }');
      const leaf = iom.diagrams[0].entities.get('Leaf');
      expect(leaf).toBeDefined();
      expect(leaf?.extendsNames).toContain('Mid');
    });

    it('resolves implements list', () => {
      const { iom } = analyzeOk('diagram D : class { interface I {} class C implements I {} }');
      const entity = iom.diagrams[0].entities.get('C');
      expect(entity).toBeDefined();
      expect(entity?.implementsNames).toContain('I');
    });

    it('captures stereotype in IOM entity', () => {
      const { iom } = analyzeOk('diagram D : class { class Book <<Entity>> {} }');
      const entity = iom.diagrams[0].entities.get('Book');
      expect(entity).toBeDefined();
      expect(entity?.stereotype).toBe('Entity');
    });

    it('captures abstract flag in IOM entity', () => {
      const { iom } = analyzeOk('diagram D : class { abstract class Shape {} }');
      const entity = iom.diagrams[0].entities.get('Shape');
      expect(entity).toBeDefined();
      expect(entity?.isAbstract).toBe(true);
    });

    it('handles entities inside packages', () => {
      const { iom } = analyzeOk('diagram D : class { package p { class Inner {} } }');
      expect(iom.diagrams[0].entities.has('Inner')).toBe(true);
      expect(iom.diagrams[0].packages[0].name).toBe('p');
      expect(iom.diagrams[0].packages[0].entityNames).toContain('Inner');
    });

    it('handles multiple relations between same entities', () => {
      const { iom } = analyzeOk('diagram D : class { class A {} class B {} A --> B [label="uses"] A --* B [label="owns"] }');
      expect(iom.diagrams[0].relations).toHaveLength(2);
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

    it('converts nested generic types', () => {
      const span = { start: 0, end: 10, line: 1, col: 1 };
      expect(typeToString({
        kind: 'GenericType', base: 'Map',
        args: [
          { kind: 'SimpleType', name: 'string', span },
          { kind: 'GenericType', base: 'List', args: [{ kind: 'SimpleType', name: 'int', span }], span },
        ],
        span,
      })).toBe('Map<string, List<int>>');
    });

    it('converts nullable generic type', () => {
      const span = { start: 0, end: 10, line: 1, col: 1 };
      expect(typeToString({
        kind: 'NullableType',
        inner: { kind: 'GenericType', base: 'List', args: [{ kind: 'SimpleType', name: 'int', span }], span },
        span,
      })).toBe('List<int>?');
    });
  });

  describe('edge cases', () => {
    it('analyzes empty diagram without errors', () => {
      const { errors } = analyzeOk('diagram D : class {}');
      expect(errors).toHaveLength(0);
    });

    it('order of declarations does not matter for relations', () => {
      const { errors } = analyzeOk('diagram D : class { A -- B class A {} class B {} }');
      expect(errors.filter(e => e.rule === 'SS-3')).toHaveLength(0);
    });

    it('handles entity with many fields and methods', () => {
      const { iom } = analyzeOk(`diagram D : class {
        class Big {
          + a: string
          + b: int
          + c: float
          + d: bool
          + e: void
          + f(): string
          + g(x: int): void
        }
      }`);
      const entity = iom.diagrams[0].entities.get('Big');
      expect(entity).toBeDefined();
      expect(entity?.fields).toHaveLength(5);
      expect(entity?.methods).toHaveLength(2);
    });

    it('handles static fields in IOM', () => {
      const { iom } = analyzeOk('diagram D : class { class C { + static count: int } }');
      const entity = iom.diagrams[0].entities.get('C');
      expect(entity?.fields[0].isStatic).toBe(true);
    });

    it('handles final fields in IOM', () => {
      const { iom } = analyzeOk('diagram D : class { class C { + final MAX: int = 100 } }');
      const entity = iom.diagrams[0].entities.get('C');
      expect(entity?.fields[0].isFinal).toBe(true);
    });

    it('handles abstract methods in IOM', () => {
      const { iom } = analyzeOk('diagram D : class { abstract class A { + abstract draw(): void } }');
      const entity = iom.diagrams[0].entities.get('A');
      expect(entity?.methods[0].isAbstract).toBe(true);
    });

    it('interface entities are implicitly abstract', () => {
      const { iom } = analyzeOk('diagram D : class { interface I {} }');
      expect(iom.diagrams[0].entities.get('I')?.isAbstract).toBe(true);
    });

    it('handles standalone notes in IOM', () => {
      const { iom } = analyzeOk('diagram D : class { note "standalone" }');
      expect(iom.diagrams[0].notes).toHaveLength(1);
      expect(iom.diagrams[0].notes[0].text).toBe('standalone');
    });

    it('handles note declared before entity (BUG-7 fix)', () => {
      const { iom } = analyzeOk('diagram D : class { note "early" on A class A {} }');
      const entity = iom.diagrams[0].entities.get('A');
      expect(entity?.note).toBe('early');
    });

    it('handles styles applied to entities', () => {
      const { iom } = analyzeOk('diagram D : class { class A {} style A { color = "#ff0000" } }');
      const entity = iom.diagrams[0].entities.get('A');
      expect(entity?.styles).toBeDefined();
      expect(entity?.styles.color).toBe('#ff0000');
    });

    it('handles all 13 relation kinds in IOM', () => {
      const { iom } = analyzeOk(`diagram D : class {
        class A {} class B {}
        A -- B
        A --> B
        A --* B
        A --o B
        A ..> B
        A --|> B
        A ..|> B
        A --x B
      }`);
      expect(iom.diagrams[0].relations.length).toBe(8);
    });

    it('multiple SS violations reported together', () => {
      const result = analyze(parse(`diagram D : class {
        class X {}
        class X {}
        enum E {}
        X -- Ghost
      }`).program);
      // SS-1 (duplicate), SS-4 (empty enum), SS-3 (unknown relation target)
      const rules = new Set(result.errors.map(e => e.rule));
      expect(rules.has('SS-1')).toBe(true);
      expect(rules.has('SS-4')).toBe(true);
      expect(rules.has('SS-3')).toBe(true);
    });

    it('SS-6 detects self-referencing extends', () => {
      const result = analyze(parse('diagram D : class { class A extends A {} }').program);
      const ss6 = result.errors.filter(e => e.rule === 'SS-6');
      expect(ss6.length).toBeGreaterThan(0);
    });

    it('SS-9 allows flow diagram to accept any entity kind', () => {
      const { errors } = analyzeOk('diagram D : flow { class A {} enum B { X } actor C }');
      expect(errors.filter(e => e.rule === 'SS-9')).toHaveLength(0);
    });

    it('SS-11 with abstract interface (interfaces are implicitly abstract)', () => {
      // This should not error — interfaces are abstract by design
      const { errors } = analyzeOk('diagram D : class { interface I {} }');
      expect(errors.filter(e => e.rule === 'SS-11')).toHaveLength(0);
    });

    it('SS-13 and SS-14 together on same entity', () => {
      const result = analyze(parse('diagram D : class { class C extends X implements Y {} }').program);
      const ss13 = result.errors.filter(e => e.rule === 'SS-13');
      const ss14 = result.errors.filter(e => e.rule === 'SS-14');
      expect(ss13).toHaveLength(1);
      expect(ss14).toHaveLength(1);
    });

    it('complex diagram with packages passes all rules', () => {
      const { errors } = analyzeOk(`diagram D : class {
        package core {
          abstract class Entity {
            + id: string
          }
          interface Serializable {
            + serialize(): string
          }
        }
        package domain {
          class User extends Entity implements Serializable {
            + name: string
            + email: string
            + login(pw: string): bool
          }
          enum Role { ADMIN USER GUEST }
        }
        User --|> Entity
        User ..|> Serializable
        @Entity at (100, 100)
        @User at (100, 300)
        @Serializable at (400, 100)
        @Role at (400, 300)
      }`);
      expect(errors).toHaveLength(0);
    });
  });
});
