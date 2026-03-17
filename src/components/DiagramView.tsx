// ============================================================
// DiagramView — SVG Diagram Canvas Component (v2)
// ============================================================

import { useRef, useEffect, useState, useCallback } from 'react';
import type { IOMDiagram } from '../semantics/iom.js';
import { renderDiagram } from '../renderer/index.js';
import { IconPointer, IconHand, IconEdge } from './Icons';
import type { IOMEntity } from '../semantics/iom.js';

export type CanvasTool = 'move' | 'hand' | 'edit-node' | 'edit-edge' | 'add-edge';

interface DiagramViewProps {
  diagram: IOMDiagram | null;
  onEntityMove?: (entityName: string, x: number, y: number) => void;
  onEntityEditRequest?: (entity: IOMEntity) => void;
  onRelationEditRequest?: (relationId: string, currentLabel: string, currentKind: string) => void;
  onRelationAddRequest?: (fromEntity: string, toEntity: string) => void;
  onExportSVG?: () => void;
  onDropEntity?: (keyword: string, x: number, y: number) => void;
  availableTools?: CanvasTool[];
  selectedItems?: { type: 'entity' | 'relation', id: string }[];
  onSelectionChange?: (selection: { type: 'entity' | 'relation', id: string }[]) => void;
}

export function DiagramView({
  diagram,
  onEntityMove,
  onEntityEditRequest,
  onRelationEditRequest,
  onExportSVG,
  onDropEntity,
  onRelationAddRequest,
  availableTools = ['move', 'hand', 'edit-node', 'edit-edge', 'add-edge'],
  selectedItems = [],
  onSelectionChange,
}: DiagramViewProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<CanvasTool>('move');
  const [drawingEdge, setDrawingEdge] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);

  const dragRef = useRef<{
    mode: 'none' | 'entity' | 'pan' | 'add-edge';
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

  // Apply selection outlines separately to preserve DOM during drag
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const svgEl = el.querySelector('svg');
    if (!svgEl) return;

    // First clear any previous outlines
    const previouslySelected = svgEl.querySelectorAll('[data-orig-stroke]');
    previouslySelected.forEach(node => {
      const origStroke = node.getAttribute('data-orig-stroke');
      const origStrokeWidth = node.getAttribute('data-orig-stroke-width');
      if (origStroke !== null) node.setAttribute('stroke', origStroke);
      if (origStrokeWidth !== null) node.setAttribute('stroke-width', origStrokeWidth);
      node.removeAttribute('stroke-dasharray');
      node.removeAttribute('data-orig-stroke');
      node.removeAttribute('data-orig-stroke-width');
    });

    // Apply new selection outlines
    try {
      selectedItems.forEach(item => {
        let node;
        if (item.type === 'entity') {
          node = svgEl.querySelector(`g[data-entity-name="${item.id}"]`);
        } else if (item.type === 'relation') {
          node = svgEl.querySelector(`g[data-relation-id="${item.id}"]`);
        }

        if (node) {
          // Highlight by adding stroke ring
          const rectOrShape = node.querySelector('rect, circle, polygon, path, ellipse, line');
          if (rectOrShape && (rectOrShape.tagName !== 'g')) {
            const orgStroke = rectOrShape.getAttribute('stroke') || '';
            const orgStrokeWidth = rectOrShape.getAttribute('stroke-width') || '';
            rectOrShape.setAttribute('stroke', '#3b82f6');
            rectOrShape.setAttribute('stroke-width', '3');
            rectOrShape.setAttribute('data-orig-stroke', orgStroke);
            rectOrShape.setAttribute('data-orig-stroke-width', orgStrokeWidth);
            // Drop shadow or stroke dash to make it stand out
            rectOrShape.setAttribute('stroke-dasharray', '4,2');
          }
        }
      });
    } catch(err) {
      // ignore
    }

  }, [diagram, selectedItems]);

  const lastClickRef = useRef<number>(0);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!diagram || !canvasRef.current || e.button !== 0) return;
    const target = e.target as Element;

    const now = Date.now();
    if (now - lastClickRef.current < 300) {
      lastClickRef.current = 0;
      // It's a double click!
      const relationGroup = target.closest('g[data-relation-id]') as SVGGElement | null;
      if (relationGroup && onRelationEditRequest && availableTools.includes('edit-edge')) {
        const relationId = relationGroup.getAttribute('data-relation-id');
        const relationKind = relationGroup.getAttribute('data-relation-kind') ?? 'association';
        const relationLabel = relationGroup.getAttribute('data-relation-label') ?? '';
        if (relationId) {
          onRelationEditRequest(relationId, relationLabel, relationKind);
          return;
        }
      }

      const entityGroup = target.closest('g[data-entity-name]') as SVGGElement | null;
      if (entityGroup && onEntityEditRequest && availableTools.includes('edit-node')) {
        const entityName = entityGroup.getAttribute('data-entity-name');
        if (entityName) {
          const current = diagram.entities.get(entityName);
          if (current) onEntityEditRequest(current);
          return;
        }
      }
      return;
    }
    lastClickRef.current = now;

    // Handle Selection logic
    const relationGroup = target.closest('g[data-relation-id]') as SVGGElement | null;
    const entityGroup = target.closest('g[data-entity-name]') as SVGGElement | null;

    if (activeTool === 'move' && onSelectionChange) {
      if (entityGroup) {
        const entityName = entityGroup.getAttribute('data-entity-name');
        if (entityName) {
          if (e.shiftKey) {
            onSelectionChange([...selectedItems, { type: 'entity', id: entityName }]);
          } else {
            onSelectionChange([{ type: 'entity', id: entityName }]);
          }
        }
      } else if (relationGroup) {
        const relationId = relationGroup.getAttribute('data-relation-id');
        if (relationId) {
          if (e.shiftKey) {
            onSelectionChange([...selectedItems, { type: 'relation', id: relationId }]);
          } else {
            onSelectionChange([{ type: 'relation', id: relationId }]);
          }
        }
      } else {
        onSelectionChange([]);
      }
    }

    const canMoveEntity = availableTools.includes('move') || availableTools.includes('hand');
    const shouldPan = true; // Always allow pan if missed entity

    if (entityGroup && activeTool === 'add-edge') {
      const entityName = entityGroup.getAttribute('data-entity-name') ?? undefined;
      if (!entityName) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scale = zoom / 100;
      const wrap = canvasRef.current;
      const x = (e.clientX - rect.left + (wrap.scrollLeft || 0) - pan.x) / scale;
      const y = (e.clientY - rect.top + (wrap.scrollTop || 0) - pan.y) / scale;
      dragRef.current = {
        mode: 'add-edge',
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        entityName,
        entityOrigX: x,
        entityOrigY: y,
      };
      setDrawingEdge({ x1: x, y1: y, x2: x, y2: y });
      canvasRef.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (entityGroup && canMoveEntity && activeTool !== 'add-edge') {
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
  }, [diagram, availableTools, activeTool, pan, zoom, selectedItems, onSelectionChange, onRelationEditRequest, onEntityEditRequest]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'none' || drag.pointerId !== e.pointerId) return;

    if (drag.mode === 'pan' && drag.panStartX != null && drag.panStartY != null) {
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      setPan({ x: drag.panStartX + dx, y: drag.panStartY + dy });
      return;
    }

    if (drag.mode === 'add-edge' && drag.entityOrigX != null && drag.entityOrigY != null) {
      const rect = canvasRef.current?.getBoundingClientRect();
      const wrap = canvasRef.current;
      if (!rect || !wrap) return;
      const scale = zoom / 100;
      const x2 = (e.clientX - rect.left + wrap.scrollLeft - pan.x) / scale;
      const y2 = (e.clientY - rect.top + wrap.scrollTop - pan.y) / scale;
      setDrawingEdge(prev => prev ? { ...prev, x2, y2 } : null);
      return;
    }

    if (drag.mode === 'entity' && drag.entityGroup && drag.entityOrigX != null && drag.entityOrigY != null) {
      const scale = zoom / 100;
      const dx = (e.clientX - drag.startClientX) / scale;
      const dy = (e.clientY - drag.startClientY) / scale;
      drag.entityGroup.setAttribute('transform', `translate(${drag.entityOrigX + dx},${drag.entityOrigY + dy})`);
    }
  }, [zoom, pan]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'none' || drag.pointerId !== e.pointerId) return;

    if (drag.mode === 'add-edge') {
      setDrawingEdge(null);
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const targetEntityGroup = target?.closest('g[data-entity-name]');
      const toEntityName = targetEntityGroup?.getAttribute('data-entity-name');
      if (drag.entityName && toEntityName && drag.entityName !== toEntityName) {
        if (onRelationAddRequest) {
          onRelationAddRequest(drag.entityName, toEntityName);
        }
      }
    }

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
  }, [onEntityMove, onRelationAddRequest]);

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
        onDragOver={e => e.preventDefault()}
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
        {drawingEdge && (
          <svg style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 100}}>
            <g style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`, transformOrigin: 'top left' }}>
              <line x1={drawingEdge.x1} y1={drawingEdge.y1} x2={drawingEdge.x2} y2={drawingEdge.y2} stroke="var(--accent-color, #2563eb)" strokeWidth="3" strokeDasharray="5,5" />
            </g>
          </svg>
        )}
      </div>

      {/* Tools Array */}
      <div className="iso-canvas-tools" style={{ position: 'absolute', left: 16, top: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
        {availableTools.includes('move') && (
          <button className={`iso-canvas-btn ${activeTool === 'move' ? 'active' : ''}`} onClick={() => setActiveTool('move')} title="Select / Move">
            <IconPointer />
          </button>
        )}
        {availableTools.includes('hand') && (
          <button className={`iso-canvas-btn ${activeTool === 'hand' ? 'active' : ''}`} onClick={() => setActiveTool('hand')} title="Pan Canvas">
            <IconHand />
          </button>
        )}
        {availableTools.includes('add-edge') && (
          <button className={`iso-canvas-btn ${activeTool === 'add-edge' ? 'active' : ''}`} onClick={() => setActiveTool('add-edge')} title="Draw Edge">
            <IconEdge />
          </button>
        )}
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

