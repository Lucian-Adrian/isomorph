import { describe, it, expect } from 'vitest';
import { formatDiagramSource, updateEntityPosition } from '../src/App.tsx';

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
});
