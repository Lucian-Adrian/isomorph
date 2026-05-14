import type { CanvasStyle } from '../canvas/canvasTypes.js';

export interface CanvasPropertiesStripProps {
  visible: boolean;
  style?: CanvasStyle;
}

export function CanvasPropertiesStrip({ visible, style }: CanvasPropertiesStripProps) {
  if (!visible || !style) return null;
  return (
    <div className="iso-canvas-properties-strip" aria-label="Canvas style controls">
      <span className="iso-swatch" style={{ background: style.text }} title="Text color" />
      <span className="iso-swatch" style={{ background: style.stroke }} title="Stroke color" />
      <span className="iso-swatch" style={{ background: style.fill }} title="Background color" />
      <span>{style.strokeWidth}px</span>
      <span>{Math.round(style.opacity * 100)}%</span>
    </div>
  );
}
