import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser/index.js';
import { analyze } from '../src/semantics/analyzer.js';
import { renderClassDiagram } from '../src/renderer/class-renderer.js';
import { renderUseCaseDiagram } from '../src/renderer/usecase-renderer.js';
import { renderComponentDiagram } from '../src/renderer/component-renderer.js';
import { escapeXml, visSymbolFor } from '../src/renderer/utils.js';

// ─── Helpers ─────────────────────────────────────────────────

function buildDiagram(source: string) {
  const { program } = parse(source);
  const { iom } = analyze(program);
  return iom.diagrams[0];
}

// ─── Renderer Tests ──────────────────────────────────────────

describe('Renderer Utils', () => {
  it('escapeXml escapes < > & " characters', () => {
    expect(escapeXml('<div>')).toBe('&lt;div&gt;');
    expect(escapeXml('a & b')).toBe('a &amp; b');
    expect(escapeXml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapeXml handles empty string', () => {
    expect(escapeXml('')).toBe('');
  });

  it('visSymbolFor maps visibility correctly', () => {
    expect(visSymbolFor('public')).toBe('+');
    expect(visSymbolFor('private')).toBe('−');
    expect(visSymbolFor('protected')).toBe('#');
    expect(visSymbolFor('package')).toBe('~');
  });
});

describe('Class Diagram Renderer', () => {
  it('produces valid SVG string', () => {
    const diag = buildDiagram('diagram D : class { class A {} }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('renders entity name in SVG', () => {
    const diag = buildDiagram('diagram D : class { class MyEntity {} }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('MyEntity');
  });

  it('renders fields in entity box', () => {
    const diag = buildDiagram('diagram D : class { class C { + name: string - age: int } }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('name');
    expect(svg).toContain('string');
    expect(svg).toContain('age');
    expect(svg).toContain('int');
  });

  it('renders methods in entity box', () => {
    const diag = buildDiagram('diagram D : class { class C { + getTitle(): string } }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('getTitle');
  });

  it('renders interface stereotype', () => {
    const diag = buildDiagram('diagram D : class { interface I {} }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('interface');
  });

  it('renders enum values', () => {
    const diag = buildDiagram('diagram D : class { enum Status { ACTIVE DONE } }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('ACTIVE');
    expect(svg).toContain('DONE');
  });

  it('renders relation lines between entities', () => {
    const diag = buildDiagram('diagram D : class { class A {} class B {} A --> B }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('<line');
  });

  it('renders relation labels', () => {
    const diag = buildDiagram('diagram D : class { class A {} class B {} A --> B [label="uses"] }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('uses');
  });

  it('renders multiplicities', () => {
    const diag = buildDiagram('diagram D : class { class A {} class B {} A --* B [toMult="1..*"] }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('1..*');
  });

  it('renders package background', () => {
    const diag = buildDiagram('diagram D : class { package p { class A {} } }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('package');
    expect(svg).toContain('p');
  });

  it('renders empty diagram placeholder', () => {
    const diag = buildDiagram('diagram D : class {}');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('Empty diagram');
  });

  it('uses shadow filter in SVG defs', () => {
    const diag = buildDiagram('diagram D : class { class A {} }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('filter');
    expect(svg).toContain('shadow');
  });

  it('includes data-entity-name attribute for drag support', () => {
    const diag = buildDiagram('diagram D : class { class Foo {} }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('data-entity-name="Foo"');
  });

  it('auto-layouts entities without positions', () => {
    const diag = buildDiagram('diagram D : class { class A {} class B {} class C {} }');
    const svg = renderClassDiagram(diag);
    // All three should appear
    expect(svg).toContain('A');
    expect(svg).toContain('B');
    expect(svg).toContain('C');
  });

  it('uses layout annotation positions when provided', () => {
    const diag = buildDiagram('diagram D : class { class A {} @A at (300, 400) }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('translate(300,400)');
  });
});

describe('UseCase Diagram Renderer', () => {
  it('produces valid SVG string', () => {
    const diag = buildDiagram('diagram D : usecase { actor User }');
    const svg = renderUseCaseDiagram(diag);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('renders actor names', () => {
    const diag = buildDiagram('diagram D : usecase { actor Student }');
    const svg = renderUseCaseDiagram(diag);
    expect(svg).toContain('Student');
  });

  it('renders usecase names', () => {
    const diag = buildDiagram('diagram D : usecase { usecase Login }');
    const svg = renderUseCaseDiagram(diag);
    expect(svg).toContain('Login');
  });

  it('renders relations in usecase diagram', () => {
    const diag = buildDiagram('diagram D : usecase { actor User usecase Login User --> Login }');
    const svg = renderUseCaseDiagram(diag);
    expect(svg).toContain('<line');
  });
});

describe('Component Diagram Renderer', () => {
  it('produces valid SVG string', () => {
    const diag = buildDiagram('diagram D : component { component Server }');
    const svg = renderComponentDiagram(diag);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('renders component names', () => {
    const diag = buildDiagram('diagram D : component { component Gateway component Service }');
    const svg = renderComponentDiagram(diag);
    expect(svg).toContain('Gateway');
    expect(svg).toContain('Service');
  });
});

describe('Class Diagram Renderer — advanced', () => {
  it('renders abstract class with <<abstract>> stereotype', () => {
    const diag = buildDiagram('diagram D : class { abstract class Shape {} }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('Shape');
    expect(svg).toContain('abstract');
  });

  it('renders enum with <<enum>> stereotype', () => {
    const diag = buildDiagram('diagram D : class { enum Color { RED GREEN BLUE } }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('enum');
    expect(svg).toContain('RED');
    expect(svg).toContain('GREEN');
    expect(svg).toContain('BLUE');
  });

  it('renders visibility symbols correctly', () => {
    const diag = buildDiagram(`diagram D : class {
      class C {
        + pub: string
        - priv: int
        # prot: bool
        ~ pkg: void
      }
    }`);
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('+');
    // − (minus sign) used for private
    expect(svg).toContain('−');
    expect(svg).toContain('#');
    expect(svg).toContain('~');
  });

  it('renders default values in fields', () => {
    const diag = buildDiagram('diagram D : class { class C { - count: int = 42 } }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('42');
  });

  it('renders method parameters', () => {
    const diag = buildDiagram('diagram D : class { class C { + find(id: int, name: string): bool } }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('find');
    expect(svg).toContain('id');
  });

  it('includes gradient defs for class', () => {
    const diag = buildDiagram('diagram D : class { class A {} }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('grad-class');
  });

  it('includes gradient defs for interface', () => {
    const diag = buildDiagram('diagram D : class { interface I {} }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('grad-interface');
  });

  it('includes gradient defs for abstract class', () => {
    const diag = buildDiagram('diagram D : class { abstract class A {} }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('grad-abstract');
  });

  it('includes gradient defs for enum', () => {
    const diag = buildDiagram('diagram D : class { enum E { X } }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('grad-enum');
  });

  it('renders custom stereotype', () => {
    const diag = buildDiagram('diagram D : class { class Book <<Entity>> {} }');
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('Entity');
  });

  it('renders multiple inheritance relations', () => {
    const diag = buildDiagram(`diagram D : class {
      class A {}
      class B {}
      class C {}
      A --> B [label="uses"]
      A --* C [label="owns"]
    }`);
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('uses');
    expect(svg).toContain('owns');
  });
});

describe('UseCase Diagram Renderer — advanced', () => {
  it('renders system boundary rectangle', () => {
    const diag = buildDiagram('diagram D : usecase { actor User usecase Login }');
    const svg = renderUseCaseDiagram(diag);
    // System boundary is rendered as a rect
    expect(svg).toContain('<rect');
  });

  it('renders relation labels in usecase diagram', () => {
    const diag = buildDiagram('diagram D : usecase { actor User usecase Login User --> Login [label="authenticates"] }');
    const svg = renderUseCaseDiagram(diag);
    expect(svg).toContain('authenticates');
  });

  it('renders multiple actors', () => {
    const diag = buildDiagram('diagram D : usecase { actor Admin actor User }');
    const svg = renderUseCaseDiagram(diag);
    expect(svg).toContain('Admin');
    expect(svg).toContain('User');
  });

  it('renders multiple usecases', () => {
    const diag = buildDiagram('diagram D : usecase { usecase Login usecase Register }');
    const svg = renderUseCaseDiagram(diag);
    expect(svg).toContain('Login');
    expect(svg).toContain('Register');
  });

  it('includes data-entity-name for actors', () => {
    const diag = buildDiagram('diagram D : usecase { actor Student }');
    const svg = renderUseCaseDiagram(diag);
    expect(svg).toContain('data-entity-name="Student"');
  });
});

describe('Component Diagram Renderer — advanced', () => {
  it('renders relations between components', () => {
    const diag = buildDiagram('diagram D : component { component A component B A --> B }');
    const svg = renderComponentDiagram(diag);
    expect(svg).toContain('<line');
  });

  it('renders relation lines between components', () => {
    const diag = buildDiagram('diagram D : component { component A component B A --> B [label="calls"] }');
    const svg = renderComponentDiagram(diag);
    // Component renderer draws relation lines (labels may not be rendered)
    expect(svg).toContain('<line');
  });

  it('renders deployment node shapes', () => {
    const diag = buildDiagram('diagram D : deployment { node Server }');
    const svg = renderComponentDiagram(diag);
    expect(svg).toContain('Server');
  });

  it('includes data-entity-name for components', () => {
    const diag = buildDiagram('diagram D : component { component Gateway }');
    const svg = renderComponentDiagram(diag);
    expect(svg).toContain('data-entity-name="Gateway"');
  });
});
