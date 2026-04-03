// ============================================================
// DiagramView — SVG Diagram Canvas Component (v2)
// ============================================================

import { useRef, useEffect, useState, useCallback } from 'react';
import type { IOMDiagram } from '../semantics/iom.js';
import { renderDiagram } from '../renderer/index.js';
import { IconPointer, IconHand, IconEdge } from './Icons';
import type { IOMEntity } from '../semantics/iom.js';
import { tText, type Language } from '../i18n.js';

export type CanvasTool = 'move' | 'hand' | 'edit-node' | 'edit-edge' | 'add-edge';

interface DiagramViewProps {
  diagram: IOMDiagram | null;
  language?: Language;
  onEntityMove?: (entityName: string, x: number, y: number, dx?: number, dy?: number, seedPositions?: Record<string, { x: number; y: number; w?: number; h?: number }>) => void;
  onEntityResize?: (entityName: string, w: number, h: number, x?: number, y?: number) => void;
  onEntityEditRequest?: (entity: IOMEntity) => void;
  onRelationEditRequest?: (relationId: string, currentLabel: string, currentKind: string) => void;
  onRelationVerticalMove?: (relationId: string, y: number, seedRelationYs?: Record<string, number>) => void;
  onRelationAddRequest?: (fromEntity: string, toEntity: string, y?: number) => void;
  onExportSVG?: () => void;
  onDropEntity?: (keyword: string, x: number, y: number, targetPackage?: string) => void;
  onTextRenameRequest?: (oldText: string, newText: string, type: 'diagram' | 'package') => void;
  availableTools?: CanvasTool[];
  selectedItems?: { type: 'entity' | 'relation', id: string }[];
  onSelectionChange?: (selection: { type: 'entity' | 'relation', id: string }[]) => void;
  pendingDropKeyword?: string | null;
  onConsumePendingDrop?: () => void;
}

export function DiagramView({
  diagram,
  language = 'en',
  onEntityMove,
  onEntityResize,
  onEntityEditRequest,
  onRelationEditRequest,
  onRelationVerticalMove,
  onExportSVG,
  onDropEntity,
  onRelationAddRequest,
  onTextRenameRequest,
  availableTools = ['move', 'hand', 'edit-node', 'edit-edge', 'add-edge'],
  selectedItems = [],
  onSelectionChange,
  pendingDropKeyword,
  onConsumePendingDrop,
}: DiagramViewProps) {
  const t = useCallback((key: string, vars?: Record<string, string | number>) => tText(language, key, vars), [language]);
  const containerRef  = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<CanvasTool>('move');
  const [drawingEdge, setDrawingEdge] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  const dragRef = useRef<{
    mode: 'none' | 'entity' | 'pan' | 'add-edge' | 'resize-entity' | 'relation-vertical';
    pointerId: number;
    startClientX: number;
    startClientY: number;
    entityName?: string;
    entityGroup?: SVGGElement;
    entityOrigX?: number;
    entityOrigY?: number;
    entityUsesDeltaTransform?: boolean;
    entityOrigW?: number;
    entityOrigH?: number;
    resizeHandle?: 'e' | 's' | 'se';
    relationId?: string;
    relationGroup?: SVGGElement;
    relationOrigY?: number;
    panStartX?: number;
    panStartY?: number;
  }>({ mode: 'none', pointerId: -1, startClientX: 0, startClientY: 0 });

  const SNAP_THRESHOLD = 10;

  useEffect(() => {
    if (!availableTools.includes(activeTool)) {
      setActiveTool(availableTools[0] ?? 'move');
    }
  }, [availableTools, activeTool]);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [diagram?.name]);

  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const svgEl = containerRef.current?.querySelector('svg') as SVGSVGElement | null;
    if (svgEl && typeof svgEl.createSVGPoint === 'function') {
      const ctm = svgEl.getScreenCTM();
      if (ctm) {
        const point = svgEl.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const local = point.matrixTransform(ctm.inverse());
        return { x: local.x, y: local.y };
      }
    }

    const wrap = canvasRef.current;
    const rect = wrap?.getBoundingClientRect();
    if (!wrap || !rect) return { x: 0, y: 0 };
    const scale = zoom / 100;
    return {
      x: (clientX - rect.left + (wrap.scrollLeft || 0) - pan.x) / scale,
      y: (clientY - rect.top + (wrap.scrollTop || 0) - pan.y) / scale,
    };
  }, [zoom, pan]);

  const handleZoomIn  = useCallback(() => setZoom(z => Math.min(z + 20, 200)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z - 20, 40)), []);
  const handleFit     = useCallback(() => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  }, []);

  // Prevent browser native pinch-zoom
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
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
    if (!diagram || !canvasRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as Element;

    if (pendingDropKeyword && onDropEntity) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const pkgGroup = target.closest('g[data-package-name]');
      const targetPackage = pkgGroup ? (pkgGroup.getAttribute('data-package-name') ?? undefined) : undefined;
      onDropEntity(pendingDropKeyword, pos.x, pos.y, targetPackage);
      onConsumePendingDrop?.();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

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
          e.preventDefault();
          e.stopPropagation();
          onRelationEditRequest(relationId, relationLabel, relationKind);
          return;
        }
      }

      const entityGroup = target.closest('g[data-entity-name]') as SVGGElement | null;
      if (entityGroup && onEntityEditRequest && availableTools.includes('edit-node')) {
        const entityName = entityGroup.getAttribute('data-entity-name');
        if (entityName) {
          const current = diagram.entities.get(entityName);
          if (current) {
            e.preventDefault();
            e.stopPropagation();
            onEntityEditRequest(current);
            return;
          }
          
          const frag = diagram.fragments?.find(f => f.id === entityName);
          if (frag) {
            e.preventDefault();
            e.stopPropagation();
            onEntityEditRequest({
              id: frag.id,
              name: frag.id,
              kind: frag.kind,
              isAbstract: false,
              fields: [],
              methods: [],
              enumValues: [],
              extendsNames: [],
              implementsNames: [],
              styles: {},
            } as any);
            return;
          }

          const isDefaultUsecaseBoundary = diagram.kind === 'usecase' && entityGroup.getAttribute('data-default-usecase-boundary') === 'true';
          if (isDefaultUsecaseBoundary) {
            const tf = entityGroup.getAttribute('transform') ?? '';
            const tm = tf.match(/translate\(([^,]+),([^)]+)\)/);
            const fallbackRect = entityGroup.querySelector('rect');
            const x = tm ? parseFloat(tm[1]) : parseFloat(fallbackRect?.getAttribute('x') || '280');
            const y = tm ? parseFloat(tm[2]) : parseFloat(fallbackRect?.getAttribute('y') || '30');
            const w = parseFloat(entityGroup.getAttribute('data-entity-width') || fallbackRect?.getAttribute('width') || '580');
            const h = parseFloat(entityGroup.getAttribute('data-entity-height') || fallbackRect?.getAttribute('height') || '400');
            e.preventDefault();
            e.stopPropagation();
            onEntityEditRequest({
              id: entityName,
              name: entityName,
              kind: 'system',
              isAbstract: false,
              fields: [],
              methods: [],
              enumValues: [],
              extendsNames: [],
              implementsNames: [],
              styles: {},
              children: [],
              regions: [],
              position: {
                x: Number.isFinite(x) ? x : 280,
                y: Number.isFinite(y) ? y : 30,
                w: Number.isFinite(w) ? w : 580,
                h: Number.isFinite(h) ? h : 400,
              },
            });
            return;
          }

          // Partitions are modeled separately from diagram.entities; still allow edit modal for rename.
          const isPartitionLane = entityGroup.getAttribute('data-partition-lane') === 'true';
          if (isPartitionLane) {
            const part = diagram.partitions.find(p => p.name === entityName);
            if (part) {
              e.preventDefault();
              e.stopPropagation();
              onEntityEditRequest({
                id: part.id,
                name: part.name,
                kind: 'partition',
                isAbstract: false,
                fields: [],
                methods: [],
                enumValues: [],
                extendsNames: [],
                implementsNames: [],
                styles: {},
                children: [],
                regions: [],
                position: part.position,
              });
              return;
            }
          }
        }
      }

      const pkgGroup = target.closest('g[data-package-name]') as SVGGElement | null;
      if (pkgGroup && onTextRenameRequest && availableTools.includes('edit-node')) {
        const pkgName = pkgGroup.getAttribute('data-package-name');
        if (pkgName) {
           e.preventDefault(); e.stopPropagation(); onTextRenameRequest(pkgName, '', 'package');
           return;
        }
      }

      const diagramGroup = target.closest('g[data-diagram-name]') as SVGGElement | null;
      if (diagramGroup && onTextRenameRequest && availableTools.includes('edit-node')) {
        const diagName = diagramGroup.getAttribute('data-diagram-name');
        if (diagName) {
           e.preventDefault(); e.stopPropagation(); onTextRenameRequest(diagName, '', 'diagram');
           return;
        }
      }
      return;
    }
    lastClickRef.current = now;

    // Handle Selection logic
    const relationGroup = target.closest('g[data-relation-id]') as SVGGElement | null;
    const entityGroup = target.closest('g[data-entity-name], g[data-package-name]') as SVGGElement | null;
    const resizeHandle = target.closest('[data-resize-handle]') as Element | null;

    if (activeTool === 'move' && onSelectionChange) {
      if (entityGroup) {
        const entityName = entityGroup.getAttribute('data-entity-name') || entityGroup.getAttribute('data-package-name');
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

    if (relationGroup && activeTool === 'move' && diagram.kind === 'sequence' && onRelationVerticalMove) {
      const relationId = relationGroup.getAttribute('data-relation-id') ?? undefined;
      if (!relationId) return;
      const relationY = Number.parseFloat(relationGroup.getAttribute('data-relation-y') ?? '0');
      if (!Number.isFinite(relationY)) return;
      dragRef.current = {
        mode: 'relation-vertical',
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        relationId,
        relationGroup,
        relationOrigY: relationY,
      };
      setIsInteracting(true);
      canvasRef.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (resizeHandle && entityGroup && activeTool !== 'add-edge') {
      const handle = (resizeHandle.getAttribute('data-resize-handle') ?? 'se') as 'e' | 's' | 'se';
      const entityName = entityGroup.getAttribute('data-entity-name') ?? undefined;
      if (!entityName) return;
      const tf = entityGroup.getAttribute('transform') ?? '';
      const m = tf.match(/translate\(([^,]+),([^)]+)\)/);
      const entityOrigX = m ? parseFloat(m[1]) : 0;
      const entityOrigY = m ? parseFloat(m[2]) : 0;
      const entityOrigW = parseFloat(entityGroup.getAttribute('data-entity-width') || '0');
      const entityOrigH = parseFloat(entityGroup.getAttribute('data-entity-height') || '0');
      if (!Number.isFinite(entityOrigW) || !Number.isFinite(entityOrigH) || entityOrigW <= 0 || entityOrigH <= 0) return;

      dragRef.current = {
        mode: 'resize-entity',
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        entityName,
        entityGroup,
        entityOrigX,
        entityOrigY,
        entityOrigW,
        entityOrigH,
        resizeHandle: handle,
      };
      setIsInteracting(true);
      canvasRef.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (entityGroup && activeTool === 'add-edge') {
      const entityName = entityGroup.getAttribute('data-entity-name') ?? entityGroup.getAttribute('data-package-name') ?? undefined;
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
      setIsInteracting(true);
      canvasRef.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (entityGroup && canMoveEntity && activeTool !== 'add-edge') {
      const entityName = entityGroup.getAttribute('data-entity-name') ?? entityGroup.getAttribute('data-package-name') ?? undefined;
      if (!entityName) return;
      const tf = entityGroup.getAttribute('transform') ?? '';
      const m = tf.match(/translate\(([^,]+),([^)]+)\)/);
      const usesDeltaTransform = !m;
      
      let entityOrigX = m ? parseFloat(m[1]) : 0;
      let entityOrigY = m ? parseFloat(m[2]) : 0;
      
      // If we don't have transform (like a package or usecase diagram wrapper without at() initially)
      if (!m) {
        // Fallback to reading x/y bounds from its inner rect if available
        const rect = entityGroup.querySelector('rect');
        if (rect) {
          entityOrigX = parseFloat(rect.getAttribute('x') || '0');
          entityOrigY = parseFloat(rect.getAttribute('y') || '0');
        }
      }

      // For packages with children: temporarily strip SVG filters from nested
      // entity rects to avoid expensive per-frame filter re-rendering during drag
      if (entityGroup.hasAttribute('data-package-name')) {
        const filteredEls = entityGroup.querySelectorAll('[filter]');
        filteredEls.forEach(el => {
          el.setAttribute('data-drag-filter', el.getAttribute('filter') || '');
          el.removeAttribute('filter');
        });
      }

      dragRef.current = {
        mode: 'entity',
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        entityName,
        entityGroup,
        entityOrigX,
        entityOrigY,
        entityUsesDeltaTransform: usesDeltaTransform,
      };
      entityGroup.style.willChange = 'transform';
      setIsInteracting(true);
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
      setIsInteracting(true);
      canvasRef.current.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }, [diagram, availableTools, activeTool, pan, zoom, selectedItems, onSelectionChange, onRelationEditRequest, onEntityEditRequest, onRelationVerticalMove, pendingDropKeyword, onDropEntity, onConsumePendingDrop, screenToCanvas]);

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

    if (drag.mode === 'relation-vertical' && drag.relationGroup && drag.relationOrigY != null) {
      const scale = zoom / 100;
      const dy = (e.clientY - drag.startClientY) / scale;
      drag.relationGroup.setAttribute('transform', `translate(0,${dy})`);
      return;
    }

    if (drag.mode === 'resize-entity' && drag.entityGroup && drag.entityOrigW != null && drag.entityOrigH != null) {
      const scale = zoom / 100;
      const dx = (e.clientX - drag.startClientX) / scale;
      const dy = (e.clientY - drag.startClientY) / scale;
      const minW = 120;
      const minH = 120;

      let nextW = drag.entityOrigW;
      let nextH = drag.entityOrigH;
      if (drag.resizeHandle === 'e' || drag.resizeHandle === 'se') {
        nextW = Math.max(minW, drag.entityOrigW + dx);
      }
      if (drag.resizeHandle === 's' || drag.resizeHandle === 'se') {
        nextH = Math.max(minH, drag.entityOrigH + dy);
      }

      if (diagram?.kind === 'activity' && drag.entityGroup.getAttribute('data-partition-lane') === 'true') {
        const others = Array.from(containerRef.current?.querySelectorAll('g[data-partition-lane="true"]') ?? []) as SVGGElement[];
        const me = drag.entityGroup;
        const myRightRaw = drag.entityOrigX! + nextW;
        const myBottomRaw = drag.entityOrigY! + nextH;

        for (const other of others) {
          if (other === me) continue;
          const tf = other.getAttribute('transform') ?? '';
          const tm = tf.match(/translate\(([^,]+),([^)]+)\)/);
          if (!tm) continue;
          const ox = parseFloat(tm[1]);
          const oy = parseFloat(tm[2]);
          const ow = parseFloat(other.getAttribute('data-entity-width') || '0');
          const oh = parseFloat(other.getAttribute('data-entity-height') || '0');
          const oRight = ox + ow;
          const oBottom = oy + oh;

          if (Math.abs(myRightRaw - ox) <= SNAP_THRESHOLD) {
            nextW = Math.max(minW, ox - drag.entityOrigX!);
          } else if (Math.abs(myRightRaw - oRight) <= SNAP_THRESHOLD) {
            nextW = Math.max(minW, oRight - drag.entityOrigX!);
          }

          if (Math.abs(myBottomRaw - oy) <= SNAP_THRESHOLD) {
            nextH = Math.max(minH, oy - drag.entityOrigY!);
          } else if (Math.abs(myBottomRaw - oBottom) <= SNAP_THRESHOLD) {
            nextH = Math.max(minH, oBottom - drag.entityOrigY!);
          }
        }
      }

      drag.entityGroup.setAttribute('data-entity-width', String(Math.round(nextW)));
      drag.entityGroup.setAttribute('data-entity-height', String(Math.round(nextH)));

      const bodyRect = drag.entityGroup.querySelector('rect[data-lane-body]') as SVGRectElement | null;
      const headerRect = drag.entityGroup.querySelector('rect[data-lane-header]') as SVGRectElement | null;
      const divider = drag.entityGroup.querySelector('line[data-lane-divider]') as SVGLineElement | null;
      const title = drag.entityGroup.querySelector('text[data-lane-title]') as SVGTextElement | null;
      const handleE = drag.entityGroup.querySelector('[data-resize-handle="e"]') as SVGRectElement | null;
      const handleS = drag.entityGroup.querySelector('[data-resize-handle="s"]') as SVGRectElement | null;
      const handleSE = drag.entityGroup.querySelector('[data-resize-handle="se"]') as SVGRectElement | null;

      if (bodyRect) {
        bodyRect.setAttribute('width', String(nextW));
        bodyRect.setAttribute('height', String(nextH));
      }
      if (headerRect) {
        headerRect.setAttribute('width', String(nextW));
      }
      if (divider) {
        divider.setAttribute('x2', String(nextW));
      }
      if (title) {
        title.setAttribute('x', String(nextW / 2));
      }
      if (handleE) {
        handleE.setAttribute('x', String(nextW - 4));
        handleE.setAttribute('y', String(nextH / 2 - 10));
      }
      if (handleS) {
        handleS.setAttribute('x', String(nextW / 2 - 10));
        handleS.setAttribute('y', String(nextH - 4));
      }
      if (handleSE) {
        handleSE.setAttribute('x', String(nextW - 6));
        handleSE.setAttribute('y', String(nextH - 6));
      }

      const boundaryRect = drag.entityGroup.querySelector('rect[data-boundary-body]') as SVGRectElement | null;
      if (boundaryRect) {
        boundaryRect.setAttribute('width', String(nextW));
        boundaryRect.setAttribute('height', String(nextH));
      }
      return;
    }

    if (drag.mode === 'entity' && drag.entityGroup && drag.entityOrigX != null && drag.entityOrigY != null) {
      const scale = zoom / 100;
      const dx = (e.clientX - drag.startClientX) / scale;
      const dy = (e.clientY - drag.startClientY) / scale;
      let nextX = drag.entityOrigX + dx;
      let nextY = drag.entityOrigY + dy;

      if (diagram?.kind === 'activity' && drag.entityGroup.getAttribute('data-partition-lane') === 'true') {
        const myW = parseFloat(drag.entityGroup.getAttribute('data-entity-width') || '0');
        const myH = parseFloat(drag.entityGroup.getAttribute('data-entity-height') || '0');
        const myRightRaw = nextX + myW;
        const myBottomRaw = nextY + myH;

        const others = Array.from(containerRef.current?.querySelectorAll('g[data-partition-lane="true"]') ?? []) as SVGGElement[];
        for (const other of others) {
          if (other === drag.entityGroup) continue;
          const tf = other.getAttribute('transform') ?? '';
          const tm = tf.match(/translate\(([^,]+),([^)]+)\)/);
          if (!tm) continue;
          const ox = parseFloat(tm[1]);
          const oy = parseFloat(tm[2]);
          const ow = parseFloat(other.getAttribute('data-entity-width') || '0');
          const oh = parseFloat(other.getAttribute('data-entity-height') || '0');
          const oRight = ox + ow;
          const oBottom = oy + oh;

          if (Math.abs(nextX - oRight) <= SNAP_THRESHOLD) nextX = oRight;
          else if (Math.abs(myRightRaw - ox) <= SNAP_THRESHOLD) nextX = ox - myW;

          if (Math.abs(nextY - oBottom) <= SNAP_THRESHOLD) nextY = oBottom;
          else if (Math.abs(myBottomRaw - oy) <= SNAP_THRESHOLD) nextY = oy - myH;
        }
      }

      if (drag.entityUsesDeltaTransform) {
        drag.entityGroup.setAttribute('transform', `translate(${dx},${dy})`);
      } else {
        drag.entityGroup.setAttribute('transform', `translate(${nextX},${nextY})`);
      }
    }
  }, [diagram, zoom, pan]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'none' || drag.pointerId !== e.pointerId) return;

    if (drag.mode === 'add-edge') {
      setDrawingEdge(null);
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const targetEntityGroup = target?.closest('g[data-entity-name]');
      const toEntityName = targetEntityGroup?.getAttribute('data-entity-name');
      const isSequenceSelfReference = drag.entityName && toEntityName
        && drag.entityName === toEntityName
        && diagram?.kind === 'sequence';
      if (drag.entityName && toEntityName && (drag.entityName !== toEntityName || isSequenceSelfReference)) {
        if (onRelationAddRequest) {
          const rect = canvasRef.current?.getBoundingClientRect();
          let y: number | undefined = undefined;
          if (rect && canvasRef.current) {
            const scale = zoom / 100;
            const wrap = canvasRef.current;
            y = Math.round((drag.startClientY - rect.top + (wrap.scrollTop || 0) - pan.y) / scale);
          }
          onRelationAddRequest(drag.entityName, toEntityName, y);
        }
      }
    }

    if (drag.mode === 'relation-vertical' && drag.relationGroup && drag.relationId && drag.relationOrigY != null) {
      const seededRelationYs: Record<string, number> = {};
      const allRelationGroups = Array.from(containerRef.current?.querySelectorAll('g[data-relation-id][data-relation-y]') ?? []) as SVGGElement[];
      for (const group of allRelationGroups) {
        const rid = group.getAttribute('data-relation-id');
        const yRaw = Number.parseFloat(group.getAttribute('data-relation-y') ?? '');
        if (!rid || !Number.isFinite(yRaw)) continue;
        seededRelationYs[rid] = Math.round(yRaw);
      }

      const tf = drag.relationGroup.getAttribute('transform') ?? '';
      const m = tf.match(/translate\(0,([^)]+)\)/);
      const dy = m ? parseFloat(m[1]) : 0;
      drag.relationGroup.removeAttribute('transform');
      if (onRelationVerticalMove) {
        onRelationVerticalMove(drag.relationId, Math.round(drag.relationOrigY + dy), seededRelationYs);
      }
    }

    if (drag.mode === 'resize-entity' && drag.entityName && drag.entityGroup && onEntityResize) {
      const w = parseFloat(drag.entityGroup.getAttribute('data-entity-width') || '0');
      const h = parseFloat(drag.entityGroup.getAttribute('data-entity-height') || '0');
      if (w > 0 && h > 0) {
        const tf = drag.entityGroup.getAttribute('transform') ?? '';
        const m = tf.match(/translate\(([^,]+),([^)]+)\)/);
        const x = m ? Math.round(parseFloat(m[1])) : undefined;
        const y = m ? Math.round(parseFloat(m[2])) : undefined;
        onEntityResize(drag.entityName, Math.round(w), Math.round(h), x, y);
      }
    }

    if (drag.mode === 'entity' && drag.entityGroup && drag.entityName && onEntityMove) {
      const isPackageDrag = drag.entityGroup.hasAttribute('data-package-name');
      const scale = zoom / 100;
      // Raw cursor delta in canvas coordinates
      const cursorDx = Math.round((e.clientX - drag.startClientX) / scale);
      const cursorDy = Math.round((e.clientY - drag.startClientY) / scale);

      if (isPackageDrag) {
        // For packages: pass 0,0 as position and cursor delta as dx/dy.
        // App.tsx handleEntityMove will compute final positions from IOM data + delta.
        onEntityMove(drag.entityName, 0, 0, cursorDx, cursorDy, undefined);
      } else {
        let updatedX = Math.round((drag.entityOrigX ?? 0) + cursorDx);
        let updatedY = Math.round((drag.entityOrigY ?? 0) + cursorDy);

        const pkgGroup = drag.entityGroup.closest('g[data-package-name]') as SVGGElement | null;
        if (pkgGroup) {
          const ptf = pkgGroup.getAttribute('transform') ?? '';
          const pm = ptf.match(/translate\(([^,]+),([^)]+)\)/);
          if (pm) {
            updatedX += Math.round(parseFloat(pm[1]));
            updatedY += Math.round(parseFloat(pm[2]));
          }
        }

        const seededPositions: Record<string, { x: number; y: number; w?: number; h?: number }> = {};
        const allEntityGroups = Array.from(containerRef.current?.querySelectorAll('g[data-entity-name]') ?? []) as SVGGElement[];
        for (const group of allEntityGroups) {
          const entityName = group.getAttribute('data-entity-name');
          if (!entityName) continue;
          const tfAll = group.getAttribute('transform') ?? '';
          const mAll = tfAll.match(/translate\(([^,]+),([^)]+)\)/);
          if (!mAll) continue;
          let xAll = Math.round(parseFloat(mAll[1]));
          let yAll = Math.round(parseFloat(mAll[2]));
          const ePkgGroup = group.closest('g[data-package-name]') as SVGGElement | null;
          if (ePkgGroup) {
            const ptf = ePkgGroup.getAttribute('transform') ?? '';
            const pm = ptf.match(/translate\(([^,]+),([^)]+)\)/);
            if (pm) {
              xAll += Math.round(parseFloat(pm[1]));
              yAll += Math.round(parseFloat(pm[2]));
            }
          }
          const wAll = Number.parseFloat(group.getAttribute('data-entity-width') ?? '');
          const hAll = Number.parseFloat(group.getAttribute('data-entity-height') ?? '');
          seededPositions[entityName] = {
            x: xAll,
            y: yAll,
            w: Number.isFinite(wAll) ? Math.round(wAll) : undefined,
            h: Number.isFinite(hAll) ? Math.round(hAll) : undefined,
          };
        }

        onEntityMove(drag.entityName, updatedX, updatedY, cursorDx, cursorDy, seededPositions);
      }
    }

    if (drag.entityGroup) {
      drag.entityGroup.style.willChange = '';
      // Restore SVG filters that were stripped during package drag
      const stripped = drag.entityGroup.querySelectorAll('[data-drag-filter]');
      stripped.forEach(el => {
        const origFilter = el.getAttribute('data-drag-filter') || '';
        if (origFilter) el.setAttribute('filter', origFilter);
        el.removeAttribute('data-drag-filter');
      });
    }

    if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
    setIsInteracting(false);
    dragRef.current = { mode: 'none', pointerId: -1, startClientX: 0, startClientY: 0 };
  }, [diagram, zoom, onEntityMove, onEntityResize, onRelationAddRequest, onRelationVerticalMove]);

  const isDiagramEmpty = diagram && diagram.entities.size === 0 && (!diagram.packages || diagram.packages.length === 0);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Empty state (no code typed at all) */}
      {!diagram && (
        <div className="iso-canvas-empty" aria-hidden="true" style={{ pointerEvents: 'none' }}>
          <svg className="iso-canvas-empty-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true" role="img">
            <title>{t('diagram.empty_placeholder')}</title>
            <rect x="2" y="3" width="9" height="7" rx="1.5"/>
            <rect x="13" y="3" width="9" height="7" rx="1.5"/>
            <rect x="7" y="14" width="10" height="7" rx="1.5"/>
            <line x1="6.5" y1="10" x2="6.5" y2="13"/>
            <line x1="17.5" y1="10" x2="17.5" y2="13"/>
            <line x1="6.5" y1="13" x2="12" y2="13"/>
            <line x1="17.5" y1="13" x2="12" y2="13"/>
            <line x1="12" y1="13" x2="12" y2="14"/>
          </svg>
          <span className="iso-canvas-empty-title">{t('diagram.none')}</span>
          <span className="iso-canvas-empty-sub">
            {t('diagram.help_write')}
          </span>
        </div>
      )}

      {/* Empty diagram state (diagram defined, but no entities) */}
      {isDiagramEmpty && (
        <div className="iso-canvas-empty" aria-hidden="true" style={{ pointerEvents: 'none', zIndex: 10 }}>
          <svg className="iso-canvas-empty-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true" role="img">
            <title>{t('diagram.empty')}</title>
            <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
            <path d="M8 12h8" />
          </svg>
          <span className="iso-canvas-empty-title">{t('diagram.empty')}</span>
          <span className="iso-canvas-empty-sub">
            {t('diagram.help_drag')}
          </span>
        </div>
      )}

      {/* SVG canvas with zoom */}
      <div
        className="iso-canvas-wrap"
        ref={canvasRef}
        role="img"
        aria-label={diagram ? `${diagram.name} ${diagram.kind} ${t('welcome.diagram')}` : t('diagram.canvas_label')}
        style={{
          display: diagram ? undefined : 'none',
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          backgroundSize: `${24 * (zoom / 100)}px ${24 * (zoom / 100)}px`,
          touchAction: 'none' /* prevent native zooming on trackpads */
        }}
        onWheel={(e) => {
          if (e.ctrlKey) {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            setZoom(z => {
              const newZ = Math.min(Math.max(z - Math.sign(e.deltaY) * 10, 40), 200);
              const scaleRatio = newZ / z;
              // update pan to zoom in towards mouse pointer
              setPan(p => ({
                x: mx - (mx - p.x) * scaleRatio,
                y: my - (my - p.y) * scaleRatio
              }));
              return newZ;
            });
          } else {
            e.preventDefault();
            setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const keyword = e.dataTransfer.getData('text/plain');
          if (keyword && onDropEntity) {
            const pos = screenToCanvas(e.clientX, e.clientY);
            const target = e.target as Element;
            const pkgGroup = target.closest('g[data-package-name]');
            const targetPackage = pkgGroup ? (pkgGroup.getAttribute('data-package-name') ?? undefined) : undefined;
            onDropEntity(keyword, pos.x, pos.y, targetPackage);
          }
        }}      >
        <div
          ref={containerRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
            transition: isInteracting ? 'none' : 'transform 150ms cubic-bezier(0.16,1,0.3,1)',
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
          <button className={`iso-canvas-btn ${activeTool === 'move' ? 'iso-canvas-btn--active' : ''}`} onClick={() => setActiveTool('move')} aria-label={t('tool.select_move')} data-tooltip={t('tool.select_move')}>
            <IconPointer />
          </button>
        )}
        {availableTools.includes('hand') && (
          <button className={`iso-canvas-btn ${activeTool === 'hand' ? 'iso-canvas-btn--active' : ''}`} onClick={() => setActiveTool('hand')} aria-label={t('tool.pan_canvas')} data-tooltip={t('tool.pan_canvas')}>
            <IconHand />
          </button>
        )}
        {availableTools.includes('add-edge') && (
          <button className={`iso-canvas-btn ${activeTool === 'add-edge' ? 'iso-canvas-btn--active' : ''}`} onClick={() => setActiveTool('add-edge')} aria-label={t('tool.draw_edge')} data-tooltip={t('tool.draw_edge')}>
            <IconEdge />
          </button>
        )}
      </div>

      {/* Zoom controls */}
      {diagram && (
        <div className="iso-canvas-toolbar" role="toolbar" aria-label={t('tool.zoom_controls')}>
            <button
            type="button"
            className="iso-canvas-btn"
            onClick={handleZoomOut}
            aria-label={t('tool.zoom_out')}
            disabled={zoom <= 40}
            data-tooltip={t('tool.zoom_out')}
          >
            −
          </button>
          <button
            type="button"
            className="iso-canvas-btn"
            onClick={handleFit}
            aria-label={t('tool.reset_zoom', { zoom })}
            style={{ width: 44, fontSize: 11 }}
          >
            {zoom}%
          </button>
          <button
            type="button"
            className="iso-canvas-btn"
            onClick={handleZoomIn}
            aria-label={t('tool.zoom_in')}
            disabled={zoom >= 200}
            data-tooltip={t('tool.zoom_in')}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}




