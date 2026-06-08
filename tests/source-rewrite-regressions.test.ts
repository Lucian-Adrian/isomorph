import { describe, expect, it } from 'vitest';
import { parse } from '../src/parser/index.js';
import {
  formatDiagramSource,
  insertSequenceLifecycleRelation,
  removeEntityAndRelations,
  updateEntityPosition,
  updateRelationById,
} from '../src/services/sourceRewrite.js';

function expectParseable(source: string) {
  expect(parse(source).errors).toEqual([]);
}

describe('source rewrite relation/component regressions', () => {
  it('keeps component provides/requires relations grouped before annotations', () => {
    const source = `diagram Components : component {
  component A
  component B
  @A at (10, 20)
  A --() B [label="API"]
  B --( A
}`;

    const formatted = formatDiagramSource(formatDiagramSource(source));
    expect(formatted.indexOf('A --() B')).toBeLessThan(formatted.indexOf('@A at'));
    expect(formatted).toContain('B --( A');
    expectParseable(formatted);
  });

  it('removes provides/requires relations when deleting a component', () => {
    const source = `diagram Components : component {
  component A
  component B
  A --() B
  B --( A
  @A at (10, 20)
}`;

    const next = removeEntityAndRelations(source, 'A');
    expect(next).not.toContain('component A');
    expect(next).not.toContain('--()');
    expect(next).not.toContain('--(');
    expect(next).not.toContain('@A at');
    expectParseable(next);
  });

  it('updates, clears, escapes, and reverses relation attributes without duplication', () => {
    const source = `diagram Components : component {
  component A
  component B
  A --() B [label="API", fromMult="1", toMult="*"]
}`;

    const labelled = updateRelationById(source, 'rel_0', { label: 'REST "v2"', fromMult: '', toMult: '', direction: 'reverse', kind: 'requires' });
    expect(labelled).toContain('B --( A [label="REST \\"v2\\""]');
    expect(labelled).not.toContain('fromMult=');
    expect(labelled).not.toContain('toMult=');
    expect(labelled.match(/label=/g)).toHaveLength(1);
    expectParseable(labelled);

    const cleared = updateRelationById(labelled, 'rel_0', { label: '' });
    expect(cleared).not.toContain('label=');
    expectParseable(cleared);
  });

  it('updates relation attributes when relations use qualified names and trailing comments', () => {
    const source = `diagram Sys : class {
  class domain.Book
  class ext.Library
  domain.Book --> ext.Library [label="reads"] // optional comment here
}`;

    const next = updateRelationById(source, 'rel_0', { label: 'queries' });
    expect(next).toContain('domain.Book --> ext.Library [label="queries"]');
    expectParseable(next);
  });

  it('inserts sequence create and destroy lifecycle relations into the requested diagram only', () => {
    const source = `diagram One : sequence {
  participant A
  participant B
}

diagram Two : sequence {
  participant A
  participant B
}`;

    const created = insertSequenceLifecycleRelation(source, 'Two', 'A', 'B', 'create', 144);
    const destroyed = insertSequenceLifecycleRelation(created, 'Two', 'B', 'A', 'destroy', 188);

    expect(destroyed).toContain('A --> create B [y="144"]');
    expect(destroyed).toContain('B --> destroy A [y="188"]');
    expect(destroyed.indexOf('diagram Two')).toBeLessThan(destroyed.indexOf('A --> create B [y="144"]'));
    expect(destroyed.indexOf('diagram One')).toBeLessThan(destroyed.indexOf('diagram Two'));
    expectParseable(destroyed);
  });

  it('updates entity positions inside the requested diagram block only', () => {
    const source = `diagram One : class {
  class A
}

diagram Two : class {
  class A
}`;

    const next = updateEntityPosition(source, 'A', 10, 20, 100, 80, 'One');
    expect(next).toContain('diagram One : class {\n  class A\n  @A at (10, 20, 100, 80)\n}');
    expect(next).toContain('diagram Two : class {\n  class A\n}');
    expectParseable(next);
  });
});
