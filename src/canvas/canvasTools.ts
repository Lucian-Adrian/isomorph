import type { CanvasBounds, CanvasElement, CanvasElementKind, CanvasPoint, CanvasState, CanvasToolId } from './canvasTypes.js';

export const PRIMARY_CANVAS_TOOLS: CanvasToolId[] = [
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
];

export const MORE_CANVAS_TOOLS: CanvasToolId[] = ['frame', 'embed', 'laser', 'lasso', 'uml-package'];

export function boundsFromPoints(points: CanvasPoint[]): CanvasBounds {
  if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function boundsFromStartEnd(start: CanvasPoint, end: CanvasPoint): CanvasBounds {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.max(1, Math.abs(end.x - start.x));
  const height = Math.max(1, Math.abs(end.y - start.y));
  return { x, y, width, height };
}

export function elementsInBounds(state: CanvasState, bounds: CanvasBounds): string[] {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  return state.elements
    .filter(element => {
      const elementRight = element.bounds.x + element.bounds.width;
      const elementBottom = element.bounds.y + element.bounds.height;
      return element.bounds.x >= bounds.x && element.bounds.y >= bounds.y && elementRight <= right && elementBottom <= bottom;
    })
    .map(element => element.id);
}

export function elementsIntersectingBounds(state: CanvasState, bounds: CanvasBounds): string[] {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  return state.elements
    .filter(element => {
      const elementRight = element.bounds.x + element.bounds.width;
      const elementBottom = element.bounds.y + element.bounds.height;
      return element.bounds.x <= right
        && elementRight >= bounds.x
        && element.bounds.y <= bottom
        && elementBottom >= bounds.y;
    })
    .map(element => element.id);
}

export function createCanvasElement(input: {
  id: string;
  kind: Exclude<CanvasElementKind, 'unknown'>;
  bounds: CanvasBounds;
  style: CanvasState['styleDefaults'];
  now?: string;
  text?: string;
  points?: CanvasPoint[];
  src?: string;
  url?: string;
}): CanvasElement {
  const now = input.now || new Date().toISOString();
  const base = {
    id: input.id,
    kind: input.kind,
    bounds: input.bounds,
    rotation: 0,
    locked: false,
    layer: 0,
    style: input.style,
    createdAt: now,
    updatedAt: now,
  };

  if (input.kind === 'arrow' || input.kind === 'line') {
    return { ...base, kind: input.kind, points: input.points || [] };
  }
  if (input.kind === 'pen' || input.kind === 'eraser' || input.kind === 'laser' || input.kind === 'lasso') {
    return { ...base, kind: input.kind, points: input.points || [] };
  }
  if (input.kind === 'text') {
    return { ...base, kind: 'text', text: input.text || 'Text', fontSize: 16 };
  }
  if (input.kind === 'image') {
    return { ...base, kind: 'image', src: input.src || '', alt: input.text || 'Canvas image', fit: 'contain' };
  }
  if (input.kind === 'embed') {
    return { ...base, kind: 'embed', url: input.url || '', title: input.text };
  }
  if (input.kind === 'frame' || input.kind === 'uml-package') {
    return { ...base, kind: input.kind, title: input.text || (input.kind === 'frame' ? 'Frame' : 'Package'), children: [] };
  }
  return { ...base, kind: input.kind, text: input.text };
}
