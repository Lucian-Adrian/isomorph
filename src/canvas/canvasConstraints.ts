import type { CanvasPoint } from './canvasTypes.js';

/**
 * Constrain a shape's end point so width === height (perfect square / circle).
 * The constraint keeps the starting corner fixed and adjusts the end corner
 * so the dominant axis length applies to both dimensions.
 */
export function constrainToSquare(start: CanvasPoint, end: CanvasPoint): CanvasPoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: start.x + size * Math.sign(dx || 1),
    y: start.y + size * Math.sign(dy || 1),
  };
}

/**
 * Snap a line's end point to the nearest 45° increment (0/45/90/135/180/225/270/315).
 * This gives perfectly horizontal, vertical, or 45° diagonal lines.
 */
export function constrainLineAngle(start: CanvasPoint, end: CanvasPoint): CanvasPoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 1) return end;

  const angle = Math.atan2(dy, dx);
  const step = Math.PI / 4; // 45°
  const snapped = Math.round(angle / step) * step;

  return {
    x: start.x + length * Math.cos(snapped),
    y: start.y + length * Math.sin(snapped),
  };
}

/**
 * Convert a screen-space point into world-space, given the current viewport.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  panX: number,
  panY: number,
  zoom: number,
): CanvasPoint {
  return {
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom,
  };
}

/**
 * Convert a world-space point into screen-space.
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  panX: number,
  panY: number,
  zoom: number,
): CanvasPoint {
  return {
    x: worldX * zoom + panX,
    y: worldY * zoom + panY,
  };
}

/**
 * Compute the zoom+pan adjustment to zoom toward a screen-space focus point.
 * Returns the new pan offsets that keep the focus point visually stationary.
 */
export function zoomTowardPoint(
  focusScreenX: number,
  focusScreenY: number,
  oldPanX: number,
  oldPanY: number,
  oldZoom: number,
  newZoom: number,
): { panX: number; panY: number; zoom: number } {
  const worldX = (focusScreenX - oldPanX) / oldZoom;
  const worldY = (focusScreenY - oldPanY) / oldZoom;
  return {
    panX: focusScreenX - worldX * newZoom,
    panY: focusScreenY - worldY * newZoom,
    zoom: newZoom,
  };
}

/**
 * Clamp zoom to safe range.
 */
export function clampZoom(zoom: number): number {
  return Math.min(8, Math.max(0.1, zoom));
}

/**
 * Hit-test: check if a world-space point is inside an element's bounding box.
 */
export function pointInBounds(px: number, py: number, bounds: { x: number; y: number; width: number; height: number }): boolean {
  return px >= bounds.x && px <= bounds.x + bounds.width && py >= bounds.y && py <= bounds.y + bounds.height;
}
