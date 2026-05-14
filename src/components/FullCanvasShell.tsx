import { useEffect, useRef, useState } from 'react';
import { DiagramView } from './DiagramView.js';
import type { CanvasTool } from './DiagramView.js';
import { IconChevron, IconDiagram } from './Icons.js';
import type { IOMDiagram, IOMEntity } from '../semantics/iom.js';
import type { Language } from '../i18n.js';
import { CanvasToolbar } from './CanvasToolbar.js';
import { CanvasPropertiesStrip } from './CanvasPropertiesStrip.js';
import { DEFAULT_CANVAS_STYLE } from '../canvas/canvasStyle.js';
import type { CanvasElement, CanvasState } from '../canvas/canvasTypes.js';
import { createEmptyCanvasState, parseCanvasStateText, serializeCanvasState } from '../canvas/canvasSerialization.js';
import { createCanvasElement } from '../canvas/canvasTools.js';
import { reduceCanvasState } from '../canvas/canvasState.js';

export type FullCanvasMode =
  | 'move'
  | 'hand'
  | 'add-edge'
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
  language?: Language;
  mode: FullCanvasMode;
  zoomLabel?: string;
  fitLabel?: string;
  canSave?: boolean;
  canExport?: boolean;
  statusLabel?: string;
  onModeChange: (mode: FullCanvasMode) => void;
  onFitCanvas?: () => void;
  onSave: () => void;
  onExportSVG: () => void;
  onExportPNG: () => void;
  onBack: () => void;
  onShare?: () => void;
  onOpenShortcuts?: () => void;
  onValidate?: () => void;
  onEntityMove?: (entityName: string, x: number, y: number, dx?: number, dy?: number, seedPositions?: Record<string, { x: number; y: number; w?: number; h?: number }>) => void;
  onEntityResize?: (entityName: string, w: number, h: number, x?: number, y?: number) => void;
  onEntityEditRequest?: (entity: IOMEntity) => void;
  onRelationEditRequest?: (relationId: string, currentLabel: string, currentKind: string) => void;
  onRelationVerticalMove?: (relationId: string, y: number, seedRelationYs?: Record<string, number>) => void;
  onRelationAddRequest?: (fromEntity: string, toEntity: string, y?: number) => void;
  onDropEntity?: (keyword: string, x: number, y: number, targetPackage?: string) => void;
  onTextRenameRequest?: (oldText: string, newText: string, type: 'diagram' | 'package') => void;
  selectedItems?: { type: 'entity' | 'relation'; id: string }[];
  onSelectionChange?: (selection: { type: 'entity' | 'relation'; id: string }[]) => void;
  pendingDropKeyword?: string | null;
  onConsumePendingDrop?: () => void;
  activeTool?: CanvasTool;
  fitSignal?: number;
  onViewportChange?: (viewport: { zoom: number; pan: { x: number; y: number } }) => void;
  canvasStorageKey?: string;
  onCanvasStateChange?: (state: CanvasState) => void;
}

function toolsForMode(mode: FullCanvasMode): CanvasTool[] {
  if (mode === 'add-edge' || mode === 'arrow' || mode === 'line') return ['add-edge', 'edit-node', 'edit-edge'];
  if (mode === 'hand') return ['hand', 'edit-node', 'edit-edge'];
  if (mode === 'locked') return ['hand'];
  return ['move', 'hand', 'edit-node', 'edit-edge', 'add-edge'];
}

function modeToDiagramTool(mode: FullCanvasMode): FullCanvasMode {
  if (mode === 'arrow' || mode === 'line') return 'add-edge';
  return mode;
}

function modeToCanvasTool(mode: FullCanvasMode): CanvasTool {
  if (mode === 'hand' || mode === 'locked') return 'hand';
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
  if (mode === 'locked' || mode === 'move' || mode === 'hand' || mode === 'add-edge') return 'rectangle';
  return mode;
}

function isDragDrawMode(mode: FullCanvasMode): boolean {
  return mode === 'rectangle' || mode === 'ellipse' || mode === 'line' || mode === 'arrow' || mode === 'pen' || mode === 'eraser' || mode === 'laser' || mode === 'lasso';
}

function isPathMode(mode: FullCanvasMode): boolean {
  return mode === 'pen' || mode === 'eraser' || mode === 'laser' || mode === 'lasso';
}

function pointFromEvent(event: React.PointerEvent<SVGSVGElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function boundsFromStartEnd(start: { x: number; y: number }, end: { x: number; y: number }) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.max(1, Math.abs(end.x - start.x)),
    height: Math.max(1, Math.abs(end.y - start.y)),
  };
}

function titleForCanvasMode(mode: FullCanvasMode): string | undefined {
  if (mode === 'text') return 'Text';
  if (mode === 'uml-package') return 'Package';
  if (mode === 'frame') return 'Frame';
  if (mode === 'embed') return 'Web embed';
  return undefined;
}

function renderFreeformElement(element: CanvasElement) {
  const common = {
    stroke: element.style.stroke,
    fill: element.kind === 'line' || element.kind === 'arrow' || element.kind === 'pen' ? 'none' : element.style.fill,
    strokeWidth: element.style.strokeWidth,
    opacity: element.style.opacity,
  };

  if (element.kind === 'ellipse') {
    return (
      <ellipse
        key={element.id}
        cx={element.bounds.x + element.bounds.width / 2}
        cy={element.bounds.y + element.bounds.height / 2}
        rx={element.bounds.width / 2}
        ry={element.bounds.height / 2}
        {...common}
      />
    );
  }
  if (element.kind === 'line' || element.kind === 'arrow') {
    const x1 = element.bounds.x;
    const y1 = element.bounds.y;
    const x2 = element.bounds.x + element.bounds.width;
    const y2 = element.bounds.y + element.bounds.height;
    return (
      <g key={element.id}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} {...common} markerEnd={element.kind === 'arrow' ? 'url(#isx-freeform-arrow)' : undefined} />
      </g>
    );
  }
  if (element.kind === 'pen' || element.kind === 'eraser' || element.kind === 'laser' || element.kind === 'lasso') {
    const points = 'points' in element ? element.points : [];
    const path = points.length > 0
      ? points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
      : `M ${element.bounds.x} ${element.bounds.y} L ${element.bounds.x + element.bounds.width} ${element.bounds.y + element.bounds.height}`;
    return <path key={element.id} d={path} {...common} strokeDasharray={element.kind === 'lasso' ? '6 4' : undefined} />;
  }
  if (element.kind === 'text') {
    return (
      <text key={element.id} x={element.bounds.x} y={element.bounds.y + 18} fill={element.style.text} opacity={element.style.opacity} fontSize={'fontSize' in element ? element.fontSize : 16}>
        {'text' in element ? element.text : 'Text'}
      </text>
    );
  }
  if (element.kind === 'image') {
    return (
      <g key={element.id}>
        <rect {...element.bounds} {...common} strokeDasharray="6 4" />
        <text x={element.bounds.x + 12} y={element.bounds.y + 24} fill={element.style.text} fontSize={13}>Image</text>
      </g>
    );
  }
  const dashed = element.kind === 'frame' || element.kind === 'embed' || element.kind === 'uml-package';
  return (
    <g key={element.id}>
      <rect rx={element.kind === 'rectangle' ? 6 : 2} {...element.bounds} {...common} strokeDasharray={dashed ? '8 5' : undefined} />
      {'title' in element && element.title ? <text x={element.bounds.x + 10} y={element.bounds.y + 22} fill={element.style.text} fontSize={13}>{element.title}</text> : null}
      {element.kind === 'embed' ? <text x={element.bounds.x + 10} y={element.bounds.y + 42} fill={element.style.text} fontSize={12}>Web embed</text> : null}
    </g>
  );
}

export function FullCanvasShell({
  diagram,
  language,
  mode,
  zoomLabel = '100%',
  fitLabel = 'Fit',
  canSave = true,
  canExport = true,
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
}: FullCanvasShellProps) {
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [drawing, setDrawing] = useState<{
    elementId: string;
    mode: FullCanvasMode;
    start: { x: number; y: number };
    points: Array<{ x: number; y: number }>;
  } | null>(null);
  const [canvasState, setCanvasState] = useState<CanvasState>(() => {
    if (!canvasStorageKey || typeof localStorage === 'undefined') return createEmptyCanvasState();
    return parseCanvasStateText(localStorage.getItem(canvasStorageKey));
  });
  const hasDiagram = Boolean(diagram);
  const semanticMode = modeToDiagramTool(mode);
  const canvasTool = activeTool ?? modeToCanvasTool(mode);
  const hasCanvasSelection = canvasState.selectedElementIds.length > 0;

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

  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [moreMenuOpen]);

  const handleFreeformPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isFreeformMode(mode)) return;
    event.preventDefault();
    event.stopPropagation();
    const { x, y } = pointFromEvent(event);
    const defaultSize = mode === 'text' ? { width: 120, height: 32 } : { width: 140, height: 90 };
    const elementId = `canvas-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const element = createCanvasElement({
      id: elementId,
      kind: canvasKindForMode(mode),
      bounds: isDragDrawMode(mode) ? { x, y, width: 1, height: 1 } : { x, y, ...defaultSize },
      style: canvasState.styleDefaults,
      text: titleForCanvasMode(mode),
      points: [{ x, y }],
    });
    setCanvasState(state => reduceCanvasState(state, { type: 'add-element', element }));
    if (isDragDrawMode(mode)) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDrawing({ elementId, mode, start: { x, y }, points: [{ x, y }] });
    }
  };

  const handleFreeformPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);
    const points = isPathMode(drawing.mode) ? [...drawing.points, point] : [drawing.start, point];
    const bounds = boundsFromStartEnd(drawing.start, point);
    setDrawing(current => current ? { ...current, points } : current);
    setCanvasState(state => reduceCanvasState(state, {
      type: 'update-element',
      id: drawing.elementId,
      patch: {
        bounds,
        ...((drawing.mode === 'line' || drawing.mode === 'arrow' || isPathMode(drawing.mode)) ? { points } : {}),
      } as Partial<CanvasElement>,
    }));
  };

  const handleFreeformPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDrawing(null);
  };

  return (
    <section className="iso-full-canvas-shell" aria-label="Full canvas">
      <CanvasToolbar mode={mode} disabled={!hasDiagram} onModeChange={onModeChange} onMoreTools={() => setMoreMenuOpen(open => !open)} />
      <CanvasPropertiesStrip visible={hasCanvasSelection || (selectedItems != null && selectedItems.length > 0)} style={DEFAULT_CANVAS_STYLE} />

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

        <div className="iso-full-canvas-actions">
          <button type="button" className="iso-full-canvas-action" onClick={onSave} disabled={!hasDiagram || !canSave}>Save</button>
          <button type="button" className="iso-full-canvas-action" onClick={onExportSVG} disabled={!hasDiagram || !canExport}>SVG</button>
          <button type="button" className="iso-full-canvas-action" onClick={onExportPNG} disabled={!hasDiagram || !canExport}>PNG</button>
          <div className="iso-dropdown" ref={moreMenuRef}>
            <button
              type="button"
              className="iso-full-canvas-action"
              aria-haspopup="menu"
              aria-expanded={moreMenuOpen}
              onClick={() => setMoreMenuOpen(open => !open)}
            >
              More <IconChevron dir={moreMenuOpen ? 'up' : 'down'} />
            </button>
            {moreMenuOpen && (
              <div className="iso-dropdown-menu iso-full-canvas-menu" role="menu" aria-label="Canvas more actions">
                <button type="button" className="iso-dropdown-item" role="menuitem" onClick={() => { setMoreMenuOpen(false); onValidate?.(); }}>
                  Validate
                </button>
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
                      setMoreMenuOpen(false);
                      onModeChange(tool as FullCanvasMode);
                    }}
                  >
                    {label}
                  </button>
                ))}
                <button type="button" className="iso-dropdown-item" role="menuitem" onClick={() => { setMoreMenuOpen(false); onFitCanvas?.(); }}>
                  {fitLabel}
                </button>
                <button type="button" className="iso-dropdown-item" role="menuitem" onClick={() => { setMoreMenuOpen(false); onBack(); }}>
                  Source view
                </button>
                <button type="button" className="iso-dropdown-item" role="menuitem" onClick={() => { setMoreMenuOpen(false); onOpenShortcuts?.(); }}>
                  Shortcuts
                </button>
                <button type="button" className="iso-dropdown-item" role="menuitem" onClick={() => { setMoreMenuOpen(false); onExportSVG(); }}>
                  Export SVG
                </button>
                <button type="button" className="iso-dropdown-item" role="menuitem" onClick={() => { setMoreMenuOpen(false); onExportPNG(); }}>
                  Export PNG
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="iso-full-canvas-viewport">
        <DiagramView
          diagram={diagram}
          language={language}
          availableTools={toolsForMode(semanticMode)}
          activeTool={canvasTool}
          showToolRail={false}
          showZoomControls={false}
          fitSignal={fitSignal}
          onViewportChange={onViewportChange}
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
        />
        <svg
          ref={overlayRef}
          className={`iso-freeform-overlay${isFreeformMode(mode) ? ' iso-freeform-overlay--active' : ''}`}
          aria-label="Freeform canvas layer"
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
          {canvasState.elements.map(renderFreeformElement)}
        </svg>
      </div>
      <div className="iso-full-canvas-zoom" aria-label="Viewport controls">
        <button type="button" className="iso-full-canvas-action" onClick={onFitCanvas} disabled={!hasDiagram || !onFitCanvas}>
          {fitLabel}
        </button>
        <span>{zoomLabel}</span>
      </div>
    </section>
  );
}
