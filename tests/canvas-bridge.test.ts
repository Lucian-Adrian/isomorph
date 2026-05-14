import { describe, expect, it } from 'vitest';
import { decideCanvasPersistence } from '../src/canvas/canvasBridge.js';
import { createEmptyCanvasState } from '../src/canvas/canvasSerialization.js';
import { createCanvasElement } from '../src/canvas/canvasTools.js';
import { applyIsxCanvasCommand } from '../src/canvas/isxCanvasCommands.js';

describe('canvas bridge persistence decisions', () => {
  it('stores freeform elements in canvas_state and semantic elements in .isx', () => {
    const state = createEmptyCanvasState();
    const rect = createCanvasElement({
      id: 'rect-1',
      kind: 'rectangle',
      bounds: { x: 0, y: 0, width: 100, height: 80 },
      style: state.styleDefaults,
    });
    const semantic = { ...rect, semanticRef: 'Entity:User' };

    expect(decideCanvasPersistence(rect)).toMatchObject({ target: 'canvas_state' });
    expect(decideCanvasPersistence(semantic)).toMatchObject({ target: 'isx' });
  });

  it('applies semantic move commands through safe source rewrite helpers', () => {
    const source = `diagram One : class {\n  class A\n}`;
    expect(applyIsxCanvasCommand(source, { type: 'move-entity', entityName: 'A', x: 1, y: 2 })).toContain('@A at (1, 2)');
  });
});
