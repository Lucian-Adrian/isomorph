import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser/index.js';

// ─── Helpers ─────────────────────────────────────────────────

function parseOk(source: string) {
  const result = parse(source);
  expect(result.errors).toHaveLength(0);
  return result.program;
}

function parseErr(source: string) {
  return parse(source).errors;
}

// ─── Tests ───────────────────────────────────────────────────

describe('Parser', () => {
  describe('import declarations', () => {
    it('parses a single import', () => {
      const prog = parseOk('import "base.iso"; diagram D : class {}');
      expect(prog.imports).toHaveLength(1);
      expect(prog.imports[0].path).toBe('base.iso');
    });

    it('parses multiple imports', () => {
      const prog = parseOk('import "a.iso"; import "b.iso"; diagram D : class {}');
      expect(prog.imports).toHaveLength(2);
    });

    it('allows import without semicolon', () => {
      const result = parse('import "a.iso" diagram D : class {}');
      expect(result.program.imports).toHaveLength(1);
    });
  });

  describe('diagram declarations', () => {
    it('parses an empty class diagram', () => {
      const prog = parseOk('diagram Empty : class {}');
      expect(prog.diagrams).toHaveLength(1);
      expect(prog.diagrams[0].name).toBe('Empty');
      expect(prog.diagrams[0].diagramKind).toBe('class');
    });

    it('parses an empty usecase diagram', () => {
      const prog = parseOk('diagram UC : usecase {}');
      expect(prog.diagrams[0].diagramKind).toBe('usecase');
    });

    it('parses multiple diagrams', () => {
      const prog = parseOk('diagram A : class {} diagram B : usecase {}');
      expect(prog.diagrams).toHaveLength(2);
    });

    it('errors on unknown diagram kind', () => {
      const errs = parseErr('diagram X : unknown {}');
      expect(errs.length).toBeGreaterThan(0);
    });
  });

  describe('package declarations', () => {
    it('parses a package wrapping entities', () => {
      const prog = parseOk('diagram D : class { package domain { class Book {} } }');
      const pkg = prog.diagrams[0].body[0];
      expect(pkg.kind).toBe('PackageDecl');
      if (pkg.kind === 'PackageDecl') {
        expect(pkg.name).toBe('domain');
        expect(pkg.body).toHaveLength(1);
      }
    });
  });

  describe('entity declarations', () => {
    it('parses a simple class', () => {
      const prog = parseOk('diagram D : class { class Book {} }');
      const entity = prog.diagrams[0].body[0];
      expect(entity.kind).toBe('EntityDecl');
      if (entity.kind === 'EntityDecl') {
        expect(entity.name).toBe('Book');
        expect(entity.entityKind).toBe('class');
      }
    });

    it('parses an abstract class', () => {
      const prog = parseOk('diagram D : class { abstract class BaseEntity {} }');
      const entity = prog.diagrams[0].body[0];
      if (entity.kind === 'EntityDecl') {
        expect(entity.modifiers).toContain('abstract');
      }
    });

    it('parses an interface', () => {
      const prog = parseOk('diagram D : class { interface Borrowable {} }');
      const entity = prog.diagrams[0].body[0];
      if (entity.kind === 'EntityDecl') {
        expect(entity.entityKind).toBe('interface');
      }
    });

    it('parses an enum', () => {
      const prog = parseOk('diagram D : class { enum Status { ACTIVE INACTIVE } }');
      const entity = prog.diagrams[0].body[0];
      if (entity.kind === 'EntityDecl') {
        expect(entity.entityKind).toBe('enum');
        expect(entity.members).toHaveLength(2);
      }
    });

    it('parses stereotype', () => {
      const prog = parseOk('diagram D : class { class Book <<Entity>> {} }');
      const entity = prog.diagrams[0].body[0];
      if (entity.kind === 'EntityDecl') {
        expect(entity.stereotype).toBe('Entity');
      }
    });

    it('parses extends clause', () => {
      const prog = parseOk('diagram D : class { class Dog extends Animal {} }');
      const entity = prog.diagrams[0].body[0];
      if (entity.kind === 'EntityDecl') {
        expect(entity.extendsClause).toContain('Animal');
      }
    });

    it('parses implements clause', () => {
      const prog = parseOk('diagram D : class { class Dog implements Runnable, Jumpable {} }');
      const entity = prog.diagrams[0].body[0];
      if (entity.kind === 'EntityDecl') {
        expect(entity.implementsClause).toEqual(['Runnable', 'Jumpable']);
      }
    });
  });

  describe('field declarations', () => {
    it('parses a public field', () => {
      const prog = parseOk('diagram D : class { class C { + name: string } }');
      const entity = prog.diagrams[0].body[0];
      if (entity.kind === 'EntityDecl') {
        const field = entity.members[0];
        expect(field.kind).toBe('FieldDecl');
        if (field.kind === 'FieldDecl') {
          expect(field.name).toBe('name');
          expect(field.visibility).toBe('+');
        }
      }
    });

    it('parses a field with default value', () => {
      const prog = parseOk('diagram D : class { class C { - count: int = 0 } }');
      const entity = prog.diagrams[0].body[0];
      if (entity.kind === 'EntityDecl') {
        const field = entity.members[0];
        if (field.kind === 'FieldDecl') {
          expect(field.defaultValue?.value).toBe(0);
        }
      }
    });

    it('parses a generic field type', () => {
      const prog = parseOk('diagram D : class { class C { books: List<Book> } }');
      const entity = prog.diagrams[0].body[0];
      if (entity.kind === 'EntityDecl') {
        const field = entity.members[0];
        if (field.kind === 'FieldDecl') {
          expect(field.type.kind).toBe('GenericType');
        }
      }
    });

    it('parses nested generic types: Map<K, List<V>> (INCON-5 fix)', () => {
      // Previously >> was lexed as STEREO_C, mangling closing nested generics
      const prog = parseOk('diagram D : class { class C { + table: Map<string, List<int>> } }');
      const entity = prog.diagrams[0].body[0];
      if (entity.kind === 'EntityDecl') {
        const field = entity.members[0];
        if (field.kind === 'FieldDecl') {
          expect(field.type.kind).toBe('GenericType');
          if (field.type.kind === 'GenericType') {
            expect(field.type.base).toBe('Map');
            expect(field.type.args).toHaveLength(2);
            expect(field.type.args[1].kind).toBe('GenericType');
          }
        }
      }
    });

    it('parses nullable type (INCON-1 fix)', () => {
      const prog = parseOk('diagram D : class { class C { + name: string? } }');
      const entity = prog.diagrams[0].body[0];
      if (entity.kind === 'EntityDecl') {
        const field = entity.members[0];
        if (field.kind === 'FieldDecl') {
          expect(field.type.kind).toBe('NullableType');
        }
      }
    });

    it('parses negative coordinates in layout annotation (BUG-1 fix)', () => {
      const prog = parseOk('diagram D : class { class A {} @A at (-100, -50) }');
      const annotation = prog.diagrams[0].body.find(b => b.kind === 'LayoutAnnotation');
      if (annotation?.kind === 'LayoutAnnotation') {
        expect(annotation.x).toBe(-100);
        expect(annotation.y).toBe(-50);
      }
    });
  });

  describe('method declarations', () => {
    it('parses a public method', () => {
      const prog = parseOk('diagram D : class { class C { + getTitle(): string } }');
      const entity = prog.diagrams[0].body[0];
      if (entity.kind === 'EntityDecl') {
        const method = entity.members[0];
        expect(method.kind).toBe('MethodDecl');
        if (method.kind === 'MethodDecl') {
          expect(method.name).toBe('getTitle');
          expect(method.params).toHaveLength(0);
        }
      }
    });

    it('parses method with parameters', () => {
      const prog = parseOk('diagram D : class { class C { + find(id: int, name: string): void } }');
      const entity = prog.diagrams[0].body[0];
      if (entity.kind === 'EntityDecl') {
        const method = entity.members[0];
        if (method.kind === 'MethodDecl') {
          expect(method.params).toHaveLength(2);
          expect(method.params[0].name).toBe('id');
          expect(method.params[1].name).toBe('name');
        }
      }
    });
  });

  describe('relation declarations', () => {
    it('parses association --', () => {
      const prog = parseOk('diagram D : class { class A {} class B {} A -- B }');
      const rel = prog.diagrams[0].body.find(b => b.kind === 'RelationDecl');
      if (rel?.kind === 'RelationDecl') {
        expect(rel.relKind).toBe('--');
        expect(rel.from).toBe('A');
        expect(rel.to).toBe('B');
      }
    });

    it('parses inheritance --|>', () => {
      const prog = parseOk('diagram D : class { class A {} class B {} A --|> B }');
      const rel = prog.diagrams[0].body.find(b => b.kind === 'RelationDecl');
      if (rel?.kind === 'RelationDecl') {
        expect(rel.relKind).toBe('--|>');
      }
    });

    it('parses relation with label', () => {
      const prog = parseOk('diagram D : class { class A {} class B {} A --* B [label="contains"] }');
      const rel = prog.diagrams[0].body.find(b => b.kind === 'RelationDecl');
      if (rel?.kind === 'RelationDecl') {
        expect(rel.label).toBe('contains');
        expect(rel.relKind).toBe('--*');
      }
    });

    it('parses relation with multiplicities', () => {
      const prog = parseOk('diagram D : class { class A {} class B {} A --* B [fromMult="1", toMult="1..*"] }');
      const rel = prog.diagrams[0].body.find(b => b.kind === 'RelationDecl');
      if (rel?.kind === 'RelationDecl') {
        expect(rel.fromMult).toBe('1');
        expect(rel.toMult).toBe('1..*');
      }
    });
  });

  describe('layout annotations', () => {
    it('parses @Entity at (x, y)', () => {
      const prog = parseOk('diagram D : class { class A {} @A at (100, 200) }');
      const layout = prog.diagrams[0].body.find(b => b.kind === 'LayoutAnnotation');
      if (layout?.kind === 'LayoutAnnotation') {
        expect(layout.entity).toBe('A');
        expect(layout.x).toBe(100);
        expect(layout.y).toBe(200);
      }
    });
  });

  describe('note declarations', () => {
    it('parses a standalone note', () => {
      const prog = parseOk('diagram D : class { note "This is important" }');
      const note = prog.diagrams[0].body.find(b => b.kind === 'NoteDecl');
      if (note?.kind === 'NoteDecl') {
        expect(note.text).toBe('This is important');
      }
    });

    it('parses a note on an entity', () => {
      const prog = parseOk('diagram D : class { class A {} note "See docs" on A }');
      const note = prog.diagrams[0].body.find(b => b.kind === 'NoteDecl');
      if (note?.kind === 'NoteDecl') {
        expect(note.on).toBe('A');
      }
    });
  });

  describe('full program', () => {
    it('parses the library system example without errors', () => {
      const source = `
        diagram LibrarySystem : class {
          package domain {
            abstract class Book <<Entity>> implements Borrowable {
              + title: string
              + isbn: string
              - stock: int = 0
              + checkOut(user: string): bool
              + getTitle(): string
            }
            class Library {
              + name: string
              + addBook(book: Book): void
            }
            interface Borrowable {
              + borrow(user: string): void
            }
            enum BookStatus {
              AVAILABLE
              CHECKED_OUT
            }
          }
          Library --* Book [label="contains", toMult="1..*"]
          Book ..|> Borrowable
          @Book at (100, 130)
          @Library at (400, 130)
        }
      `;
      const prog = parseOk(source);
      expect(prog.diagrams).toHaveLength(1);
      const pkg = prog.diagrams[0].body[0];
      if (pkg.kind === 'PackageDecl') {
        expect(pkg.body.filter(b => b.kind === 'EntityDecl')).toHaveLength(4);
      }
    });
  });
});
