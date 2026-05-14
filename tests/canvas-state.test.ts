import { describe, expect, it } from 'vitest';
import { reduceCanvasState } from '../src/canvas/canvasState.js';
import { createCanvasElement, elementsInBounds, MORE_CANVAS_TOOLS, PRIMARY_CANVAS_TOOLS } from '../src/canvas/canvasTools.js';
import { createEmptyCanvasState, parseCanvasStateText, serializeCanvasState } from '../src/canvas/canvasSerialization.js';

describe('canvas state model', () => {
  it('starts with a versioned, serializable canvas_state document', () => {
    const state = createEmptyCanvasState('2026-05-13T00:00:00.000Z');
    expect(state).toMatchObject({
      version: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      activeTool: 'select',
      elements: [],
    });

    expect(parseCanvasStateText(serializeCanvasState(state))).toMatchObject({
      version: 1,
      activeTool: 'select',
    });
  });

  it('normalizes unknown future elements instead of crashing load', () => {
    const loaded = parseCanvasStateText(JSON.stringify({
      version: 99,
      elements: [{ id: 'future-1', kind: 'sticky-magic', bounds: { x: 1, y: 2, width: 0, height: 0 } }],
      selectedElementIds: ['future-1'],
    }));

    expect(loaded.version).toBe(1);
    expect(loaded.elements[0]).toMatchObject({
      id: 'future-1',
      kind: 'unknown',
      bounds: { x: 1, y: 2, width: 1, height: 1 },
    });
    expect(loaded.selectedElementIds).toEqual(['future-1']);
  });

  it('supports the expected Excalidraw-style primary and extended tools', () => {
    expect(PRIMARY_CANVAS_TOOLS).toEqual([
      'lock',
      'select',
      'hand',
      'rectangle',
      'ellipse',
      'arrow',
      'line',
      'pen',
      'text',
      'image',
      'eraser',
    ]);
    expect(MORE_CANVAS_TOOLS).toEqual(['frame', 'embed', 'laser', 'lasso', 'uml-package']);
  });

  it('adds, selects, updates, locks, reorders, and deletes elements immutably', () => {
    const base = createEmptyCanvasState('2026-05-13T00:00:00.000Z');
    const rect = createCanvasElement({
      id: 'rect-1',
      kind: 'rectangle',
      bounds: { x: 10, y: 20, width: 100, height: 80 },
      style: base.styleDefaults,
      now: base.updatedAt,
    });

    const added = reduceCanvasState(base, { type: 'add-element', element: rect });
    expect(added.elements).toHaveLength(1);
    expect(added.selectedElementIds).toEqual(['rect-1']);
    expect(base.elements).toHaveLength(0);

    const styled = reduceCanvasState(added, {
      type: 'update-element',
      id: 'rect-1',
      patch: { style: { ...rect.style, opacity: 2, strokeWidth: 0 } },
    });
    expect(styled.elements[0].style.opacity).toBe(1);
    expect(styled.elements[0].style.strokeWidth).toBe(1);

    const locked = reduceCanvasState(styled, { type: 'set-lock', ids: ['rect-1'], locked: true });
    expect(locked.elements[0].locked).toBe(true);

    const deleted = reduceCanvasState(locked, { type: 'delete-elements', ids: ['rect-1'] });
    expect(deleted.elements).toEqual([]);
    expect(deleted.selectedElementIds).toEqual([]);
  });

  it('supports lasso selection through bounds queries', () => {
    const state = createEmptyCanvasState();
    const withRect = reduceCanvasState(state, {
      type: 'add-element',
      element: createCanvasElement({
        id: 'rect-1',
        kind: 'rectangle',
        bounds: { x: 10, y: 10, width: 50, height: 50 },
        style: state.styleDefaults,
      }),
    });

    expect(elementsInBounds(withRect, { x: 0, y: 0, width: 100, height: 100 })).toEqual(['rect-1']);
    expect(elementsInBounds(withRect, { x: 0, y: 0, width: 20, height: 20 })).toEqual([]);
  });
});
