import { useEffect, useRef, useState, useCallback } from 'react';
import { DiagramView } from './DiagramView.js';
import type { CanvasTool } from './DiagramView.js';
import { IconDiagram } from './Icons.js';
import type { IOMDiagram, IOMEntity } from '../semantics/iom.js';
import type { Language } from '../i18n.js';
import { CanvasToolbar } from './CanvasToolbar.js';
import { CanvasPropertiesPanel } from './CanvasPropertiesPanel.js';
import { DEFAULT_CANVAS_STYLE } from '../canvas/canvasStyle.js';
import type { CanvasElement, CanvasState, CanvasStyle, CanvasDraftSemanticLink, CanvasBounds } from '../canvas/canvasTypes.js';
import { createEmptyCanvasState, parseCanvasStateText, serializeCanvasState } from '../canvas/canvasSerialization.js';
import { createCanvasElement, boundsFromPoints, boundsFromStartEnd, elementsIntersectingBounds } from '../canvas/canvasTools.js';
import { reduceCanvasState } from '../canvas/canvasState.js';
import { constrainToSquare, constrainLineAngle } from '../canvas/canvasConstraints.js';

export type FullCanvasMode =
  | 'move'
  | 'hand'
  | 'add-edge'
  | 'sequence-create'
  | 'sequence-destroy'
  | 'locked'
  | 'rectangle'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'pen'
  | 'text'
  | 'image'
  | 'eraser'
  | 'frame'
  | 'embed'
  | 'laser'
  | 'lasso'
  | 'uml-package';

export interface FullCanvasShellProps {
  diagram: IOMDiagram | null;
  diagrams?: IOMDiagram[] | null;
  language?: Language;
  mode: FullCanvasMode;
  zoomLabel?: string;
  fitLabel?: string;
  canSave?: boolean;
  canExport?: boolean;
  strictUmlEnabled?: boolean;
  statusLabel?: string;
  onModeChange: (mode: FullCanvasMode) => void;
  onFitCanvas?: () => void;
  onSave?: () => void;
  onExportSVG: () => void;
  onExportPNG: () => void;
  onBack: () => void;
  onShare?: () => void;
  onOpenShortcuts?: () => void;
  onValidate?: () => void;
  onStrictUmlChange?: (enabled: boolean) => void;
  onEntityMove?: (entityName: string, x: number, y: number, dx?: number, dy?: number, seedPositions?: Record<string, { x: number; y: number; w?: number; h?: number }>, diagramName?: string) => void;
  onEntityResize?: (entityName: string, w: number, h: number, x?: number, y?: number, diagramName?: string) => void;
  onEntityEditRequest?: (entity: IOMEntity, diagramName?: string) => void;
  onRelationEditRequest?: (relationId: string, currentLabel: string, currentKind: string, diagramName?: string) => void;
  onRelationVerticalMove?: (relationId: string, y: number, seedRelationYs?: Record<string, number>, diagramName?: string) => void;
  onRelationAddRequest?: (fromEntity: string, toEntity: string, y?: number, diagramName?: string, relationType?: string) => void;
  onDropEntity?: (keyword: string, x: number, y: number, targetPackage?: string, diagramName?: string) => void;
  onTextRenameRequest?: (oldText: string, newText: string, type: 'diagram' | 'package', diagramName?: string) => void;
  selectedItems?: { type: 'entity' | 'relation'; id: string }[];
  onSelectionChange?: (selection: { type: 'entity' | 'relation'; id: string }[]) => void;
  pendingDropKeyword?: string | null;
  onConsumePendingDrop?: () => void;
  activeTool?: CanvasTool;
  fitSignal?: number;
  onViewportChange?: (viewport: { zoom: number; pan: { x: number; y: number } }) => void;
  canvasStorageKey?: string;
  onCanvasStateChange?: (state: CanvasState) => void;
  onCanvasInteractionDuration?: (durationMs: number) => void;
  onPromoteToDSL?: (elementId: string, targetKind: string) => void;
  onRender?: (stats: { latencyMs: number; svgLength: number }) => void;
}

type Point = { x: number; y: number };
type PanningGesture = { startPointer: Point; startPan: Point };
type ElementDragGesture = {
  elementId: string;
  startPointer: Point;
  startBoundsMap: Record<string, CanvasBounds>;
  startElementsMap?: Record<string, CanvasElement>;
};
type DrawingGesture = {
  elementId: string;
  mode: FullCanvasMode;
  start: Point;
  points: Point[];
};
type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

function getRotatedCursor(handle: ResizeHandle, rotation: number = 0): string {
  const angle = ((rotation % 360) + 360) % 360;
  const handleAngles: Record<ResizeHandle, number> = {
    n: 0,
    ne: 45,
    e: 90,
    se: 135,
    s: 180,
    sw: 225,
    w: 270,
    nw: 315,
  };
  const baseAngle = handleAngles[handle];
  const totalAngle = (baseAngle + angle) % 360;
  const index = Math.round(totalAngle / 45) % 8;
  const cursors = [
    'ns-resize',
    'nesw-resize',
    'ew-resize',
    'nwse-resize',
    'ns-resize',
    'nesw-resize',
    'ew-resize',
    'nwse-resize',
  ];
  return cursors[index];
}


function resizeBounds(
  start: CanvasBounds,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  shiftKey: boolean
): CanvasBounds {
  let { x, y, width, height } = start;

  if (handle.includes('e')) {
    width = Math.max(5, start.width + dx);
  } else if (handle.includes('w')) {
    const maxW = start.x + start.width - 5;
    x = Math.min(start.x + dx, maxW);
    width = start.x + start.width - x;
  }

  if (handle.includes('s')) {
    height = Math.max(5, start.height + dy);
  } else if (handle.includes('n')) {
    const maxH = start.y + start.height - 5;
    y = Math.min(start.y + dy, maxH);
    height = start.y + start.height - y;
  }

  if (shiftKey) {
    const startRatio = start.width / start.height;
    if (handle === 'e' || handle === 'w') {
      height = width / startRatio;
    } else if (handle === 'n' || handle === 's') {
      width = height * startRatio;
    } else {
      if (width / start.width > height / start.height) {
        height = width / startRatio;
      } else {
        width = height * startRatio;
      }
    }

    if (handle.includes('w')) {
      x = start.x + start.width - width;
    }
    if (handle.includes('n')) {
      y = start.y + start.height - height;
    }
  }

  return { x, y, width, height };
}

function toolsForMode(mode: FullCanvasMode): CanvasTool[] {
  if (mode === 'sequence-create' || mode === 'sequence-destroy') return [mode, 'add-edge', 'edit-node', 'edit-edge'];
  if (mode === 'add-edge' || mode === 'arrow' || mode === 'line') return ['add-edge', 'sequence-create', 'sequence-destroy', 'edit-node', 'edit-edge'];
  if (mode === 'hand') return ['hand', 'edit-node', 'edit-edge'];
  if (mode === 'locked') return ['hand'];
  return ['move', 'hand', 'edit-node', 'edit-edge', 'add-edge', 'sequence-create', 'sequence-destroy'];
}

function modeToDiagramTool(mode: FullCanvasMode): FullCanvasMode {
  if (mode === 'sequence-create' || mode === 'sequence-destroy') return mode;
  if (mode === 'arrow' || mode === 'line') return 'add-edge';
  return mode;
}

function modeToCanvasTool(mode: FullCanvasMode): CanvasTool {
  if (mode === 'hand' || mode === 'locked') return 'hand';
  if (mode === 'sequence-create' || mode === 'sequence-destroy') return mode;
  if (mode === 'add-edge' || mode === 'arrow' || mode === 'line') return 'add-edge';
  return 'move';
}

const FREEFORM_MODES = new Set<FullCanvasMode>([
  'rectangle',
  'ellipse',
  'line',
  'arrow',
  'pen',
  'text',
  'image',
  'eraser',
  'frame',
  'embed',
  'laser',
  'lasso',
  'uml-package',
]);

function isFreeformMode(mode: FullCanvasMode): boolean {
  return FREEFORM_MODES.has(mode);
}

function canvasKindForMode(mode: FullCanvasMode): Exclude<CanvasElement['kind'], 'unknown'> {
  if (mode === 'locked' || mode === 'move' || mode === 'hand' || mode === 'add-edge' || mode === 'sequence-create' || mode === 'sequence-destroy') return 'rectangle';
  return mode;
}

function isDragDrawMode(mode: FullCanvasMode): boolean {
  return mode === 'rectangle' || mode === 'ellipse' || mode === 'line' || mode === 'arrow' || mode === 'pen' || mode === 'eraser' || mode === 'laser' || mode === 'lasso';
}

function isPathMode(mode: FullCanvasMode): boolean {
  return mode === 'pen' || mode === 'eraser' || mode === 'laser' || mode === 'lasso';
}

function titleForCanvasMode(mode: FullCanvasMode): string | undefined {
  if (mode === 'text') return 'Text';
  if (mode === 'uml-package') return 'Package';
  if (mode === 'frame') return 'Frame';
  if (mode === 'embed') return 'Web embed';
  return undefined;
}

export function FullCanvasShell({
  diagram,
  diagrams,
  language,
  mode,
  zoomLabel = '100%',
  fitLabel = 'Fit',
  canSave = true,
  canExport = true,
  strictUmlEnabled,
  statusLabel,
  onModeChange,
  onFitCanvas,
  onSave,
  onExportSVG,
  onExportPNG,
  onBack,
  onShare,
  onOpenShortcuts,
  onValidate,
  onStrictUmlChange,
  onEntityMove,
  onEntityResize,
  onEntityEditRequest,
  onRelationEditRequest,
  onRelationVerticalMove,
  onRelationAddRequest,
  onDropEntity,
  onTextRenameRequest,
  selectedItems,
  onSelectionChange,
  pendingDropKeyword,
  onConsumePendingDrop,
  activeTool,
  fitSignal,
  onViewportChange,
  canvasStorageKey,
  onCanvasStateChange,
  onCanvasInteractionDuration,
  onPromoteToDSL,
  onRender,
}: FullCanvasShellProps) {
  const pointerDownTimeRef = useRef<number | null>(null);
  const moreToolsRef = useRef<HTMLDivElement>(null);
  const moreActionsRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const modeRef = useRef(mode);
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);

  const [selectionDrag, setSelectionDrag] = useState<{
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);

  const [panningCanvas, setPanningCanvas] = useState<PanningGesture | null>(null);
  const panningCanvasRef = useRef<PanningGesture | null>(null);

  const [draggingElement, setDraggingElement] = useState<ElementDragGesture | null>(null);
  const draggingElementRef = useRef<ElementDragGesture | null>(null);

  const [resizingElement, setResizingElement] = useState<{
    elementId: string;
    startPointer: { x: number; y: number };
    startBounds: CanvasBounds;
    startElement?: CanvasElement;
    handle?: ResizeHandle;
    vertexIndex?: number;
    startPoints?: Point[];
  } | null>(null);
  const [rotatingElement, setRotatingElement] = useState<{
    elementId: string;
    center: Point;
    startAngle: number;
    startRotation: number;
  } | null>(null);

  const [drawing, setDrawing] = useState<DrawingGesture | null>(null);
  const drawingRef = useRef<DrawingGesture | null>(null);

  const [replacingImageId, setReplacingImageId] = useState<string | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const [canvasState, setCanvasState] = useState<CanvasState>(() => {
    if (!canvasStorageKey || typeof localStorage === 'undefined') return createEmptyCanvasState();
    return parseCanvasStateText(localStorage.getItem(canvasStorageKey));
  });

  const hasDiagram = Boolean(diagram);
  const semanticMode = modeToDiagramTool(mode);
  const canvasTool = activeTool ?? modeToCanvasTool(mode);

  useEffect(() => {
    if (!canvasStorageKey || typeof localStorage === 'undefined') return;
    setCanvasState(parseCanvasStateText(localStorage.getItem(canvasStorageKey)));
  }, [canvasStorageKey]);

  useEffect(() => {
    if (canvasStorageKey && typeof localStorage !== 'undefined') {
      localStorage.setItem(canvasStorageKey, serializeCanvasState(canvasState));
    }
    onCanvasStateChange?.(canvasState);
  }, [canvasState, canvasStorageKey, onCanvasStateChange]);

  const persistCanvasSnapshot = useCallback((state: CanvasState) => {
    if (canvasStorageKey && typeof localStorage !== 'undefined') {
      localStorage.setItem(canvasStorageKey, serializeCanvasState(state));
    }
    onCanvasStateChange?.(state);
  }, [canvasStorageKey, onCanvasStateChange]);

  useEffect(() => {
    setCanvasState(state => {
      const zScale = zoom / 100;
      if (state.viewport.x === pan.x && state.viewport.y === pan.y && state.viewport.zoom === zScale) {
        return state;
      }
      return {
        ...state,
        viewport: { x: pan.x, y: pan.y, zoom: zScale },
        updatedAt: new Date().toISOString(),
      };
    });
  }, [pan, zoom]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moreToolsRef.current && !moreToolsRef.current.contains(target)) {
        setMoreToolsOpen(false);
      }
      if (moreActionsRef.current && !moreActionsRef.current.contains(target)) {
        setMoreActionsOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (mode === 'image') {
      fileInputRef.current?.click();
    }
  }, [mode]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.defaultPrevented) return;
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (e.ctrlKey) {
        // Smooth touchpad pinch-to-zoom or Ctrl+scroll
        const zoomSpeed = 0.003;
        const factor = Math.exp(-e.deltaY * zoomSpeed);

        setZoom(currentZoom => {
          const newZ = Math.min(Math.max(currentZoom * factor, 40), 200);
          const scaleRatio = newZ / currentZoom;
          setPan(currentPan => ({
            x: mx - (mx - currentPan.x) * scaleRatio,
            y: my - (my - currentPan.y) * scaleRatio,
          }));
          return newZ;
        });
      } else {
        // Panning (scroll / touchpad drag)
        setPan(currentPan => ({
          x: currentPan.x - e.deltaX,
          y: currentPan.y - e.deltaY,
        }));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleStyleChange = useCallback((patch: Partial<CanvasStyle>) => {
    setCanvasState(state => {
      if (state.selectedElementIds.length > 0) {
        const elements = state.elements.map(el => {
          if (state.selectedElementIds.includes(el.id)) {
            return {
              ...el,
              style: { ...el.style, ...patch },
              updatedAt: new Date().toISOString(),
            };
          }
          return el;
        });
        const next = { ...state, elements, updatedAt: new Date().toISOString() };
        persistCanvasSnapshot(next);
        return next;
      } else {
        const next = {
          ...state,
          styleDefaults: { ...state.styleDefaults, ...patch },
          updatedAt: new Date().toISOString(),
        };
        persistCanvasSnapshot(next);
        return next;
      }
    });
  }, [persistCanvasSnapshot]);

  const handleElementChange = useCallback((patch: Partial<CanvasElement>) => {
    setCanvasState(state => {
      const elements = state.elements.map(el => {
        if (state.selectedElementIds.includes(el.id)) {
          return {
            ...el,
            ...patch,
            updatedAt: new Date().toISOString(),
          } as CanvasElement;
        }
        return el;
      });
      const next = { ...state, elements, updatedAt: new Date().toISOString() };
      persistCanvasSnapshot(next);
      return next;
    });
  }, [persistCanvasSnapshot]);

  const handleDraftSemanticLink = useCallback((targetKind: CanvasDraftSemanticLink['targetKind']) => {
    setCanvasState(state => {
      if (state.selectedElementIds.length !== 1) return state;
      const targetId = state.selectedElementIds[0];
      const existingIdx = state.draftSemanticLinks.findIndex(l => l.canvasElementId === targetId);
      const newLink: CanvasDraftSemanticLink = {
        id: `link-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        canvasElementId: targetId,
        targetKind,
        status: 'draft',
      };
      const draftSemanticLinks = [...state.draftSemanticLinks];
      if (existingIdx >= 0) {
        draftSemanticLinks[existingIdx] = {
          ...draftSemanticLinks[existingIdx],
          targetKind,
          status: 'draft',
        };
      } else {
        draftSemanticLinks.push(newLink);
      }
      return { ...state, draftSemanticLinks, updatedAt: new Date().toISOString() };
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    setCanvasState(state => {
      const elements = state.elements.filter(el => !state.selectedElementIds.includes(el.id));
      const draftSemanticLinks = state.draftSemanticLinks.filter(l => !state.selectedElementIds.includes(l.canvasElementId));
      return {
        ...state,
        elements,
        selectedElementIds: [],
        draftSemanticLinks,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleBringForward = useCallback(() => {
    setCanvasState(state => {
      const next = reduceCanvasState(state, { type: 'bring-forward', ids: state.selectedElementIds });
      persistCanvasSnapshot(next);
      return next;
    });
  }, [persistCanvasSnapshot]);

  const handleSendBackward = useCallback(() => {
    setCanvasState(state => {
      const next = reduceCanvasState(state, { type: 'send-backward', ids: state.selectedElementIds });
      persistCanvasSnapshot(next);
      return next;
    });
  }, [persistCanvasSnapshot]);

  const handleDuplicate = useCallback(() => {
    setCanvasState(state => {
      const toDuplicate = state.elements.filter(el => state.selectedElementIds.includes(el.id));
      if (toDuplicate.length === 0) return state;

      const newElements: CanvasElement[] = [];
      const newIds: string[] = [];

      for (const el of toDuplicate) {
        const newId = `canvas-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const bounds = {
          ...el.bounds,
          x: el.bounds.x + 20,
          y: el.bounds.y + 20,
        };
        const newEl = {
          ...el,
          id: newId,
          bounds,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as CanvasElement;

        newElements.push(newEl);
        newIds.push(newId);
      }

      return {
        ...state,
        elements: [...state.elements, ...newElements],
        selectedElementIds: newIds,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleReplaceImage = useCallback(() => {
    setCanvasState(state => {
      if (state.selectedElementIds.length === 1) {
        const el = state.elements.find(e => e.id === state.selectedElementIds[0]);
        if (el && el.kind === 'image') {
          setReplacingImageId(el.id);
          fileInputRef.current?.click();
        }
      }
      return state;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        handleDeleteSelected();
        return;
      }

      const toolKeys: Record<string, FullCanvasMode> = {
        '1': 'locked',
        '2': 'rectangle',
        '3': 'ellipse',
        '4': 'arrow',
        '5': 'line',
        '6': 'pen',
        '7': 'text',
        '8': 'image',
        '9': 'eraser',
        '0': 'eraser',
        'v': 'move',
        'V': 'move',
        'h': 'hand',
        'H': 'hand',
      };
      const targetMode = toolKeys[event.key];
      if (targetMode) {
        event.preventDefault();
        onModeChange(targetMode);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDeleteSelected, onModeChange]);

  const getCanvasCoords = (clientX: number, clientY: number) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const scale = zoom / 100;
    return {
      x: (clientX - rect.left - pan.x) / scale,
      y: (clientY - rect.top - pan.y) / scale,
    };
  };

  const deleteIntersecting = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const strokeBounds = boundsFromStartEnd(p1, p2);
    setCanvasState(state => {
      const intersectingIds = elementsIntersectingBounds(state, strokeBounds);
      if (intersectingIds.length === 0) return state;
      const elements = state.elements.filter(el => !intersectingIds.includes(el.id));
      const draftSemanticLinks = state.draftSemanticLinks.filter(l => !intersectingIds.includes(l.canvasElementId));
      return {
        ...state,
        elements,
        selectedElementIds: state.selectedElementIds.filter(id => !intersectingIds.includes(id)),
        draftSemanticLinks,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleFreeformPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    pointerDownTimeRef.current = performance.now();
    const target = event.target as SVGElement;
    const currentMode = (event.currentTarget.dataset.canvasMode as FullCanvasMode | undefined) ?? modeRef.current;

    if (currentMode === 'hand') {
      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch (e) {}
      const gesture = {
        startPointer: { x: event.clientX, y: event.clientY },
        startPan: { ...pan },
      };
      panningCanvasRef.current = gesture;
      setPanningCanvas(gesture);
      return;
    }

    const clientPos = getCanvasCoords(event.clientX, event.clientY);

    if (currentMode === 'move') {
      const rotateHandleId = target.getAttribute('data-rotate-element-id');
      if (rotateHandleId) {
        event.preventDefault();
        event.stopPropagation();
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch (e) {}
        const element = canvasState.elements.find(el => el.id === rotateHandleId);
        if (element) {
          const center = {
            x: element.bounds.x + element.bounds.width / 2,
            y: element.bounds.y + element.bounds.height / 2,
          };
          setRotatingElement({
            elementId: rotateHandleId,
            center,
            startAngle: Math.atan2(clientPos.y - center.y, clientPos.x - center.x),
            startRotation: element.rotation ?? 0,
          });
        }
        return;
      }

      const vertexHandleId = target.getAttribute('data-vertex-element-id');
      const vertexIdxAttr = target.getAttribute('data-vertex-index');
      if (vertexHandleId && vertexIdxAttr != null) {
        event.preventDefault();
        event.stopPropagation();
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch (e) {}
        const element = canvasState.elements.find(el => el.id === vertexHandleId);
        if (element && 'points' in element) {
          const vertexIndex = parseInt(vertexIdxAttr, 10);
          setResizingElement({
            elementId: vertexHandleId,
            startPointer: clientPos,
            startBounds: { ...element.bounds },
            vertexIndex,
            startPoints: JSON.parse(JSON.stringify(element.points)),
          });
        }
        return;
      }

      const resizeHandleId = target.getAttribute('data-resize-element-id');
      if (resizeHandleId) {
        event.preventDefault();
        event.stopPropagation();
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch (e) {}
        const element = canvasState.elements.find(el => el.id === resizeHandleId);
        if (element) {
          setResizingElement({
            elementId: resizeHandleId,
            startPointer: clientPos,
            startBounds: { ...element.bounds },
            startElement: JSON.parse(JSON.stringify(element)),
            handle: (target.getAttribute('data-resize-handle') as ResizeHandle | null) ?? 'se',
          });
        }
        return;
      }

      const clickedElement = [...canvasState.elements]
        .sort((a, b) => b.layer - a.layer)
        .find(el => {
          const pad = 4;
          return (
            clientPos.x >= el.bounds.x - pad &&
            clientPos.x <= el.bounds.x + el.bounds.width + pad &&
            clientPos.y >= el.bounds.y - pad &&
            clientPos.y <= el.bounds.y + el.bounds.height + pad
          );
        });

      if (clickedElement) {
        event.preventDefault();
        event.stopPropagation();

        if (clickedElement.locked) {
          setCanvasState(state => {
            const isAlreadySelected = state.selectedElementIds.includes(clickedElement.id);
            const selectedElementIds = event.shiftKey
              ? (isAlreadySelected ? state.selectedElementIds.filter(id => id !== clickedElement.id) : [...state.selectedElementIds, clickedElement.id])
              : [clickedElement.id];
            return { ...state, selectedElementIds };
          });
          return;
        }

        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch (e) {}

        const startBoundsMap: Record<string, CanvasBounds> = {};
        const startElementsMap: Record<string, CanvasElement> = {};
        const alreadySelected = canvasState.selectedElementIds.includes(clickedElement.id);
        const nextSelectedIds = event.shiftKey
          ? (alreadySelected ? canvasState.selectedElementIds : [...canvasState.selectedElementIds, clickedElement.id])
          : alreadySelected && canvasState.selectedElementIds.length > 1
            ? canvasState.selectedElementIds
          : [clickedElement.id];

        canvasState.elements.forEach(el => {
          if (nextSelectedIds.includes(el.id)) {
            startBoundsMap[el.id] = { ...el.bounds };
            startElementsMap[el.id] = JSON.parse(JSON.stringify(el));
          }
        });
        if (!startBoundsMap[clickedElement.id]) {
          startBoundsMap[clickedElement.id] = { ...clickedElement.bounds };
          startElementsMap[clickedElement.id] = JSON.parse(JSON.stringify(clickedElement));
        }

        const gesture: ElementDragGesture = {
          elementId: clickedElement.id,
          startPointer: clientPos,
          startBoundsMap,
          startElementsMap,
        };
        draggingElementRef.current = gesture;
        setDraggingElement(gesture);

        setCanvasState(state => ({
          ...state,
          selectedElementIds: nextSelectedIds,
        }));
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch (e) {}

      setCanvasState(state => {
        if (state.selectedElementIds.length === 0) return state;
        const next = { ...state, selectedElementIds: [], updatedAt: new Date().toISOString() };
        persistCanvasSnapshot(next);
        return next;
      });
      setSelectionDrag({
        start: clientPos,
        current: clientPos,
      });
      return;
    }

    if (currentMode === 'lasso') {
      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch (e) {}
      const gesture = {
        elementId: `lasso-${Date.now()}`,
        mode: currentMode,
        start: clientPos,
        points: [clientPos],
      };
      drawingRef.current = gesture;
      setDrawing(gesture);
      return;
    }

    if (currentMode === 'eraser') {
      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch (e) {}
      const gesture = {
        elementId: `eraser-${Date.now()}`,
        mode: currentMode,
        start: clientPos,
        points: [clientPos],
      };
      drawingRef.current = gesture;
      setDrawing(gesture);
      deleteIntersecting(clientPos, clientPos);
      return;
    }

    if (isFreeformMode(currentMode)) {
      event.preventDefault();
      event.stopPropagation();

      const defaultSize = currentMode === 'text' ? { width: 120, height: 32 } : { width: 140, height: 90 };
      const elementId = `canvas-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const element = createCanvasElement({
        id: elementId,
        kind: canvasKindForMode(currentMode),
        bounds: isDragDrawMode(currentMode) ? { x: clientPos.x, y: clientPos.y, width: 1, height: 1 } : { x: clientPos.x, y: clientPos.y, ...defaultSize },
        style: canvasState.styleDefaults,
        text: titleForCanvasMode(currentMode),
        points: [clientPos],
      });

      setCanvasState(state => reduceCanvasState(state, { type: 'add-element', element }));

      if (isDragDrawMode(currentMode)) {
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch (e) {}
        const gesture = { elementId, mode: currentMode, start: clientPos, points: [clientPos] };
        drawingRef.current = gesture;
        setDrawing(gesture);
      } else {
        setCanvasState(state => ({
          ...state,
          selectedElementIds: [elementId],
        }));
        onModeChange('move');
      }
    }
  };

  const handleFreeformPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const activePanning = panningCanvasRef.current ?? panningCanvas;
    if (activePanning) {
      event.preventDefault();
      event.stopPropagation();
      const dx = event.clientX - activePanning.startPointer.x;
      const dy = event.clientY - activePanning.startPointer.y;
      const newPan = {
        x: activePanning.startPan.x + dx,
        y: activePanning.startPan.y + dy,
      };
      setPan(newPan);
      setCanvasState(state => {
        const next = {
          ...state,
          viewport: { x: newPan.x, y: newPan.y, zoom: zoom / 100 },
          updatedAt: new Date().toISOString(),
        };
        persistCanvasSnapshot(next);
        return next;
      });
      onViewportChange?.({ zoom, pan: newPan });
      return;
    }

    const clientPos = getCanvasCoords(event.clientX, event.clientY);

    const activeDrag = draggingElementRef.current ?? draggingElement;
    if (activeDrag) {
      event.preventDefault();
      event.stopPropagation();
      const dx = clientPos.x - activeDrag.startPointer.x;
      const dy = clientPos.y - activeDrag.startPointer.y;
      setCanvasState(state => {
        const elements = state.elements.map(el => {
          const startEl = activeDrag.startElementsMap?.[el.id];
          if (startEl) {
            return {
              ...el,
              bounds: {
                ...el.bounds,
                x: startEl.bounds.x + dx,
                y: startEl.bounds.y + dy,
              },
              ...('points' in startEl && Array.isArray(startEl.points) ? {
                points: startEl.points.map((p: any) => ({ x: p.x + dx, y: p.y + dy }))
              } : {}),
              updatedAt: new Date().toISOString(),
            } as CanvasElement;
          }
          return el;
        });
        return { ...state, elements };
      });
      return;
    }

    if (rotatingElement) {
      event.preventDefault();
      event.stopPropagation();
      const currentAngle = Math.atan2(clientPos.y - rotatingElement.center.y, clientPos.x - rotatingElement.center.x);
      const deltaDeg = ((currentAngle - rotatingElement.startAngle) * 180) / Math.PI;
      let rotation = Math.round(rotatingElement.startRotation + deltaDeg);
      if (event.shiftKey) {
        rotation = Math.round(rotation / 15) * 15;
      }
      setCanvasState(state => {
        const elements = state.elements.map(el => (
          el.id === rotatingElement.elementId
            ? { ...el, rotation, updatedAt: new Date().toISOString() } as CanvasElement
            : el
        ));
        return { ...state, elements, updatedAt: new Date().toISOString() };
      });
      return;
    }

    if (resizingElement) {
      event.preventDefault();
      event.stopPropagation();
      const dx = clientPos.x - resizingElement.startPointer.x;
      const dy = clientPos.y - resizingElement.startPointer.y;
      setCanvasState(state => {
        const elements = state.elements.map(el => {
          if (el.id === resizingElement.elementId) {
            if (resizingElement.vertexIndex !== undefined && resizingElement.startPoints) {
              const startPoints = resizingElement.startPoints;
              const vertexIndex = resizingElement.vertexIndex;
              let movingPoint = {
                x: startPoints[vertexIndex].x + dx,
                y: startPoints[vertexIndex].y + dy,
              };
              if (event.shiftKey) {
                const otherPoint = startPoints[1 - vertexIndex];
                movingPoint = constrainLineAngle(otherPoint, movingPoint);
              }
              const points = [...startPoints];
              points[vertexIndex] = movingPoint;
              const bounds = boundsFromPoints(points);
              return {
                ...el,
                bounds,
                points,
                updatedAt: new Date().toISOString(),
              } as CanvasElement;
            } else {
              const rotation = el.rotation || 0;
              const rad = (rotation * Math.PI) / 180;
              const cos = Math.cos(rad);
              const sin = Math.sin(rad);

              const dxLocal = dx * cos + dy * sin;
              const dyLocal = -dx * sin + dy * cos;

              const handle = resizingElement.handle ?? 'se';
              const localBounds = resizeBounds(resizingElement.startBounds, handle, dxLocal, dyLocal, event.shiftKey);

              const cxOriginal = resizingElement.startBounds.x + resizingElement.startBounds.width / 2;
              const cyOriginal = resizingElement.startBounds.y + resizingElement.startBounds.height / 2;

              const cxLocal = localBounds.x + localBounds.width / 2;
              const cyLocal = localBounds.y + localBounds.height / 2;

              const dcxLocal = cxLocal - cxOriginal;
              const dcyLocal = cyLocal - cyOriginal;

              const dcxGlobal = dcxLocal * cos - dcyLocal * sin;
              const dcyGlobal = dcxLocal * sin + dcyLocal * cos;

              const cxNew = cxOriginal + dcxGlobal;
              const cyNew = cyOriginal + dcyGlobal;

              const xNew = cxNew - localBounds.width / 2;
              const yNew = cyNew - localBounds.height / 2;

              const bounds = {
                x: xNew,
                y: yNew,
                width: localBounds.width,
                height: localBounds.height,
              };

              return {
                ...el,
                bounds,
                ...('points' in (resizingElement.startElement ?? {}) && Array.isArray((resizingElement.startElement as any).points) ? {
                  points: (resizingElement.startElement as any).points.map((point: Point) => ({
                    x: bounds.x + ((point.x - resizingElement.startBounds.x) * bounds.width) / Math.max(1, resizingElement.startBounds.width),
                    y: bounds.y + ((point.y - resizingElement.startBounds.y) * bounds.height) / Math.max(1, resizingElement.startBounds.height),
                  })),
                } : {}),
                updatedAt: new Date().toISOString(),
              } as CanvasElement;
            }
          }
          return el;
        });
        return { ...state, elements };
      });
      return;
    }

    if (selectionDrag) {
      event.preventDefault();
      event.stopPropagation();
      setSelectionDrag(current => current ? { ...current, current: clientPos } : null);
      return;
    }

    const activeDrawing = drawingRef.current ?? drawing;
    if (activeDrawing) {
      event.preventDefault();
      event.stopPropagation();

      let endPoint = clientPos;

      if (event.shiftKey) {
        if (activeDrawing.mode === 'rectangle' || activeDrawing.mode === 'ellipse') {
          endPoint = constrainToSquare(activeDrawing.start, clientPos);
        } else if (activeDrawing.mode === 'line' || activeDrawing.mode === 'arrow') {
          endPoint = constrainLineAngle(activeDrawing.start, clientPos);
        }
      }

      const points = isPathMode(activeDrawing.mode)
        ? [...activeDrawing.points, clientPos]
        : [activeDrawing.start, endPoint];

      const bounds = boundsFromStartEnd(activeDrawing.start, endPoint);
      const nextDrawing = { ...activeDrawing, points };
      drawingRef.current = nextDrawing;
      setDrawing(nextDrawing);

      if (activeDrawing.mode === 'lasso') {
        return;
      }

      if (activeDrawing.mode === 'eraser') {
        deleteIntersecting(activeDrawing.start, clientPos);
        return;
      }

      setCanvasState(state => {
        const elements = state.elements.map(el => {
          if (el.id === activeDrawing.elementId) {
            return {
              ...el,
              bounds,
              ...((el.kind === 'line' || el.kind === 'arrow' || (el.kind !== 'unknown' && isPathMode(el.kind))) ? { points } : {}),
              updatedAt: new Date().toISOString(),
            } as CanvasElement;
          }
          return el;
        });
        return { ...state, elements };
      });
    }
  };

  const handleFreeformPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const wasActive = Boolean(
      panningCanvas ||
      draggingElementRef.current || draggingElement ||
      resizingElement ||
      rotatingElement ||
      selectionDrag ||
      (drawingRef.current ?? drawing)
    );
    const elapsed = pointerDownTimeRef.current ? performance.now() - pointerDownTimeRef.current : 0;
    pointerDownTimeRef.current = null;
    if (wasActive && elapsed > 0) {
      onCanvasInteractionDuration?.(elapsed);
    }

    if (panningCanvas) {
      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch (e) {}
      panningCanvasRef.current = null;
      setPanningCanvas(null);
      return;
    }

    if (draggingElementRef.current || draggingElement) {
      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch (e) {}
      draggingElementRef.current = null;
      setDraggingElement(null);
      return;
    }

    if (resizingElement) {
      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch (e) {}
      setResizingElement(null);
      return;
    }

    if (rotatingElement) {
      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch (e) {}
      setRotatingElement(null);
      return;
    }

    if (selectionDrag) {
      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch (e) {}

      const zone = boundsFromStartEnd(selectionDrag.start, selectionDrag.current);
      const isClick = zone.width < 4 && zone.height < 4;

      setCanvasState(state => {
        if (isClick) {
          return { ...state, selectedElementIds: [] };
        }
        const selectedIds = elementsIntersectingBounds(state, zone);
        return {
          ...state,
          selectedElementIds: event.shiftKey
            ? [...new Set([...state.selectedElementIds, ...selectedIds])]
            : selectedIds,
        };
      });

      setSelectionDrag(null);
      return;
    }

    const activeDrawing = drawingRef.current ?? drawing;
    if (activeDrawing) {
      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch (e) {}

      const finishedMode = activeDrawing.mode;
      const elementId = activeDrawing.elementId;
      drawingRef.current = null;
      setDrawing(null);

      if (finishedMode === 'lasso') {
        const lassoBounds = boundsFromPoints(activeDrawing.points);
        const selectedIds = elementsIntersectingBounds(canvasState, lassoBounds);
        setCanvasState(state => ({
          ...state,
          selectedElementIds: selectedIds,
        }));
        onModeChange('move');
        return;
      }

      if (finishedMode === 'eraser') {
        onModeChange('move');
        return;
      }

      if (finishedMode !== 'pen') {
        setCanvasState(state => ({
          ...state,
          selectedElementIds: [elementId],
        }));
        onModeChange('move');
      }
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      if (replacingImageId) {
        setCanvasState(state => {
          const elements = state.elements.map(el => {
            if (el.id === replacingImageId) {
              return { ...el, src, updatedAt: new Date().toISOString() } as CanvasElement;
            }
            return el;
          });
          return { ...state, elements };
        });
        setReplacingImageId(null);
      } else {
        const elementId = `canvas-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const element = createCanvasElement({
          id: elementId,
          kind: 'image',
          bounds: { x: 50, y: 50, width: 200, height: 150 },
          style: canvasState.styleDefaults,
          text: 'Image',
          src,
        });
        setCanvasState(state => reduceCanvasState(state, { type: 'add-element', element }));
        onModeChange('move');
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleDiagramViewportChange = useCallback((viewport: { zoom: number; pan: { x: number; y: number } }) => {
    setZoom(current => current === viewport.zoom ? current : viewport.zoom);
    setPan(current => current.x === viewport.pan.x && current.y === viewport.pan.y ? current : viewport.pan);
    setCanvasState(state => {
      const zoomScale = viewport.zoom / 100;
      if (state.viewport.x === viewport.pan.x && state.viewport.y === viewport.pan.y && state.viewport.zoom === zoomScale) {
        return state;
      }
      return reduceCanvasState(state, {
        type: 'set-viewport',
        viewport: { x: viewport.pan.x, y: viewport.pan.y, zoom: zoomScale },
      });
    });
    onViewportChange?.(viewport);
  }, [onViewportChange]);

  const renderFreeformElement = (element: CanvasElement) => {
    const isSelected = canvasState.selectedElementIds.includes(element.id);
    const strokeColor = isSelected ? '#1c7ed6' : element.style.stroke;

    const common = {
      stroke: strokeColor,
      fill: element.kind === 'line' || element.kind === 'arrow' || element.kind === 'pen' ? 'none' : element.style.fill,
      strokeWidth: element.style.strokeWidth,
      opacity: element.style.opacity,
    };
    const centerX = element.bounds.x + element.bounds.width / 2;
    const centerY = element.bounds.y + element.bounds.height / 2;
    const rotationTransform = element.rotation ? `rotate(${element.rotation} ${centerX} ${centerY})` : undefined;

    const renderSelectionBox = () => {
      if (!isSelected || mode !== 'move') return null;
      const pad = 3;
      const selectStroke = element.locked ? '#868e96' : '#1c7ed6';
      return (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={element.bounds.x - pad}
            y={element.bounds.y - pad}
            width={element.bounds.width + pad * 2}
            height={element.bounds.height + pad * 2}
            fill="none"
            stroke={selectStroke}
            strokeWidth={1.2}
            strokeDasharray={element.locked ? undefined : "3 3"}
          />
          {element.locked && (
            <g transform={`translate(${element.bounds.x - pad - 6}, ${element.bounds.y - pad - 6})`}>
              <rect x="0" y="0" width="12" height="12" rx="2" fill="#868e96" />
              <path d="M3,5 L3,3 A3,3 0 0,1 9,3 L9,5 M4,5 L8,5 L8,9 L4,9 Z" stroke="#ffffff" strokeWidth="1" fill="none" />
            </g>
          )}
        </g>
      );
    };

    const renderTransformControls = () => {
      if (!isSelected || mode !== 'move' || element.locked) return null;
      const pad = 3;
      const x = element.bounds.x - pad;
      const y = element.bounds.y - pad;
      const w = element.bounds.width + pad * 2;
      const h = element.bounds.height + pad * 2;
      const handles: Array<{ handle: ResizeHandle; x: number; y: number; cursor: string }> = [
        { handle: 'se', x: x + w, y: y + h, cursor: 'nwse-resize' },
        { handle: 'nw', x, y, cursor: 'nwse-resize' },
        { handle: 'n', x: x + w / 2, y, cursor: 'ns-resize' },
        { handle: 'ne', x: x + w, y, cursor: 'nesw-resize' },
        { handle: 'e', x: x + w, y: y + h / 2, cursor: 'ew-resize' },
        { handle: 's', x: x + w / 2, y: y + h, cursor: 'ns-resize' },
        { handle: 'sw', x, y: y + h, cursor: 'nesw-resize' },
        { handle: 'w', x, y: y + h / 2, cursor: 'ew-resize' },
      ];
      const rotateX = x + w / 2;
      const rotateY = y - 24;
      return (
        <g className="iso-freeform-transform-controls" style={{ pointerEvents: 'auto' }}>
          <line x1={rotateX} y1={y} x2={rotateX} y2={rotateY + 6} stroke="#1c7ed6" strokeWidth={1} pointerEvents="none" />
          <circle
            className="iso-freeform-rotate-handle"
            data-rotate-element-id={element.id}
            aria-label={`Rotate ${element.id}`}
            cx={rotateX}
            cy={rotateY}
            r={6}
            fill="#ffffff"
            stroke="#1c7ed6"
            strokeWidth={1.5}
            style={{ cursor: 'grab', pointerEvents: 'auto' }}
          />
          {handles.map(handle => (
            <rect
              key={handle.handle}
              className="iso-freeform-resize-handle"
              data-resize-element-id={element.id}
              data-resize-handle={handle.handle}
              aria-label={handle.handle === 'se' ? `Resize ${element.id}` : `Resize ${element.id} from ${handle.handle}`}
              x={handle.x - 4}
              y={handle.y - 4}
              width={8}
              height={8}
              rx={2}
              fill="#ffffff"
              stroke="#1c7ed6"
              strokeWidth={1.5}
              style={{ cursor: getRotatedCursor(handle.handle, element.rotation), pointerEvents: 'auto' }}
            />
          ))}
        </g>
      );
    };

    const renderLineResizeHandles = () => {
      if (!isSelected || mode !== 'move' || element.locked) return null;
      const points = 'points' in element ? element.points : [];
      if (points.length < 2) return null;
      return (
        <g style={{ pointerEvents: 'auto' }}>
          <circle
            className="iso-freeform-vertex-handle"
            data-vertex-element-id={element.id}
            data-vertex-index="0"
            aria-label={`Move start of ${element.id}`}
            cx={points[0].x}
            cy={points[0].y}
            r={5}
            fill="#ffffff"
            stroke="#1c7ed6"
            strokeWidth={1.5}
            style={{ cursor: 'move', pointerEvents: 'auto' }}
          />
          <circle
            className="iso-freeform-vertex-handle"
            data-vertex-element-id={element.id}
            data-vertex-index="1"
            aria-label={`Move end of ${element.id}`}
            cx={points[1].x}
            cy={points[1].y}
            r={5}
            fill="#ffffff"
            stroke="#1c7ed6"
            strokeWidth={1.5}
            style={{ cursor: 'move', pointerEvents: 'auto' }}
          />
        </g>
      );
    };

    if (element.kind === 'ellipse') {
      return (
        <g key={element.id} data-canvas-element-id={element.id} transform={rotationTransform}>
          <ellipse
            cx={element.bounds.x + element.bounds.width / 2}
            cy={element.bounds.y + element.bounds.height / 2}
            rx={element.bounds.width / 2}
            ry={element.bounds.height / 2}
            {...common}
            style={{ cursor: mode === 'move' ? (element.locked ? 'not-allowed' : 'move') : undefined, pointerEvents: 'all' }}
          />
          {renderSelectionBox()}
          {renderTransformControls()}
        </g>
      );
    }

    if (element.kind === 'line' || element.kind === 'arrow') {
      const points = 'points' in element ? element.points : [];
      const x1 = points[0] ? points[0].x : element.bounds.x;
      const y1 = points[0] ? points[0].y : element.bounds.y;
      const x2 = points[1] ? points[1].x : element.bounds.x + element.bounds.width;
      const y2 = points[1] ? points[1].y : element.bounds.y + element.bounds.height;
      return (
        <g key={element.id} data-canvas-element-id={element.id} transform={rotationTransform}>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="transparent"
            strokeWidth={24}
            style={{ cursor: mode === 'move' ? (element.locked ? 'not-allowed' : 'move') : undefined, pointerEvents: 'stroke' }}
          />
          <line x1={x1} y1={y1} x2={x2} y2={y2} {...common} style={{ pointerEvents: 'none' }} markerEnd={element.kind === 'arrow' ? 'url(#isx-freeform-arrow)' : undefined} />
          {renderSelectionBox()}
          {renderTransformControls()}
          {renderLineResizeHandles()}
        </g>
      );
    }

    if (element.kind === 'pen' || element.kind === 'eraser' || element.kind === 'laser' || element.kind === 'lasso') {
      const points = 'points' in element ? element.points : [];
      const path = points.length > 0
        ? points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
        : `M ${element.bounds.x} ${element.bounds.y} L ${element.bounds.x + element.bounds.width} ${element.bounds.y + element.bounds.height}`;
      return (
        <g key={element.id} data-canvas-element-id={element.id} transform={rotationTransform}>
          <path
            d={path}
            fill="none"
            stroke="transparent"
            strokeWidth={24}
            style={{ cursor: mode === 'move' ? (element.locked ? 'not-allowed' : 'move') : undefined, pointerEvents: 'stroke' }}
          />
          <path d={path} {...common} style={{ pointerEvents: 'none' }} strokeDasharray={element.kind === 'lasso' ? '6 4' : undefined} />
          {renderSelectionBox()}
          {renderTransformControls()}
        </g>
      );
    }

    if (element.kind === 'text') {
      const textVal = 'text' in element ? element.text : 'Text';
      const fontSizeVal = 'fontSize' in element ? element.fontSize : 16;
      return (
        <g key={element.id} data-canvas-element-id={element.id} transform={rotationTransform}>
          <rect
            x={element.bounds.x}
            y={element.bounds.y}
            width={element.bounds.width}
            height={element.bounds.height}
            fill="transparent"
            style={{ cursor: mode === 'move' ? (element.locked ? 'not-allowed' : 'move') : undefined, pointerEvents: 'all' }}
          />
          <text x={element.bounds.x} y={element.bounds.y + 18} fill={isSelected ? '#1c7ed6' : element.style.text} opacity={element.style.opacity} fontSize={fontSizeVal} style={{ pointerEvents: 'none' }}>
            {textVal}
          </text>
          {renderSelectionBox()}
          {renderTransformControls()}
        </g>
      );
    }

    if (element.kind === 'image') {
      const preserveAspectRatio = element.fit === 'stretch' ? 'none' : element.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
      return (
        <g key={element.id} data-canvas-element-id={element.id} transform={rotationTransform}>
          {'src' in element && element.src ? (
            <image href={element.src} x={element.bounds.x} y={element.bounds.y} width={element.bounds.width} height={element.bounds.height} preserveAspectRatio={preserveAspectRatio} style={{ cursor: mode === 'move' ? (element.locked ? 'not-allowed' : 'move') : undefined, pointerEvents: 'all' }} />
          ) : (
            <rect {...element.bounds} {...common} strokeDasharray="6 4" style={{ cursor: mode === 'move' ? (element.locked ? 'not-allowed' : 'move') : undefined, pointerEvents: 'all' }} />
          )}
          <text x={element.bounds.x + 12} y={element.bounds.y + 24} fill={isSelected ? '#1c7ed6' : element.style.text} fontSize={13} style={{ pointerEvents: 'none' }}>Image</text>
          {renderSelectionBox()}
          {renderTransformControls()}
        </g>
      );
    }

    const dashed = element.kind === 'frame' || element.kind === 'embed' || element.kind === 'uml-package';
    const rxVal = element.kind === 'rectangle' ? 6 : 2;
    return (
      <g key={element.id} data-canvas-element-id={element.id} transform={rotationTransform}>
        <rect rx={rxVal} {...element.bounds} {...common} strokeDasharray={dashed ? '8 5' : undefined} style={{ cursor: mode === 'move' ? (element.locked ? 'not-allowed' : 'move') : undefined, pointerEvents: 'all' }} />
        {'title' in element && element.title ? <text x={element.bounds.x + 10} y={element.bounds.y + 22} fill={element.style.text} fontSize={13} style={{ pointerEvents: 'none' }}>{element.title}</text> : null}
        {element.kind === 'embed' ? <text x={element.bounds.x + 10} y={element.bounds.y + 42} fill={element.style.text} fontSize={12} style={{ pointerEvents: 'none' }}>Web embed</text> : null}
        {renderSelectionBox()}
        {renderTransformControls()}
      </g>
    );
  };

  const selectedElements = canvasState.elements.filter(el => canvasState.selectedElementIds.includes(el.id));
  const selectedElement = selectedElements.length === 1 ? selectedElements[0] : null;
  const activeStyle = selectedElement ? selectedElement.style : canvasState.styleDefaults;
  const hasCanvasContent = canvasState.elements.length > 0;
  const canExportCanvas = canExport || hasCanvasContent;
  const draftLink = selectedElement
    ? canvasState.draftSemanticLinks.find(link => link.canvasElementId === selectedElement.id)
    : undefined;

  return (
    <section className="iso-full-canvas-shell" aria-label="Full canvas" data-canvas-storage-key={canvasStorageKey}>
      <div className="iso-dropdown iso-full-canvas-actions-dropdown" ref={moreActionsRef} style={{ position: 'fixed', top: '14px', left: '14px', zIndex: 70 }}>
        <button
          type="button"
          className="iso-full-canvas-action iso-full-canvas-hamburger"
          style={{
            border: '1px solid var(--iso-border)',
            background: 'color-mix(in srgb, var(--iso-bg-panel) 88%, transparent)',
            boxShadow: 'var(--iso-shadow)',
            backdropFilter: 'blur(18px)',
            width: '32px',
            height: '32px',
            borderRadius: '999px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '3px',
            cursor: 'pointer'
          }}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={moreActionsOpen}
          onClick={() => setMoreActionsOpen(open => !open)}
        >
          <span aria-hidden="true" style={{ width: '14px', height: '1.5px', background: 'currentColor', borderRadius: '999px' }}></span>
          <span aria-hidden="true" style={{ width: '14px', height: '1.5px', background: 'currentColor', borderRadius: '999px' }}></span>
          <span aria-hidden="true" style={{ width: '14px', height: '1.5px', background: 'currentColor', borderRadius: '999px' }}></span>
        </button>
        {moreActionsOpen && (
          <div className="iso-dropdown-menu iso-full-canvas-menu" role="menu" aria-label="Canvas more actions" style={{ top: 'calc(100% + 8px)', bottom: 'auto' }}>
            <div className="iso-dropdown-group-title" style={{ padding: '6px 12px 2px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--iso-text-muted)', fontWeight: 600 }}>Document Actions</div>
            <button
              type="button"
              className="iso-dropdown-item"
              role="menuitem"
              disabled={!hasDiagram || !canSave || !onSave}
              onClick={() => {
                setMoreActionsOpen(false);
                onSave?.();
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="iso-dropdown-item"
              role="menuitem"
              disabled={!canExportCanvas}
              onClick={() => {
                setMoreActionsOpen(false);
                onExportSVG();
              }}
            >
              Export SVG
            </button>
            <button
              type="button"
              className="iso-dropdown-item"
              role="menuitem"
              disabled={!canExportCanvas}
              onClick={() => {
                setMoreActionsOpen(false);
                onExportPNG();
              }}
            >
              Export PNG
            </button>

            <div style={{ height: '1px', background: 'var(--iso-border)', margin: '4px 0' }} />

            <div className="iso-dropdown-group-title" style={{ padding: '6px 12px 2px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--iso-text-muted)', fontWeight: 600 }}>Analysis Tools</div>
            <button
              type="button"
              className="iso-dropdown-item"
              role="menuitem"
              onClick={() => {
                setMoreActionsOpen(false);
                onValidate?.();
              }}
            >
              Validate
            </button>
            <button
              type="button"
              className="iso-dropdown-item"
              role="menuitem"
              onClick={() => {
                setMoreActionsOpen(false);
                onFitCanvas?.();
              }}
            >
              Zoom to Fit
            </button>

            <div style={{ height: '1px', background: 'var(--iso-border)', margin: '4px 0' }} />

            <div className="iso-dropdown-group-title" style={{ padding: '6px 12px 2px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--iso-text-muted)', fontWeight: 600 }}>Settings</div>
            <button
              type="button"
              className="iso-dropdown-item"
              role="menuitem"
              onClick={() => {
                setMoreActionsOpen(false);
                onBack();
              }}
            >
              Source view
            </button>
            <button
              type="button"
              className="iso-dropdown-item"
              role="menuitem"
              onClick={() => {
                setMoreActionsOpen(false);
                onOpenShortcuts?.();
              }}
            >
              Shortcuts
            </button>
            {onStrictUmlChange && (
              <label className="iso-dropdown-item iso-dropdown-check" role="menuitemcheckbox" aria-checked={Boolean(strictUmlEnabled)}>
                <input
                  type="checkbox"
                  checked={Boolean(strictUmlEnabled)}
                  onChange={event => onStrictUmlChange(event.target.checked)}
                />
                <span>Strict UML rules</span>
              </label>
            )}
          </div>
        )}
      </div>

      <div className="iso-full-canvas-toolbox" ref={moreToolsRef}>
        <CanvasToolbar
          mode={mode}
          disabled={false}
          language={language}
          onModeChange={onModeChange}
          onMoreTools={() => setMoreToolsOpen(open => !open)}
        />
        {moreToolsOpen && (
          <div className="iso-dropdown-menu iso-full-canvas-tool-menu" role="menu" aria-label="More canvas tools">
            {[
              ['Frame', 'frame'],
              ['Web embed', 'embed'],
              ['Laser pointer', 'laser'],
              ['Lasso', 'lasso'],
              ['UML package', 'uml-package'],
            ].map(([label, tool]) => (
              <button
                key={tool}
                type="button"
                className="iso-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setMoreToolsOpen(false);
                  onModeChange(tool as FullCanvasMode);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <CanvasPropertiesPanel
        visible={mode === 'move' && selectedElements.length > 0}
        uiLanguage={language}
        style={activeStyle}
        selectedElements={selectedElements}
        draftLink={draftLink}
        onStyleChange={handleStyleChange}
        onElementChange={handleElementChange}
        onDraftSemanticLink={handleDraftSemanticLink}
        onReplaceImage={handleReplaceImage}
        onDelete={handleDeleteSelected}
        onBringForward={handleBringForward}
        onSendBackward={handleSendBackward}
        onDuplicate={handleDuplicate}
        onPromoteToDSL={onPromoteToDSL}
      />

      <div className="iso-full-canvas-pill" aria-label="Canvas document status">
        <IconDiagram size={12} />
        <strong>{diagram?.name ?? 'No diagram'}</strong>
        <span>{diagram?.kind ?? 'canvas'}</span>
        <span className="iso-full-canvas-pill-status">{statusLabel ?? 'Valid'}</span>
      </div>

      <div className="iso-full-canvas-dock" aria-label="Canvas actions">
        <div className="iso-full-canvas-collab">
          <span className="iso-avatar-stack" aria-hidden="true"><span>L</span><span>+</span></span>
          <button type="button" className="iso-full-canvas-action" onClick={onShare}>Share</button>
          <button type="button" className="iso-full-canvas-action" onClick={onBack}>Back</button>
        </div>
      </div>

      <div className="iso-full-canvas-viewport" ref={viewportRef}>
        <DiagramView
          diagram={diagram}
          diagrams={diagrams}
          language={language}
          availableTools={toolsForMode(semanticMode)}
          activeTool={canvasTool}
          showToolRail={false}
          showZoomControls={false}
          fitSignal={fitSignal}
          zoom={zoom}
          pan={pan}
          onViewportChange={handleDiagramViewportChange}
          showEmptyState={false}
          onEntityMove={onEntityMove}
          onEntityResize={onEntityResize}
          onEntityEditRequest={onEntityEditRequest}
          onRelationEditRequest={onRelationEditRequest}
          onRelationVerticalMove={onRelationVerticalMove}
          onRelationAddRequest={onRelationAddRequest}
          onExportSVG={onExportSVG}
          onDropEntity={onDropEntity}
          onTextRenameRequest={onTextRenameRequest}
          selectedItems={selectedItems}
          onSelectionChange={onSelectionChange}
          pendingDropKeyword={pendingDropKeyword}
          onConsumePendingDrop={onConsumePendingDrop}
          onRender={onRender}
        />
        <svg
          ref={overlayRef}
          className={`iso-freeform-overlay${isFreeformMode(mode) || mode === 'move' || mode === 'hand' ? ' iso-freeform-overlay--active' : ''}`}
          aria-label="Freeform canvas layer"
          data-canvas-mode={mode}
          style={{ pointerEvents: isFreeformMode(mode) || mode === 'move' || mode === 'hand' ? 'auto' : 'none' }}
          onPointerDown={handleFreeformPointerDown}
          onPointerMove={handleFreeformPointerMove}
          onPointerUp={handleFreeformPointerUp}
          onPointerCancel={handleFreeformPointerUp}
        >
          <defs>
            <marker id="isx-freeform-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill={DEFAULT_CANVAS_STYLE.stroke} />
            </marker>
          </defs>
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom / 100})`}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`, transformOrigin: '0 0' }}
          >
            {canvasState.elements.map(renderFreeformElement)}
            {selectionDrag && (
              <rect
                className="iso-freeform-selection-zone"
                x={Math.min(selectionDrag.start.x, selectionDrag.current.x)}
                y={Math.min(selectionDrag.start.y, selectionDrag.current.y)}
                width={Math.abs(selectionDrag.current.x - selectionDrag.start.x)}
                height={Math.abs(selectionDrag.current.y - selectionDrag.start.y)}
                fill="rgba(28, 126, 214, 0.1)"
                stroke="#1c7ed6"
                strokeWidth={1}
                strokeDasharray="3 3"
                style={{ pointerEvents: 'none' }}
              />
            )}
            {drawing && (drawing.mode === 'lasso' || drawing.mode === 'eraser' || drawing.mode === 'pen' || drawing.mode === 'laser') && (
              <path
                d={drawing.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                fill="none"
                stroke={drawing.mode === 'lasso' ? '#1c7ed6' : drawing.mode === 'eraser' ? '#fa5252' : canvasState.styleDefaults.stroke}
                strokeWidth={drawing.mode === 'eraser' ? 12 : canvasState.styleDefaults.strokeWidth}
                strokeDasharray={drawing.mode === 'lasso' ? '6 4' : undefined}
                opacity={drawing.mode === 'laser' ? 0.8 : canvasState.styleDefaults.opacity}
              />
            )}
          </g>
        </svg>
      </div>
      <div className="iso-full-canvas-zoom" aria-label="Viewport controls">
        <button type="button" className="iso-full-canvas-action" onClick={onFitCanvas} disabled={!hasDiagram || !onFitCanvas}>
          {fitLabel}
        </button>
        <span>{zoomLabel}</span>
      </div>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />
    </section>
  );
}
