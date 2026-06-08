import { describe, it, expect } from 'vitest';
import { EXAMPLES } from '../src/data/examples.js';
import { parse } from '../src/parser/index.js';
import { analyze } from '../src/semantics/analyzer.js';
import { renderDiagram } from '../src/renderer/index.js';

describe('Built-in examples', () => {
  for (const example of EXAMPLES) {
    it(`parses and renders: ${example.label}`, () => {
      const { program, errors } = parse(example.source);
      expect(errors).toHaveLength(0);

      const { iom } = analyze(program);
      expect(iom.diagrams).toHaveLength(1);

      const svg = renderDiagram(iom.diagrams[0]);
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });
  }
});
