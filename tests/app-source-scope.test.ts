import { describe, expect, it } from 'vitest';
import {
  formatDiagramSource,
  replaceEntityBody,
  updateEntityDeclaration,
  updateRelationById,
} from '../src/App.js';
import { parse } from '../src/parser/index.js';

function expectParseable(source: string) {
  expect(parse(source).errors).toEqual([]);
}

describe('App source rewrite scoping', () => {
  it('edits duplicate entity names only inside the active diagram block', () => {
    const source = `diagram One : class {
  class A {
    + one: string
  }
  class B
  A --> B [label="first"]
}

diagram Two : class {
  class A {
    + two: string
  }
  class B
  A --> B [label="second"]
}`;

    const renamed = updateEntityDeclaration(source, 'A', { name: 'Renamed', kind: 'class' }, 'Two');
    const withBody = replaceEntityBody(renamed, 'Renamed', '+ edited: int', 'Two');
    const withRelation = updateRelationById(withBody, 'rel_0', { label: 'updated' }, 'class', 'Two');
    const formatted = formatDiagramSource(withRelation, 'Two');

    const oneBlock = formatted.slice(formatted.indexOf('diagram One'), formatted.indexOf('diagram Two'));
    const twoBlock = formatted.slice(formatted.indexOf('diagram Two'));

    expect(oneBlock).toContain('class A');
    expect(oneBlock).toContain('+ one: string');
    expect(oneBlock).toContain('A --> B [label="first"]');
    expect(oneBlock).not.toContain('Renamed');
    expect(oneBlock).not.toContain('updated');

    expect(twoBlock).toContain('class Renamed');
    expect(twoBlock).toContain('+ edited: int');
    expect(twoBlock).toContain('Renamed --> B [label="updated"]');
    expect(twoBlock).not.toContain('+ one: string');
    expectParseable(formatted);
  });
});
