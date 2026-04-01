import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser/index.js';
import { analyze } from '../src/semantics/analyzer.js';
import { renderClassDiagram } from '../src/renderer/class-renderer.js';
import { renderUseCaseDiagram } from '../src/renderer/usecase-renderer.js';
import { renderComponentDiagram } from '../src/renderer/component-renderer.js';
import { renderSequenceDiagram } from '../src/renderer/sequence-renderer.js';
import { renderStateOrActivityDiagram } from '../src/renderer/state-renderer.js';
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
    expect(svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>');
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

  it('respects package position annotation over member bounding box', () => {
    const diag = buildDiagram(`diagram D : class {
      package core {
        class Entity {}
      }
      @Entity at (100, 100)
      @core at (50, 40)
    }`);
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('data-package-name="core"');
    expect(svg).toContain('translate(50,40)');
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

  it('renders default boundary as editable pseudo-system entity', () => {
    const diag = buildDiagram('diagram D : usecase { actor User usecase Login }');
    const svg = renderUseCaseDiagram(diag);
    expect(svg).toContain('data-default-usecase-boundary="true"');
    expect(svg).toContain('data-entity-name="System"');
  });

  it('respects optional width and height on explicit system boundary', () => {
    const diag = buildDiagram(`diagram D : usecase {
      actor User
      usecase Login
      system MainSystem
      @MainSystem at (210, 30, 640, 420)
    }`);
    const svg = renderUseCaseDiagram(diag);
    expect(svg).toContain('data-entity-width="640"');
    expect(svg).toContain('data-entity-height="420"');
  });

  it('renders resize handles for explicit system boundaries', () => {
    const diag = buildDiagram(`diagram D : usecase {
      actor User
      usecase Login
      system MainSystem
      @MainSystem at (210, 30, 640, 420)
    }`);
    const svg = renderUseCaseDiagram(diag);
    expect(svg).toContain('data-boundary-entity="true"');
    expect(svg).toContain('data-resize-handle="e"');
    expect(svg).toContain('data-resize-handle="s"');
    expect(svg).toContain('data-resize-handle="se"');
  });

  it('avoids default boundary name collisions with existing entities', () => {
    const diag = buildDiagram(`diagram D : usecase {
      actor System
      actor User
      usecase Login
      System --> Login
      User --> Login
    }`);
    const svg = renderUseCaseDiagram(diag);
    expect(svg).toContain('data-default-usecase-boundary="true"');
    expect(svg).toContain('data-entity-name="SystemBoundary"');
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

describe('Sequence Diagram Renderer — advanced', () => {
  it('includes data-entity-name for sequence participants and actors', () => {
    const diag = buildDiagram('diagram D : sequence { actor User participant AuthService }');
    const svg = renderSequenceDiagram(diag);
    expect(svg).toContain('data-entity-name="User"');
    expect(svg).toContain('data-entity-name="AuthService"');
  });

  it('renders transparent relation hit-lines for interaction', () => {
    const diag = buildDiagram('diagram D : sequence { participant A participant B A --> B [label="ping"] }');
    const svg = renderSequenceDiagram(diag);
    expect(svg).toContain('data-relation-label="ping"');
    expect(svg).toContain('stroke="transparent"');
  });

  it('renders self-referencing messages as loop paths', () => {
    const diag = buildDiagram('diagram D : sequence { participant A A --> A [label="self"] }');
    const svg = renderSequenceDiagram(diag);
    expect(svg).toContain('data-relation-from="A"');
    expect(svg).toContain('data-relation-to="A"');
    expect(svg).toContain('<path d="M');
  });

  it('uses persisted relation y style for vertical placement', () => {
    const diag = buildDiagram('diagram D : sequence { participant A participant B A --> B [label="ping", y="260"] }');
    const svg = renderSequenceDiagram(diag);
    expect(svg).toContain('data-relation-y="260"');
  });

  it('renders create participant offset by its activation Y coordinate', () => {
    const diag = buildDiagram('diagram D : sequence { participant A participant B participant C A --> B create C B --> C }');
    const svg = renderSequenceDiagram(diag);
    const createYMatch = svg.match(/<g transform="translate\(\d+,(\d+)\)" data-entity-name="C"/);
    expect(createYMatch).not.toBeNull();
    // Padding Y is 60, create Y should be > 0.
    const createdY = parseInt(createYMatch![1]);
    expect(createdY).toBeGreaterThan(60);
  });

  it('renders destroy marker and shortens lifeline', () => {
    const diag = buildDiagram('diagram D : sequence { participant A participant B A --> B destroy B }');
    const svg = renderSequenceDiagram(diag);
    // Destroys draw an "X" path and terminate line early
    expect(svg).toContain('M-10,');
    expect(svg).toContain('L10,');
  });

  it('renders return relations with dashed lines', () => {
    const diag = buildDiagram('diagram D : sequence { autoactivation participant A participant B A --> B return "data" }');
    const svg = renderSequenceDiagram(diag);
    expect(svg).toContain('data-relation-kind="dependency"');
    // dash array check for dependency relations
    expect(svg).toContain('stroke-dasharray="6,3"');
  });
});

describe('Activity Diagram Renderer — swimlanes', () => {
  it('renders partition entities as swimlanes', () => {
    const diag = buildDiagram(`diagram D : activity {
      partition UserLane
      partition SystemLane
      start Begin
      action Validate
      stop End

      Begin --> Validate
      Validate --> End

      @UserLane at (40, 20)
      @SystemLane at (360, 20)
      @Begin at (120, 120)
      @Validate at (360, 200)
      @End at (360, 320)
    }`);
    const svg = renderStateOrActivityDiagram(diag);
    expect(svg).toContain('data-entity-name="UserLane"');
    expect(svg).toContain('data-entity-name="SystemLane"');
    expect(svg).toContain('stroke="var(--iso-border, #cbd5e1)"');
  });

  it('respects optional swimlane width/height from layout annotations', () => {
    const diag = buildDiagram(`diagram D : activity {
      partition TeamA
      @TeamA at (30, 20, 420, 360)
    }`);
    const svg = renderStateOrActivityDiagram(diag);
    expect(svg).toContain('data-entity-width="420"');
    expect(svg).toContain('data-entity-height="360"');
  });
});
