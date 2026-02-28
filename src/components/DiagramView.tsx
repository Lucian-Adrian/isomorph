// ============================================================
// DiagramView — SVG Diagram React Component
// ============================================================

import { useRef, useEffect } from 'react';
import type { IOMDiagram } from '../semantics/iom.js';
import { renderDiagram } from '../renderer/index.js';

interface DiagramViewProps {
  diagram: IOMDiagram | null;
  onEntityMove?: (entityName: string, x: number, y: number) => void;
}

export function DiagramView({ diagram, onEntityMove }: DiagramViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Render SVG into the container div
  useEffect(() => {
    if (!containerRef.current) return;
    if (!diagram) {
      containerRef.current.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8c959f;font-family:sans-serif;font-size:14px;flex-direction:column;gap:8px">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 9h6M9 12h6M9 15h4"/>
          </svg>
          <span>Write some Isomorph code to see your diagram here.</span>
        </div>`;
      return;
    }
    const svg = renderDiagram(diagram);
    containerRef.current.innerHTML = svg;

    // Make entity groups draggable
    if (onEntityMove) {
      attachDragHandlers(containerRef.current, diagram, onEntityMove);
    }
  }, [diagram, onEntityMove]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        background: '#fafafa',
        borderRadius: '6px',
        border: '1px solid #d0d7de',
      }}
    />
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

  // Entity boxes are <g> elements with transform="translate(x,y)"
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
      const nx = origX + dx, ny = origY + dy;
      g.setAttribute('transform', `translate(${nx},${ny})`);
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
