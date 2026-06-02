import { describe, expect, it } from 'vitest';
import { canvasStorageKeyForTab, restoreRemoteCanvasState } from '../src/app/remoteCanvasState.js';

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('remote canvas state restore', () => {
  it('restores a saved canvas_state into the new tab storage key', () => {
    const storage = createStorage();
    const restored = restoreRemoteCanvasState('tab-restored', JSON.stringify({
      version: 1,
      activeTool: 'select',
      elements: [
        {
          id: 'rect-1',
          kind: 'rectangle',
          layer: 4,
          bounds: { x: 10, y: 20, width: 120, height: 80 },
          style: { stroke: '#111111', fill: '#ffffff', text: '#111111', strokeWidth: 2, opacity: 1 },
          locked: false,
          createdAt: '2026-05-24T00:00:00.000Z',
          updatedAt: '2026-05-24T00:00:00.000Z',
        },
      ],
      selectedElementIds: ['rect-1'],
    }), storage);

    expect(restored).toBe(true);
    const saved = JSON.parse(storage.values.get(canvasStorageKeyForTab('tab-restored')) ?? '{}');
    expect(saved.elements).toHaveLength(1);
    expect(saved.elements[0]).toMatchObject({ id: 'rect-1', kind: 'rectangle' });
    expect(saved.selectedElementIds).toEqual(['rect-1']);
  });

  it('clears the tab canvas key when a remote diagram has no canvas_state', () => {
    const storage = createStorage();
    storage.values.set(canvasStorageKeyForTab('tab-empty'), '{"version":1}');

    const restored = restoreRemoteCanvasState('tab-empty', null, storage);

    expect(restored).toBe(false);
    expect(storage.values.has(canvasStorageKeyForTab('tab-empty'))).toBe(false);
  });
});
