// ============================================================
// DiagramView — SVG Diagram Canvas Component (v2)
// ============================================================

import { useRef, useEffect, useState, useCallback } from 'react';
import type { IOMDiagram } from '../semantics/iom.js';
import { renderDiagram } from '../renderer/index.js';

interface DiagramViewProps {
  diagram: IOMDiagram | null;
  onEntityMove?: (entityName: string, x: number, y: number) => void;
  onExportSVG?: () => void;
}

export function DiagramView({ diagram, onEntityMove }: DiagramViewProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);

  const handleZoomIn  = useCallback(() => setZoom(z => Math.min(z + 20, 200)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z - 20, 40)), []);
  const handleFit     = useCallback(() => setZoom(100), []);

  // Render SVG into container on diagram change
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!diagram) {
      el.innerHTML = '';
      return;
    }

    const svg = renderDiagram(diagram);
    el.innerHTML = svg;

    if (onEntityMove) attachDragHandlers(el, diagram, onEntityMove);
  }, [diagram, onEntityMove]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Empty state */}
      {!diagram && (
        <div className="iso-canvas-empty" aria-hidden="true">
          <svg className="iso-canvas-empty-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="2" y="3" width="9" height="7" rx="1.5"/>
            <rect x="13" y="3" width="9" height="7" rx="1.5"/>
            <rect x="7" y="14" width="10" height="7" rx="1.5"/>
            <line x1="6.5" y1="10" x2="6.5" y2="13"/>
            <line x1="17.5" y1="10" x2="17.5" y2="13"/>
            <line x1="6.5" y1="13" x2="12" y2="13"/>
            <line x1="17.5" y1="13" x2="12" y2="13"/>
            <line x1="12" y1="13" x2="12" y2="14"/>
          </svg>
          <span className="iso-canvas-empty-title">No diagram yet</span>
          <span className="iso-canvas-empty-sub">
            Write Isomorph code in the editor on the left, or load an example from the toolbar.
          </span>
        </div>
      )}

      {/* SVG canvas with zoom */}
      <div
        className="iso-canvas-wrap"
        role="img"
        aria-label={diagram ? `${diagram.name} ${diagram.kind} diagram` : 'Diagram canvas'}
        style={{ display: diagram ? undefined : 'none' }}
      >
        <div
          ref={containerRef}
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top left',
            display: 'inline-block',
            transition: 'transform 150ms cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </div>

      {/* Zoom controls */}
      {diagram && (
        <div className="iso-canvas-toolbar" role="group" aria-label="Zoom controls">
          <button
            type="button"
            className="iso-canvas-btn"
            onClick={handleZoomOut}
            aria-label="Zoom out"
            disabled={zoom <= 40}
            data-tooltip="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="iso-canvas-btn"
            onClick={handleFit}
            aria-label={`Reset zoom (currently ${zoom}%)`}
            style={{ width: 44, fontSize: 11 }}
          >
            {zoom}%
          </button>
          <button
            type="button"
            className="iso-canvas-btn"
            onClick={handleZoomIn}
            aria-label="Zoom in"
            disabled={zoom >= 200}
            data-tooltip="Zoom in"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Drag-to-update ──────────────────────────────────────────

function attachDragHandlers(
  container: HTMLDivElement,
  diagram: IOMDiagram,
  onEntityMove: (name: string, x: number, y: number) => void,
) {
  const svg = container.querySelector('svg');
  if (!svg) return;

  const groups = svg.querySelectorAll<SVGGElement>('g[transform]');
  const entityList = [...diagram.entities.values()];

  groups.forEach((g, idx) => {
    const entity = entityList[idx];
    if (!entity) return;

    let dragging = false;
    let startX = 0, startY = 0, origX = 0, origY = 0;

    g.style.cursor = 'grab';

    const onMouseDown = (e: MouseEvent) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const tf = g.getAttribute('transform') ?? '';
      const m = tf.match(/translate\(([^,]+),([^)]+)\)/);
      origX = m ? parseFloat(m[1]) : 0;
      origY = m ? parseFloat(m[2]) : 0;
      g.style.cursor = 'grabbing';
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const svgRect = svg.getBoundingClientRect();
      const scaleX = parseFloat(svg.getAttribute('width') ?? '800') / svgRect.width;
      const scaleY = parseFloat(svg.getAttribute('height') ?? '600') / svgRect.height;
      const dx = (e.clientX - startX) * scaleX;
      const dy = (e.clientY - startY) * scaleY;
      g.setAttribute('transform', `translate(${origX + dx},${origY + dy})`);
    };

    const onMouseUp = (_e: MouseEvent) => {
      if (!dragging) return;
      dragging = false;
      g.style.cursor = 'grab';
      const tf = g.getAttribute('transform') ?? '';
      const m = tf.match(/translate\(([^,]+),([^)]+)\)/);
      if (m) {
        onEntityMove(entity.name, Math.round(parseFloat(m[1])), Math.round(parseFloat(m[2])));
      }
    };

    g.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}

