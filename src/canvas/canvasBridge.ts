import type { CanvasElement } from './canvasTypes.js';

export interface CanvasBridgeDecision {
  target: 'isx' | 'canvas_state';
  reason: string;
}

const SEMANTIC_KINDS = new Set(['uml-package']);

export function decideCanvasPersistence(element: CanvasElement): CanvasBridgeDecision {
  if (element.semanticRef || SEMANTIC_KINDS.has(element.kind)) {
    return { target: 'isx', reason: 'Element is linked to the semantic diagram model.' };
  }
  return { target: 'canvas_state', reason: 'Freeform canvas element is stored beside .isx to avoid grammar corruption.' };
}
