import { describe, it, expect } from 'vitest';
import { formatDiagramSource, updateEntityPosition } from '../src/services/sourceRewrite.ts';

describe('Source Rewrite Formatter Idempotence', () => {
  it('formats source idempotently', () => {
    const source1 = `diagram D : class {
  class A {}
  class B {}
  A --> B
  @A at (10, 20)
}`;
    const formatted1 = formatDiagramSource(source1);
    const formatted2 = formatDiagramSource(formatted1);
    expect(formatted1).toBe(formatted2);
  });

  it('formats edge cases logically and idempotently', () => {
    const sourceWithGaps = `diagram D : component {
    component A
        

    @A at (10, 10, 100, 50)
}`;
    const formatted1 = formatDiagramSource(sourceWithGaps);
    const formatted2 = formatDiagramSource(formatted1);
    expect(formatted1).toBe(formatted2);
    // Should strip extra spaces effectively depending on the formatter
    expect(formatted1.split('\n').filter(l => l.trim() === '').length).toBeLessThan(3);
  });

  it('updates entity position idempotently without breaking formatting', () => {
    const source1 = `diagram D : deployment {
  node Server
  @Server at (0, 0, 100, 100)
}`;
    // moving Server
    const modified1 = updateEntityPosition(source1, 'Server', 50, 50, 200, 200);
    const formatted1 = formatDiagramSource(modified1);
    
    // changing nothing should be basically identical
    const modified2 = updateEntityPosition(formatted1, 'Server', 50, 50, 200, 200);
    const formatted2 = formatDiagramSource(modified2);

    expect(formatted1).toBe(formatted2);
  });

  it('keeps component bodies, relations, and annotations stable across repeated modal-like edits', () => {
    const source = `diagram StableComponents : component {
  component Api {
    port http
  }
  component Worker {
    port jobs
  }
  Api --> Worker [label="dispatch"]
  @Api at (15, 25, 160, 90)
  @Worker at (260, 25, 160, 90)
}`;

    const firstEdit = formatDiagramSource(source.replace('component Api', 'component Api <<service>>'));
    const secondEdit = formatDiagramSource(firstEdit.replace('label="dispatch"', 'label="dispatch jobs"'));
    const thirdEdit = formatDiagramSource(updateEntityPosition(secondEdit, 'Worker', 275, 40, 170, 95));
    const stable = formatDiagramSource(thirdEdit);

    expect(thirdEdit).toBe(stable);
    expect(stable).toContain('component Api <<service>> {');
    expect(stable).toContain('port http');
    expect(stable).toContain('Api --> Worker [label="dispatch jobs"]');
    expect(stable).toContain('@Worker at (275, 40, 170, 95)');
  });

  it('does not duplicate relation attributes after repeated relation edit rewrites', () => {
    const source = `diagram Relations : class {
  class User {}
  class Order {}
  User --> Order [label="places"]
  @User at (10, 10)
  @Order at (240, 10)
}`;

    const first = formatDiagramSource(source.replace('[label="places"]', '[label="places", toMult="*"]'));
    const second = formatDiagramSource(first.replace('toMult="*"', 'toMult="1..*"'));
    const third = formatDiagramSource(second.replace('label="places"', 'label="creates"'));

    expect(third).toBe(formatDiagramSource(third));
    expect(third.match(/label="/g)).toHaveLength(1);
    expect(third.match(/toMult="/g)).toHaveLength(1);
    expect(third).toContain('User --> Order [label="creates", toMult="1..*"]');
  });
});
