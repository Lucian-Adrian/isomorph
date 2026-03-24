import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser/index.js';
import { analyze } from '../src/semantics/analyzer.js';
import { renderClassDiagram } from '../src/renderer/class-renderer.js';
import { renderSequenceDiagram } from '../src/renderer/sequence-renderer.js';

function buildDiagram(source: string) {
  const { program, errors } = parse(source);
  if (errors.length > 0) throw new Error(errors[0].message);
  const { iom } = analyze(program);
  return iom.diagrams[0];
}

describe('DSL Configuration Features (Phase 1)', () => {
  it('parses and analyzes global configurations', () => {
    const diag = buildDiagram(`
      diagram D : class {
        title "System Architecture"
        subtitle "Component Overview"
        caption "Generated automatically"
        legend "Blue = Internal"
        strict
        direction LR
      }
    `);
    expect(diag.config?.title).toBe("System Architecture");
    expect(diag.config?.subtitle).toBe("Component Overview");
    expect(diag.config?.caption).toBe("Generated automatically");
    expect(diag.config?.legend).toBe("Blue = Internal");
    expect(diag.config?.strict).toBe(true);
    expect(diag.config?.direction).toBe("LR");
  });

  it('renders decorations in Class Diagrams', () => {
    const diag = buildDiagram(`
      diagram D : class {
        title "Decorated Chart"
        caption "Diagram Footer"
        legend "Ref Legend"
        class Box {}
      }
    `);
    const svg = renderClassDiagram(diag);
    expect(svg).toContain('Decorated Chart');
    expect(svg).toContain('Diagram Footer');
    expect(svg).toContain('Ref Legend');
  });

  it('implements sequence diagram autonumbering', () => {
    const diag = buildDiagram(`
      diagram D : sequence {
        autonumber
        participant Alice
        participant Bob
        Alice --> Bob [label="Hello"]
        Bob --> Alice [label="Hi"]
      }
    `);
    const svg = renderSequenceDiagram(diag);
    expect(svg).toContain('1. Hello');
    expect(svg).toContain('2. Hi');
  });

  it('disables autonumbering by default', () => {
    const diag = buildDiagram(`
      diagram D : sequence {
        participant Alice
        participant Bob
        Alice --> Bob [label="Hello"]
      }
    `);
    const svg = renderSequenceDiagram(diag);
    expect(svg).not.toContain('1. Hello');
    expect(svg).toContain('Hello');
  });
});
