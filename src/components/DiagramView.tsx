// ============================================================
// DiagramView — SVG Diagram Canvas Component (v2)
// ============================================================

import { useRef, useEffect, useState, useCallback } from 'react';
import type { IOMDiagram } from '../semantics/iom.js';
import { renderDiagram } from '../renderer/index.js';

export type CanvasTool = 'move' | 'hand' | 'edit-node' | 'edit-edge';

interface DiagramViewProps {
  diagram: IOMDiagram | null;
  onEntityMove?: (entityName: string, x: number, y: number) => void;
  onEntityEditRequest?: (entityName: string, currentName: string, currentStereotype: string) => void;
  onRelationEditRequest?: (relationId: string, currentLabel: string, currentKind: string) => void;
  onExportSVG?: () => void;
  onDropEntity?: (keyword: string, x: number, y: number) => void;
  availableTools?: CanvasTool[];
}

export function DiagramView({
  diagram,
  onEntityMove,
  onEntityEditRequest,
  onRelationEditRequest,
  onExportSVG,
  onDropEntity,
  availableTools = ['move', 'hand', 'edit-node', 'edit-edge'],
}: DiagramViewProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<CanvasTool>('move');

  const dragRef = useRef<{
    mode: 'none' | 'entity' | 'pan';
    pointerId: number;
    startClientX: number;
    startClientY: number;
    entityName?: string;
    entityGroup?: SVGGElement;
    entityOrigX?: number;
    entityOrigY?: number;
    panStartX?: number;
    panStartY?: number;
  }>({ mode: 'none', pointerId: -1, startClientX: 0, startClientY: 0 });

  useEffect(() => {
    if (!availableTools.includes(activeTool)) {
      setActiveTool(availableTools[0] ?? 'move');
    }
  }, [availableTools, activeTool]);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [diagram?.name]);

  const handleZoomIn  = useCallback(() => setZoom(z => Math.min(z + 20, 200)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z - 20, 40)), []);
  const handleFit     = useCallback(() => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  }, []);

  // Keyboard shortcut: Ctrl+E → export SVG
  useEffect(() => {
    if (!onExportSVG) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'e') { e.preventDefault(); onExportSVG(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onExportSVG]);

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

    const svgEl = el.querySelector('svg');
    if (!svgEl) return;

    svgEl.style.userSelect = 'none';
    svgEl.style.webkitUserSelect = 'none';
  }, [diagram]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!diagram || !canvasRef.current || e.button !== 0) return;
    const target = e.target as Element;
    const entityGroup = target.closest('g[data-entity-name]') as SVGGElement | null;
    const canMoveEntity = availableTools.includes('move') || availableTools.includes('hand');
    const shouldPan = true; // Always allow pan if missed entity

    if (entityGroup && canMoveEntity) {
      const entityName = entityGroup.getAttribute('data-entity-name') ?? undefined;
      if (!entityName) return;
      const tf = entityGroup.getAttribute('transform') ?? '';
      const m = tf.match(/translate\(([^,]+),([^)]+)\)/);
      const entityOrigX = m ? parseFloat(m[1]) : 0;
      const entityOrigY = m ? parseFloat(m[2]) : 0;
      dragRef.current = {
        mode: 'entity',
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        entityName,
        entityGroup,
        entityOrigX,
        entityOrigY,
      };
      canvasRef.current.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (shouldPan) {
      dragRef.current = {
        mode: 'pan',
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        panStartX: pan.x,
        panStartY: pan.y,
      };
      canvasRef.current.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }, [diagram, availableTools, activeTool, pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'none' || drag.pointerId !== e.pointerId) return;

    if (drag.mode === 'pan' && drag.panStartX != null && drag.panStartY != null) {
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      setPan({ x: drag.panStartX + dx, y: drag.panStartY + dy });
      return;
    }

    if (drag.mode === 'entity' && drag.entityGroup && drag.entityOrigX != null && drag.entityOrigY != null) {
      const scale = zoom / 100;
      const dx = (e.clientX - drag.startClientX) / scale;
      const dy = (e.clientY - drag.startClientY) / scale;
      drag.entityGroup.setAttribute('transform', `translate(${drag.entityOrigX + dx},${drag.entityOrigY + dy})`);
    }
  }, [zoom]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'none' || drag.pointerId !== e.pointerId) return;

    if (drag.mode === 'entity' && drag.entityGroup && drag.entityName && onEntityMove) {
      const tf = drag.entityGroup.getAttribute('transform') ?? '';
      const m = tf.match(/translate\(([^,]+),([^)]+)\)/);
      if (m) {
        onEntityMove(drag.entityName, Math.round(parseFloat(m[1])), Math.round(parseFloat(m[2])));
      }
    }

    if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
    dragRef.current = { mode: 'none', pointerId: -1, startClientX: 0, startClientY: 0 };
  }, [onEntityMove]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!diagram) return;
    const target = e.target as Element;

    const relationGroup = target.closest('g[data-relation-id]') as SVGGElement | null;
    if (relationGroup && onRelationEditRequest && availableTools.includes('edit-edge')) {
      const relationId = relationGroup.getAttribute('data-relation-id');
      const relationKind = relationGroup.getAttribute('data-relation-kind') ?? 'association';
      const relationLabel = relationGroup.getAttribute('data-relation-label') ?? '';
      if (!relationId) return;

      onRelationEditRequest(relationId, relationLabel, relationKind);
      return;
    }

    const entityGroup = target.closest('g[data-entity-name]') as SVGGElement | null;
    if (entityGroup && onEntityEditRequest && availableTools.includes('edit-node')) {
      const entityName = entityGroup.getAttribute('data-entity-name');
      if (!entityName) return;
      const current = diagram.entities.get(entityName);
      
      onEntityEditRequest(entityName, current?.name ?? entityName, current?.stereotype ?? '');
    }
  }, [diagram, onEntityEditRequest, onRelationEditRequest, availableTools]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Empty state */}
      {!diagram && (
        <div className="iso-canvas-empty" aria-hidden="true">
          <svg className="iso-canvas-empty-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true" role="img">
            <title>Empty diagram placeholder</title>
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
        ref={canvasRef}
        role="img"
        aria-label={diagram ? `${diagram.name} ${diagram.kind} diagram` : 'Diagram canvas'}
        style={{ display: diagram ? undefined : 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const keyword = e.dataTransfer.getData('text/plain');
          if (keyword && onDropEntity) {
            const rect = e.currentTarget.getBoundingClientRect();
            const canvasX = (e.clientX - rect.left - pan.x) / (zoom / 100);
            const canvasY = (e.clientY - rect.top - pan.y) / (zoom / 100);
            onDropEntity(keyword, canvasX, canvasY);
          }
        }}      >
        <div
          ref={containerRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
            transformOrigin: 'top left',
            display: 'inline-block',
            transition: 'transform 150ms cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </div>

      {/* Zoom controls */}
      {diagram && (
        <div className="iso-canvas-toolbar" role="toolbar" aria-label="Zoom controls">
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

