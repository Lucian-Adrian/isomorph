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

interface ContextMenuState {
  x: number;
  y: number;
  target: 'entity' | 'relation' | 'canvas';
  entityName?: string;
  relationId?: string;
  relationLabel?: string;
  relationKind?: string;
}

interface DiagramViewProps {
  diagram: IOMDiagram | null;
  isWatermarkEnabled?: boolean;
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
  onAutoLayout?: (mode: 'left-right' | 'snowflake' | 'compact') => void;
  onEntityDelete?: (entityName: string) => void;
  onEntityDuplicate?: (entityName: string) => void;
  onEntityCopy?: (entityName: string) => void;
  onRelationDelete?: (relationId: string) => void;
  onPaste?: () => void;
  onAddNote?: (x: number, y: number) => void;
}

export function DiagramView({
  diagram,
  isWatermarkEnabled,
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
  onAutoLayout,
  onEntityDelete,
  onEntityDuplicate,
  onEntityCopy,
  onRelationDelete,
  onPaste,
  onAddNote,
}: DiagramViewProps) {
  const t = useCallback((key: string, vars?: Record<string, string | number>) => tText(language, key, vars), [language]);
  const containerRef  = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<CanvasTool>('move');
  const [drawingEdge, setDrawingEdge] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const [marqueeState, setMarqueeState] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [layoutDropdownOpen, setLayoutDropdownOpen] = useState(false);

  const dragRef = useRef<{
    mode: 'none' | 'entity' | 'pan' | 'add-edge' | 'resize-entity' | 'relation-vertical' | 'marquee';
    hasMoved: boolean;
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
    selectedOrigs?: Record<string, { x: number, y: number, usesDelta: boolean, group: SVGGElement }>;
  }>({ mode: 'none', hasMoved: false, pointerId: -1, startClientX: 0, startClientY: 0 });

  const SNAP_THRESHOLD = 10;

  useEffect(() => {
    if (!availableTools.includes(activeTool)) {
      setActiveTool(availableTools[0] ?? 'move');
    }
  }, [availableTools, activeTool]);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [diagram?.name]);

  // Global contextmenu listener to suppress Firefox right-click menu over the canvas
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (canvasRef.current && canvasRef.current.contains(e.target as Node)) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleContextMenu, { capture: true });
    return () => document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
  }, []);

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

  // Map touch events to zoom/pan on mobile
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    let initialDistance: number | null = null;
    let initialZoom: number = 100;
    
    // For single-finger panning on touch devices
    let touchPanStart: {x: number, y: number} | null = null;
    let initialPan: {x: number, y: number} = {x: 0, y: 0};

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialDistance = Math.sqrt(dx * dx + dy * dy);
        setZoom(z => { initialZoom = z; return z; });
        touchPanStart = null;
      } else if (e.touches.length === 1 && !(e.target as Element)?.closest('g[data-entity-name]')) {
        // Start touch pan if we didn't touch an entity
        touchPanStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setPan(p => { initialPan = { ...p }; return p; });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance !== null) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scaleChange = dist / initialDistance;
        let newZoom = initialZoom * scaleChange;
        
        // Snap to grid or limits
        newZoom = Math.max(40, Math.min(newZoom, 200));
        setZoom(newZoom);
      } else if (e.touches.length === 1 && touchPanStart) {
        e.preventDefault();
        const dx = e.touches[0].clientX - touchPanStart.x;
        const dy = e.touches[0].clientY - touchPanStart.y;
        setPan({
          x: initialPan.x + dx,
          y: initialPan.y + dy
        });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialDistance = null;
      }
      if (e.touches.length === 0) {
        touchPanStart = null;
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [setZoom, setPan]);

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

  // Prevent native context menu in Firefox and other browsers on right click
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.iso-canvas-wrap')) {
        e.preventDefault();
      }
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
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

  // Keyboard shortcut: Arrow keys for moving selected entities
  useEffect(() => {
    if (!onEntityMove || selectedItems.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const delta = e.shiftKey ? 20 : 5;
        const dx = e.key === 'ArrowRight' ? delta : e.key === 'ArrowLeft' ? -delta : 0;
        const dy = e.key === 'ArrowDown' ? delta : e.key === 'ArrowUp' ? -delta : 0;

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

        const updatedPositions = { ...seededPositions };
        let anyMoved = false;
        let mainEntityId = '';

        selectedItems.forEach(item => {
          if (item.type === 'entity') {
            const currentPos = updatedPositions[item.id];
            if (currentPos) {
              updatedPositions[item.id] = { ...currentPos, x: currentPos.x + dx, y: currentPos.y + dy };
              anyMoved = true;
              if (!mainEntityId) mainEntityId = item.id;
            }
          }
        });
        
        if (anyMoved) {
          onEntityMove(mainEntityId, updatedPositions[mainEntityId].x, updatedPositions[mainEntityId].y, dx, dy, updatedPositions);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedItems, onEntityMove]);

  // Render SVG into container on diagram change
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!diagram) {
      el.innerHTML = '';
      return;
    }

    const svg = renderDiagram(diagram, { isWatermarkEnabled });
    el.innerHTML = svg;

    const svgEl = el.querySelector('svg');
    if (!svgEl) return;

    svgEl.style.userSelect = 'none';
    svgEl.style.webkitUserSelect = 'none';
  }, [diagram, isWatermarkEnabled]);

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
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
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
    const isRightClick = e.button === 2;

    // Right-click → open context menu (not edit modal)
    if (isRightClick) {
      e.preventDefault();
      e.stopPropagation();
      lastClickRef.current = 0;

      const relationGroup = target.closest('g[data-relation-id]') as SVGGElement | null;
      if (relationGroup) {
        const relationId = relationGroup.getAttribute('data-relation-id') ?? '';
        const relationKind = relationGroup.getAttribute('data-relation-kind') ?? 'association';
        const relationLabel = relationGroup.getAttribute('data-relation-label') ?? '';
        setContextMenu({ x: e.clientX, y: e.clientY, target: 'relation', relationId, relationKind, relationLabel });
        return;
      }

      const entityGroup = target.closest('g[data-entity-name]') as SVGGElement | null;
      if (entityGroup) {
        const entityName = entityGroup.getAttribute('data-entity-name') ?? '';
        if (entityName) {
          setContextMenu({ x: e.clientX, y: e.clientY, target: 'entity', entityName });
          return;
        }
      }

      // Canvas background right-click
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setContextMenu({ x: e.clientX, y: e.clientY, target: 'canvas', entityName: `${Math.round(canvasPos.x)},${Math.round(canvasPos.y)}` });
      return;
    }

    // Close context menu on any left click
    if (contextMenu) {
      setContextMenu(null);
    }

    if (now - lastClickRef.current < 300) {
      lastClickRef.current = 0;
      // It's a double click → open edit modal
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
                stereotype: frag.label,
                elseBlocks: frag.elseBlocks, // Inject elseBlocks into custom property
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
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            if (!selectedItems.some(i => i.type === 'entity' && i.id === entityName)) {
              onSelectionChange([...selectedItems, { type: 'entity', id: entityName }]);
            } else {
              onSelectionChange(selectedItems.filter(i => !(i.type === 'entity' && i.id === entityName)));
            }
          } else {
            if (!selectedItems.some(i => i.type === 'entity' && i.id === entityName)) {
              onSelectionChange([{ type: 'entity', id: entityName }]);
            }
          }
        }
      } else if (relationGroup) {
        const relationId = relationGroup.getAttribute('data-relation-id');
        if (relationId) {
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            if (!selectedItems.some(i => i.type === 'relation' && i.id === relationId)) {
              onSelectionChange([...selectedItems, { type: 'relation', id: relationId }]);
            } else {
              onSelectionChange(selectedItems.filter(i => !(i.type === 'relation' && i.id === relationId)));
            }
          } else {
            onSelectionChange([{ type: 'relation', id: relationId }]);
          }
        }
      } else {
        onSelectionChange([]);
      }
    }

    const canMoveEntity = availableTools.includes('move') || availableTools.includes('hand');
    const shouldPan = activeTool === 'hand';
    const shouldMarquee = activeTool === 'move';

    if (relationGroup && activeTool === 'move' && diagram.kind === 'sequence' && onRelationVerticalMove) {
      const relationId = relationGroup.getAttribute('data-relation-id') ?? undefined;
      if (!relationId) return;
      const relationY = Number.parseFloat(relationGroup.getAttribute('data-relation-y') ?? '0');
      if (!Number.isFinite(relationY)) return;
      dragRef.current = {
        mode: 'relation-vertical',
        hasMoved: false,
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
        hasMoved: false,
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
        hasMoved: false,
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

      // Gather multi-selection data if this entity is selected
      const selectedOrigs: Record<string, { x: number, y: number, usesDelta: boolean, group: SVGGElement }> = {};
      const isSelected = selectedItems.some(i => i.type === 'entity' && i.id === entityName);
      if (isSelected && selectedItems.length > 0) {
        selectedItems.forEach(item => {
          if (item.type === 'entity') {
            const group = containerRef.current?.querySelector(`g[data-entity-name="${item.id}"], g[data-package-name="${item.id}"]`) as SVGGElement | null;
            if (group) {
              const itemTf = group.getAttribute('transform') ?? '';
              const itemM = itemTf.match(/translate\(([^,]+),([^)]+)\)/);
              let ix = itemM ? parseFloat(itemM[1]) : 0;
              let iy = itemM ? parseFloat(itemM[2]) : 0;
              if (!itemM) {
                const iRect = group.querySelector('rect');
                if (iRect) {
                  ix = parseFloat(iRect.getAttribute('x') || '0');
                  iy = parseFloat(iRect.getAttribute('y') || '0');
                }
              }
              selectedOrigs[item.id] = { x: ix, y: iy, usesDelta: !itemM, group };
              group.style.willChange = 'transform';
            }
          }
        });
      }

      dragRef.current = {
        mode: 'entity',
        hasMoved: false,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        entityName,
        entityGroup,
        entityOrigX,
        entityOrigY,
        entityUsesDeltaTransform: usesDeltaTransform,
        selectedOrigs,
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
        hasMoved: false,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        panStartX: pan.x,
        panStartY: pan.y,
      };
      setIsInteracting(true);
      canvasRef.current.setPointerCapture(e.pointerId);
      e.preventDefault();
    } else if (shouldMarquee) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scale = zoom / 100;
      const wrap = canvasRef.current;
      const x = (e.clientX - rect.left + (wrap.scrollLeft || 0) - pan.x) / scale;
      const y = (e.clientY - rect.top + (wrap.scrollTop || 0) - pan.y) / scale;
      dragRef.current = {
        mode: 'marquee',
        hasMoved: false,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        entityOrigX: x,
        entityOrigY: y,
      };
      setMarqueeState({ x, y, w: 0, h: 0 });
      setIsInteracting(true);
      canvasRef.current.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }, [diagram, availableTools, activeTool, pan, zoom, selectedItems, onSelectionChange, onRelationEditRequest, onEntityEditRequest, onRelationVerticalMove, pendingDropKeyword, onDropEntity, onConsumePendingDrop, screenToCanvas, contextMenu]);

  // Close context menu on Escape or outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    const handleClick = (e: PointerEvent | MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.iso-context-menu')) setContextMenu(null);
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('pointerdown', handleClick, { capture: true });
    window.addEventListener('mousedown', handleClick, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('pointerdown', handleClick, { capture: true });
      window.removeEventListener('mousedown', handleClick, { capture: true });
    };
  }, [contextMenu]);

  // Close layout dropdown on outside click
  useEffect(() => {
    if (!layoutDropdownOpen) return;
    const handleClick = (e: PointerEvent | MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.iso-layout-dropdown')) setLayoutDropdownOpen(false);
    };
    window.addEventListener('pointerdown', handleClick);
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('pointerdown', handleClick);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [layoutDropdownOpen]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'none' || drag.pointerId !== e.pointerId) return;

    if (drag.mode === 'pan' && drag.panStartX != null && drag.panStartY != null) {
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      setPan({ x: drag.panStartX + dx, y: drag.panStartY + dy });
      return;
    }

    drag.hasMoved = true;

    if (drag.mode === 'marquee' && drag.entityOrigX != null && drag.entityOrigY != null) {
      const scale = zoom / 100;
      const dx = (e.clientX - drag.startClientX) / scale;
      const dy = (e.clientY - drag.startClientY) / scale;
      let x = drag.entityOrigX;
      let y = drag.entityOrigY;
      let w = Math.abs(dx);
      let h = Math.abs(dy);
      if (dx < 0) x = x + dx;
      if (dy < 0) y = y + dy;
      setMarqueeState({ x, y, w, h });
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

      if (drag.selectedOrigs && Object.keys(drag.selectedOrigs).length > 0) {
        Object.values(drag.selectedOrigs).forEach(item => {
          const ix = item.x + dx;
          const iy = item.y + dy;
          if (item.usesDelta) {
            item.group.setAttribute('transform', `translate(${dx},${dy})`);
          } else {
            item.group.setAttribute('transform', `translate(${ix},${iy})`);
          }
        });
      } else {
        if (drag.entityUsesDeltaTransform) {
          drag.entityGroup.setAttribute('transform', `translate(${dx},${dy})`);
        } else {
          drag.entityGroup.setAttribute('transform', `translate(${nextX},${nextY})`);
        }
      }
    }
  }, [diagram, zoom, pan]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'none' || drag.pointerId !== e.pointerId) return;

    if (drag.mode === 'entity' && !drag.hasMoved) {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey && drag.entityName && onSelectionChange) {
        onSelectionChange([{ type: 'entity', id: drag.entityName }]);
      }
    }

    if (drag.mode === 'marquee' && marqueeState && onSelectionChange) {
      setMarqueeState(null);
      const { x: mx, y: my, w: mw, h: mh } = marqueeState;
      const mRight = mx + mw;
      const mBottom = my + mh;
      const newSelection: { type: 'entity' | 'relation', id: string }[] = (e.shiftKey || e.ctrlKey || e.metaKey) ? [...selectedItems] : [];
      
      if (mw > 5 && mh > 5) {
        const allEntityGroups = Array.from(containerRef.current?.querySelectorAll('g[data-entity-name]') ?? []) as SVGGElement[];
        for (const group of allEntityGroups) {
          const entityName = group.getAttribute('data-entity-name');
          if (!entityName) continue;
          const tfAll = group.getAttribute('transform') ?? '';
          const mAll = tfAll.match(/translate\(([^,]+),([^)]+)\)/);
          let ox = 0; let oy = 0;
          if (mAll) {
            ox = parseFloat(mAll[1]);
            oy = parseFloat(mAll[2]);
          } else {
            const rect = group.querySelector('rect');
            if (rect) {
              ox = parseFloat(rect.getAttribute('x') || '0');
              oy = parseFloat(rect.getAttribute('y') || '0');
            }
          }
          const ow = parseFloat(group.getAttribute('data-entity-width') || group.querySelector('rect')?.getAttribute('width') || '0');
          const oh = parseFloat(group.getAttribute('data-entity-height') || group.querySelector('rect')?.getAttribute('height') || '0');
          
          if (ox < mRight && ox + ow > mx && oy < mBottom && oy + oh > my) {
            if (!newSelection.some(s => s.type === 'entity' && s.id === entityName)) {
              newSelection.push({ type: 'entity', id: entityName });
            }
          }
        }
      }
      onSelectionChange(newSelection);
    }

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
      if (drag.selectedOrigs) {
        Object.values(drag.selectedOrigs).forEach(item => item.group.style.willChange = '');
      }
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
    dragRef.current = { mode: 'none', hasMoved: false, pointerId: -1, startClientX: 0, startClientY: 0 };
  }, [diagram, zoom, pan, marqueeState, selectedItems, onSelectionChange, onEntityMove, onEntityResize, onRelationAddRequest, onRelationVerticalMove]);

  const isDiagramEmpty = diagram && diagram.entities.size === 0 && (!diagram.packages || diagram.packages.length === 0);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }} onContextMenu={e => e.preventDefault()}>
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
        onContextMenu={(e) => e.preventDefault()}
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
        {marqueeState && (
          <div style={{
            position: 'absolute',
            border: '1px solid var(--accent-color, #2563eb)',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            left: marqueeState.x * (zoom / 100) + pan.x,
            top: marqueeState.y * (zoom / 100) + pan.y,
            width: marqueeState.w * (zoom / 100),
            height: marqueeState.h * (zoom / 100),
            pointerEvents: 'none',
            zIndex: 100
          }} />
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

      {/* Zoom controls and Feedback */}
      {diagram && (
        <>
          <button
            type="button"
            className="iso-feedback-pill iso-mobile-hide"
            onClick={() => alert(t('ui.feedback_coming_soon'))}
            aria-label={t('ui.feedback')}
          >
            <div className="iso-feedback-icon">!</div>
            <span className="iso-feedback-text">{t('ui.feedback')}</span>
          </button>
          
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
            aria-label={t('tool.reset_zoom', { zoom: Math.round(zoom) })}
            style={{ width: 44, fontSize: 11 }}
          >
            {Math.round(zoom)}%
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
          {onAutoLayout && (
            <>
              <div className="iso-canvas-sep" />
              <div className="iso-layout-dropdown">
                <button
                  type="button"
                  className="iso-canvas-btn"
                  onClick={() => setLayoutDropdownOpen(o => !o)}
                  aria-label={t('layout.auto_layout')}
                  data-tooltip={t('layout.auto_layout')}
                  style={{ width: 'auto', padding: '0 8px', fontSize: 11 }}
                >
                  ⊞
                </button>
                {layoutDropdownOpen && (
                  <div className="iso-layout-dropdown-menu">
                    <button className="iso-layout-option" onClick={() => { onAutoLayout('left-right'); setLayoutDropdownOpen(false); }}>
                      <span className="iso-layout-option-title">{t('layout.left_right')}</span>
                      <span className="iso-layout-option-desc">{t('layout.left_right_desc')}</span>
                    </button>
                    <button className="iso-layout-option" onClick={() => { onAutoLayout('snowflake'); setLayoutDropdownOpen(false); }}>
                      <span className="iso-layout-option-title">{t('layout.snowflake')}</span>
                      <span className="iso-layout-option-desc">{t('layout.snowflake_desc')}</span>
                    </button>
                    <button className="iso-layout-option" onClick={() => { onAutoLayout('compact'); setLayoutDropdownOpen(false); }}>
                      <span className="iso-layout-option-title">{t('layout.compact')}</span>
                      <span className="iso-layout-option-desc">{t('layout.compact_desc')}</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        </>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="iso-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={e => e.stopPropagation()}
        >
          {contextMenu.target === 'entity' && (
            <>
              <button className="iso-context-menu-item" onClick={() => {
                if (contextMenu.entityName && diagram) {
                  const ent = diagram.entities.get(contextMenu.entityName);
                  if (ent && onEntityEditRequest) onEntityEditRequest(ent);
                }
                setContextMenu(null);
              }}>
                {t('ctx.edit')}
                <span className="iso-context-menu-shortcut">Dbl-click</span>
              </button>
              {onEntityDuplicate && (
                <button className="iso-context-menu-item" onClick={() => { if (contextMenu.entityName) onEntityDuplicate(contextMenu.entityName); setContextMenu(null); }}>
                  {t('ctx.duplicate')}
                  <span className="iso-context-menu-shortcut">Ctrl+D</span>
                </button>
              )}
              {onEntityCopy && (
                <button className="iso-context-menu-item" onClick={() => { if (contextMenu.entityName) onEntityCopy(contextMenu.entityName); setContextMenu(null); }}>
                  {t('ctx.copy')}
                  <span className="iso-context-menu-shortcut">Ctrl+C</span>
                </button>
              )}
              <div className="iso-context-menu-sep" />
              {onEntityDelete && (
                <button className="iso-context-menu-item iso-context-menu-item--danger" onClick={() => { if (contextMenu.entityName) onEntityDelete(contextMenu.entityName); setContextMenu(null); }}>
                  {t('ctx.delete')}
                  <span className="iso-context-menu-shortcut">Del</span>
                </button>
              )}
            </>
          )}
          {contextMenu.target === 'relation' && (
            <>
              <button className="iso-context-menu-item" onClick={() => {
                if (contextMenu.relationId && onRelationEditRequest) {
                  onRelationEditRequest(contextMenu.relationId, contextMenu.relationLabel ?? '', contextMenu.relationKind ?? 'association');
                }
                setContextMenu(null);
              }}>
                {t('ctx.edit')}
                <span className="iso-context-menu-shortcut">Dbl-click</span>
              </button>
              <div className="iso-context-menu-sep" />
              {onRelationDelete && (
                <button className="iso-context-menu-item iso-context-menu-item--danger" onClick={() => { if (contextMenu.relationId) onRelationDelete(contextMenu.relationId); setContextMenu(null); }}>
                  {t('ctx.delete')}
                  <span className="iso-context-menu-shortcut">Del</span>
                </button>
              )}
            </>
          )}
          {contextMenu.target === 'canvas' && (
            <>
              {onPaste && (
                <button className="iso-context-menu-item" onClick={() => { onPaste(); setContextMenu(null); }}>
                  {t('ctx.paste')}
                  <span className="iso-context-menu-shortcut">Ctrl+V</span>
                </button>
              )}
              {onAddNote && (
                <button className="iso-context-menu-item" onClick={() => {
                  const coords = contextMenu.entityName?.split(',').map(Number) ?? [100, 100];
                  onAddNote(coords[0] ?? 100, coords[1] ?? 100);
                  setContextMenu(null);
                }}>
                  {t('ctx.add_note')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}




