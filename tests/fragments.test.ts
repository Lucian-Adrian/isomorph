import { describe, it, expect } from 'vitest';
import { lex } from '../src/parser/lexer.js';
import { Parser } from '../src/parser/parser.js';
import { analyzeDiagram } from '../src/semantics/analyzer.js';
import type { IOMFragment } from '../src/semantics/iom.js';

describe('Sequence Fragments', () => {
  it('should parse and analyze altitude/loop fragments', () => {
    const dsl = `
    diagram Test : sequence {
      participant A
      participant B
      participant C
      A -> B [label="msg1"]
      alt "Success" {
        B -> C [label="ok"]
      } else "Failure" {
        B -> A [label="fail"]
      }
      loop "Retries" {
        A -> B [label="retry"]
      }
    }
    `;
    const { tokens } = lex(dsl);
    const parser = new Parser(tokens);
    const res = parser.parse();
    if (res.errors.length > 0) {
       console.log('Parser Errors:', JSON.stringify(res.errors, null, 2));
    }
    expect(res.errors).toHaveLength(0);

    const iom = analyzeDiagram(res.program.diagrams[0], []);
    expect(iom.fragments).toHaveLength(2);
    
    // Alt fragment
    const alt = iom.fragments.find((f: IOMFragment) => f.kind === 'alt');
    expect(alt).toBeDefined();
    expect(alt?.label).toBe('Success');
    expect(alt?.relationIds).toHaveLength(1);
    expect(alt?.elseBlocks).toHaveLength(1);
    expect(alt?.elseBlocks?.[0].label).toBe('Failure');
    expect(alt?.elseBlocks?.[0].relationIds).toHaveLength(1);

    // Loop fragment
    const loop = iom.fragments.find((f: IOMFragment) => f.kind === 'loop');
    expect(loop).toBeDefined();
    expect(loop?.label).toBe('Retries');
    expect(loop?.relationIds).toHaveLength(1);
  });
});
