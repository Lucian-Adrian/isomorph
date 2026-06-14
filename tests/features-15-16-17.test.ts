import { describe, it, expect } from 'vitest';
import { layoutLeftRight, layoutSnowflake, layoutCompact, computeLayout } from '../src/utils/auto-layout.js';

// ════════════════════════════════════════════════════════════════
// Feature 17 — Auto Layout Algorithm Tests
// ════════════════════════════════════════════════════════════════

describe('Auto Layout — Left-Right (Topological)', () => {
  it('assigns a single entity at the origin', () => {
    const { positions } = layoutLeftRight([{ name: 'A' }], []);
    expect(positions.size).toBe(1);
    expect(positions.get('A')).toEqual({ x: 80, y: 80 });
  });

  it('lays out a linear chain A→B→C in 3 columns', () => {
    const entities = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    const relations = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
    ];
    const { positions } = layoutLeftRight(entities, relations);

    // A should be in column 0, B in column 1, C in column 2
    const ax = positions.get('A')!.x;
    const bx = positions.get('B')!.x;
    const cx = positions.get('C')!.x;
    expect(ax).toBeLessThan(bx);
    expect(bx).toBeLessThan(cx);
  });

  it('places disconnected entities in the same layer', () => {
    const entities = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    const { positions } = layoutLeftRight(entities, []);

    // All have in-degree 0, so all should be in column 0
    expect(positions.get('A')!.x).toBe(positions.get('B')!.x);
    expect(positions.get('B')!.x).toBe(positions.get('C')!.x);
    // But different rows
    const ys = [positions.get('A')!.y, positions.get('B')!.y, positions.get('C')!.y];
    expect(new Set(ys).size).toBe(3);
  });

  it('handles a diamond DAG (A→B, A→C, B→D, C→D)', () => {
    const entities = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];
    const relations = [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'B', to: 'D' },
      { from: 'C', to: 'D' },
    ];
    const { positions } = layoutLeftRight(entities, relations);

    // A should be leftmost, D should be rightmost
    expect(positions.get('A')!.x).toBeLessThan(positions.get('D')!.x);
    // B and C should be between A and D
    expect(positions.get('B')!.x).toBeGreaterThan(positions.get('A')!.x);
    expect(positions.get('C')!.x).toBeGreaterThan(positions.get('A')!.x);
  });

  it('handles cyclic relations gracefully', () => {
    const entities = [{ name: 'A' }, { name: 'B' }];
    const relations = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' },
    ];
    const { positions } = layoutLeftRight(entities, relations);
    // Both should still get positions
    expect(positions.size).toBe(2);
    expect(positions.has('A')).toBe(true);
    expect(positions.has('B')).toBe(true);
  });

  it('returns empty map for empty entities', () => {
    const { positions } = layoutLeftRight([], []);
    expect(positions.size).toBe(0);
  });
});

describe('Auto Layout — Snowflake (Radial)', () => {
  it('places the single entity at center', () => {
    const { positions } = layoutSnowflake([{ name: 'Hub' }], []);
    expect(positions.get('Hub')).toEqual({ x: 500, y: 400 });
  });

  it('places the most-connected entity at center', () => {
    const entities = [{ name: 'A' }, { name: 'Hub' }, { name: 'B' }, { name: 'C' }];
    const relations = [
      { from: 'Hub', to: 'A' },
      { from: 'Hub', to: 'B' },
      { from: 'Hub', to: 'C' },
    ];
    const { positions } = layoutSnowflake(entities, relations);

    // Hub has degree 3, others have degree 1 → Hub should be at center
    expect(positions.get('Hub')).toEqual({ x: 500, y: 400 });
  });

  it('distributes ring entities around the center', () => {
    const entities = [{ name: 'Hub' }, { name: 'A' }, { name: 'B' }];
    const relations = [
      { from: 'Hub', to: 'A' },
      { from: 'Hub', to: 'B' },
    ];
    const { positions } = layoutSnowflake(entities, relations);

    // A and B should be at distance ~220 from center
    const hubPos = positions.get('Hub')!;
    const aPos = positions.get('A')!;
    const dist = Math.sqrt((aPos.x - hubPos.x) ** 2 + (aPos.y - hubPos.y) ** 2);
    expect(dist).toBeCloseTo(220, -1); // within ~10px tolerance
  });

  it('positions all entities', () => {
    const entities = Array.from({ length: 12 }, (_, i) => ({ name: `E${i}` }));
    const relations = entities.slice(1).map(e => ({ from: 'E0', to: e.name }));
    const { positions } = layoutSnowflake(entities, relations);
    expect(positions.size).toBe(12);
  });

  it('returns empty map for empty entities', () => {
    const { positions } = layoutSnowflake([], []);
    expect(positions.size).toBe(0);
  });
});

describe('Auto Layout — Compact (Grid)', () => {
  it('places a single entity at origin', () => {
    const { positions } = layoutCompact([{ name: 'A' }]);
    expect(positions.get('A')).toEqual({ x: 80, y: 80 });
  });

  it('lays out 4 entities in a 2×2 grid', () => {
    const entities = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];
    const { positions } = layoutCompact(entities);

    // sqrt(4) = 2 columns
    expect(positions.get('A')!.x).toBe(80); // col 0
    expect(positions.get('B')!.x).toBe(80 + 240); // col 1
    expect(positions.get('C')!.x).toBe(80); // col 0, row 1
    expect(positions.get('D')!.x).toBe(80 + 240); // col 1, row 1

    expect(positions.get('A')!.y).toBe(80); // row 0
    expect(positions.get('C')!.y).toBe(80 + 180); // row 1
  });

  it('returns empty map for empty entities', () => {
    const { positions } = layoutCompact([]);
    expect(positions.size).toBe(0);
  });
});

describe('computeLayout dispatcher', () => {
  const entities = [{ name: 'A' }, { name: 'B' }];
  const relations = [{ from: 'A', to: 'B' }];

  it('dispatches to left-right', () => {
    const result = computeLayout('left-right', entities, relations);
    expect(result.positions.size).toBe(2);
    // A should be left of B
    expect(result.positions.get('A')!.x).toBeLessThan(result.positions.get('B')!.x);
  });

  it('dispatches to snowflake', () => {
    const result = computeLayout('snowflake', entities, relations);
    expect(result.positions.size).toBe(2);
  });

  it('dispatches to compact', () => {
    const result = computeLayout('compact', entities, relations);
    expect(result.positions.size).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════
// Feature 15 — Cascade Offset Tests
// ════════════════════════════════════════════════════════════════

describe('Cascade Paste Offset', () => {
  // const offsetRegex = /@(\w+)\s+at\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)?\s*\)/g;

  function applyOffset(text: string, counter: number): string {
    return text.replace(/@(\w+)\s+at\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)?\s*\)/g, (_, n, x, y, sizeSuffix) => {
      const offset = 40 * counter;
      return `@${n} at (${Math.round(parseFloat(x) + offset)}, ${Math.round(parseFloat(y) + offset)}${sizeSuffix || ''})`;
    });
  }

  it('first paste offsets by 40', () => {
    const input = '@A at (100, 200)';
    const result = applyOffset(input, 1);
    expect(result).toBe('@A at (140, 240)');
  });

  it('second paste offsets by 80', () => {
    const input = '@A at (100, 200)';
    const result = applyOffset(input, 2);
    expect(result).toBe('@A at (180, 280)');
  });

  it('third paste offsets by 120', () => {
    const input = '@A at (100, 200)';
    const result = applyOffset(input, 3);
    expect(result).toBe('@A at (220, 320)');
  });

  it('preserves size suffix when present', () => {
    const input = '@Server at (0, 0, 200, 100)';
    const result = applyOffset(input, 1);
    expect(result).toBe('@Server at (40, 40, 200, 100)');
  });
});

// ════════════════════════════════════════════════════════════════
// Feature 16 — Unsaved Changes Detection Tests
// ════════════════════════════════════════════════════════════════

describe('Unsaved Changes Detection', () => {
  interface TabLike {
    source: string;
    savedSource?: string;
  }

  function hasUnsavedChanges(tabs: TabLike[]): boolean {
    return tabs.some(t => t.savedSource !== undefined && t.source !== t.savedSource);
  }

  it('returns false when source matches savedSource', () => {
    const tabs = [{ source: 'diagram D : class {}', savedSource: 'diagram D : class {}' }];
    expect(hasUnsavedChanges(tabs)).toBe(false);
  });

  it('returns true when source differs from savedSource', () => {
    const tabs = [{ source: 'diagram D : class { class A }', savedSource: 'diagram D : class {}' }];
    expect(hasUnsavedChanges(tabs)).toBe(true);
  });

  it('returns false when savedSource is undefined (legacy tab)', () => {
    const tabs = [{ source: 'some source' }];
    expect(hasUnsavedChanges(tabs)).toBe(false);
  });

  it('detects unsaved changes across multiple tabs', () => {
    const tabs = [
      { source: 'same', savedSource: 'same' },
      { source: 'changed', savedSource: 'original' },
    ];
    expect(hasUnsavedChanges(tabs)).toBe(true);
  });
});
