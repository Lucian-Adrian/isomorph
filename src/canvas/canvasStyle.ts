import type { CanvasStyle } from './canvasTypes.js';

export const DEFAULT_CANVAS_STYLE: CanvasStyle = {
  stroke: '#1f2937',
  fill: '#ffffff',
  text: '#111827',
  strokeWidth: 2,
  opacity: 1,
  roughness: 0,
};

export function normalizeCanvasStyle(style: Partial<CanvasStyle> | null | undefined): CanvasStyle {
  return {
    ...DEFAULT_CANVAS_STYLE,
    ...(style || {}),
    strokeWidth: Math.max(1, Number(style?.strokeWidth ?? DEFAULT_CANVAS_STYLE.strokeWidth)),
    opacity: Math.min(1, Math.max(0, Number(style?.opacity ?? DEFAULT_CANVAS_STYLE.opacity))),
    roughness: Math.min(1, Math.max(0, Number(style?.roughness ?? DEFAULT_CANVAS_STYLE.roughness))),
  };
}
