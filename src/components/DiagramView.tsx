// ============================================================
// DiagramView — SVG Diagram Canvas Component (v3)
// ============================================================
// Adds:
//   - Entity Toolbox (drag-to-create from palette)
//   - Arrow drawing between entities (click source → click target)
//   - Double-click arrow labels to edit
//   - Arrow type picker
//   - Improved drag-to-reposition
// ============================================================

import { useRef, useEffect, useState, useCallback } from 'react';
import type { IOMDiagram } from '../semantics/iom.js';
import { renderDiagram } from '../renderer/index.js';

// ─── Types ───────────────────────────────────────────────────

type ToolboxItem = { kind: string; label: string; icon: string };
type ArrowKind = { op: string; label: string };

const ENTITY_TOOLS: ToolboxItem[] = [
  { kind: 'class',     label: 'Class',     icon: 'C' },
  { kind: 'abstract',  label: 'Abstract',  icon: 'A' },
  { kind: 'interface', label: 'Interface', icon: 'I' },
  { kind: 'enum',      label: 'Enum',      icon: 'E' },
  { kind: 'actor',     label: 'Actor',     icon: '🧑' },
  { kind: 'usecase',   label: 'Use Case',  icon: '◯' },
  { kind: 'component', label: 'Component', icon: '⬜' },
  { kind: 'node',      label: 'Node',      icon: '▣' },
];

const ARROW_KINDS: ArrowKind[] = [
  { op: '--',    label: 'Association' },
  { op: '-->',   label: 'Directed' },
  { op: '--|>',  label: 'Inheritance' },
  { op: '..|>',  label: 'Realization' },
  { op: '--*',   label: 'Composition' },
  { op: '--o',   label: 'Aggregation' },
  { op: '..>',   label: 'Dependency' },
];

interface DiagramViewProps {
  diagram: IOMDiagram | null;
  diagramKind?: string;
  onEntityMove?: (entityName: string, x: number, y: number) => void;
  onExportSVG?: () => void;
  onAddEntity?: (kind: string, name: string, x: number, y: number) => void;
  onAddRelation?: (from: string, to: string, operator: string, label: string) => void;
  onEditRelationLabel?: (from: string, to: string, oldLabel: string, newLabel: string) => void;
}

export function DiagramView({
  diagram,
  diagramKind,
  onEntityMove,
  onExportSVG,
  onAddEntity,
  onAddRelation,
  onEditRelationLabel,
}: DiagramViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [arrowMode, setArrowMode] = useState(false);
  const [arrowKind, setArrowKind] = useState<ArrowKind>(ARROW_KINDS[0]);
  const [arrowSource, setArrowSource] = useState<string | null>(null);
  const [showArrowPicker, setShowArrowPicker] = useState(false);
  const [toolboxCollapsed, setToolboxCollapsed] = useState(false);

  const handleZoomIn  = useCallback(() => setZoom(z => Math.min(z + 20, 200)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z - 20, 40)), []);
  const handleFit     = useCallback(() => setZoom(100), []);

  // Cancel tool/arrow mode on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTool(null);
        setArrowMode(false);
        setArrowSource(null);
        setShowArrowPicker(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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

    const cleanups: Array<() => void> = [];

    // Drag-to-reposition handlers
    if (onEntityMove) {
      cleanups.push(attachDragHandlers(el, onEntityMove, arrowMode));
    }

    // Arrow-drawing: click entities to connect
    if (arrowMode && onAddRelation) {
      cleanups.push(attachArrowHandlers(el, arrowSource, arrowKind, setArrowSource, onAddRelation));
    }

    // Double-click on relation labels to edit
    if (onEditRelationLabel) {
      cleanups.push(attachLabelEditHandlers(el, onEditRelationLabel));
    }

    return () => { for (const fn of cleanups) fn(); };
  }, [diagram, onEntityMove, arrowMode, arrowKind, arrowSource, onAddRelation, onEditRelationLabel]);

  // Handle canvas click to place new entity from toolbox
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeTool || !onAddEntity) return;
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const scale = zoom / 100;
    const x = Math.round((e.clientX - rect.left) / scale);
    const y = Math.round((e.clientY - rect.top) / scale);

    // Generate a unique name
    const base = activeTool === 'abstract' ? 'AbstractClass' : activeTool.charAt(0).toUpperCase() + activeTool.slice(1);
    const existing = diagram ? [...diagram.entities.keys()] : [];
    let name = base;
    let counter = 1;
    while (existing.includes(name)) {
      counter++;
      name = `${base}${counter}`;
    }

    onAddEntity(activeTool, name, x, y);
    setActiveTool(null);
  }, [activeTool, onAddEntity, zoom, diagram]);

  // Determine which tools to show based on diagram kind
  const filteredTools = ENTITY_TOOLS.filter(t => {
    const kind = diagramKind ?? diagram?.kind ?? 'class';
    if (kind === 'class') return ['class', 'abstract', 'interface', 'enum'].includes(t.kind);
    if (kind === 'usecase') return ['actor', 'usecase'].includes(t.kind);
    if (kind === 'component') return ['component'].includes(t.kind);
    if (kind === 'deployment') return ['component', 'node'].includes(t.kind);
    return true;
  });

  const canvasStyle: React.CSSProperties = activeTool
    ? { cursor: 'crosshair' }
    : arrowMode
      ? { cursor: arrowSource ? 'crosshair' : 'pointer' }
      : {};

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

      {/* ── Toolbox ──────────────────────────────────────── */}
      {diagram && (
        <div className={`iso-toolbox ${toolboxCollapsed ? 'iso-toolbox--collapsed' : ''}`}>
          <button
            type="button"
            className="iso-toolbox-toggle"
            onClick={() => setToolboxCollapsed(c => !c)}
            aria-label={toolboxCollapsed ? 'Expand toolbox' : 'Collapse toolbox'}
            title={toolboxCollapsed ? 'Expand toolbox' : 'Collapse toolbox'}
          >
            {toolboxCollapsed ? '▶' : '◀'}
          </button>

          {!toolboxCollapsed && (
            <>
              <div className="iso-toolbox-section-title">Entities</div>
              {filteredTools.map(t => (
                <button
                  key={t.kind}
                  type="button"
                  className={`iso-toolbox-btn ${activeTool === t.kind ? 'iso-toolbox-btn--active' : ''}`}
                  onClick={() => {
                    setArrowMode(false);
                    setArrowSource(null);
                    setActiveTool(activeTool === t.kind ? null : t.kind);
                  }}
                  title={`Add ${t.label} — click on canvas to place`}
                >
                  <span className="iso-toolbox-icon">{t.icon}</span>
                  <span className="iso-toolbox-label">{t.label}</span>
                </button>
              ))}

              <div className="iso-toolbox-sep" />
              <div className="iso-toolbox-section-title">Relations</div>

              {/* Arrow tool */}
              <button
                type="button"
                className={`iso-toolbox-btn ${arrowMode ? 'iso-toolbox-btn--active' : ''}`}
                onClick={() => {
                  setActiveTool(null);
                  setArrowSource(null);
                  setArrowMode(!arrowMode);
                }}
                title={`Draw ${arrowKind.label} — click source entity then target entity`}
              >
                <span className="iso-toolbox-icon">↗</span>
                <span className="iso-toolbox-label">{arrowKind.label}</span>
              </button>

              {/* Arrow type picker toggle */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="iso-toolbox-btn iso-toolbox-btn--small"
                  onClick={() => setShowArrowPicker(!showArrowPicker)}
                  title="Change arrow type"
                >
                  <span className="iso-toolbox-icon" style={{ fontSize: 9 }}>▼</span>
                  <span className="iso-toolbox-label" style={{ fontSize: 10 }}>Type: {arrowKind.op}</span>
                </button>
                {showArrowPicker && (
                  <div className="iso-arrow-picker">
                    {ARROW_KINDS.map(ak => (
                      <button
                        key={ak.op}
                        type="button"
                        className={`iso-arrow-picker-item ${ak.op === arrowKind.op ? 'iso-arrow-picker-item--active' : ''}`}
                        onClick={() => {
                          setArrowKind(ak);
                          setShowArrowPicker(false);
                        }}
                      >
                        <code>{ak.op}</code>
                        <span>{ak.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status hints */}
              {activeTool && (
                <div className="iso-toolbox-hint">
                  Click on canvas to place {activeTool}
                  <br />
                  <small>Press Esc to cancel</small>
                </div>
              )}
              {arrowMode && !arrowSource && (
                <div className="iso-toolbox-hint">
                  Click source entity
                  <br />
                  <small>Press Esc to cancel</small>
                </div>
              )}
              {arrowMode && arrowSource && (
                <div className="iso-toolbox-hint iso-toolbox-hint--active">
                  From: <strong>{arrowSource}</strong>
                  <br />
                  Click target entity
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* SVG canvas with zoom */}
      <div
        className="iso-canvas-wrap"
        role="img"
        aria-label={diagram ? `${diagram.name} ${diagram.kind} diagram` : 'Diagram canvas'}
        style={{ display: diagram ? undefined : 'none', ...canvasStyle }}
        onClick={activeTool ? handleCanvasClick : undefined}
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

// ─── Drag-to-update ──────────────────────────────────────────

function attachDragHandlers(
  container: HTMLDivElement,
  onEntityMove: (name: string, x: number, y: number) => void,
  arrowMode: boolean,
): () => void {
  if (arrowMode) return () => {};

  const svg = container.querySelector('svg');
  if (!svg) return () => {};

  const controllers: AbortController[] = [];
  const groups = svg.querySelectorAll<SVGGElement>('g[data-entity-name]');

  groups.forEach(g => {
    const entityName = g.getAttribute('data-entity-name');
    if (!entityName) return;

    let dragging = false;
    let startX = 0, startY = 0, origX = 0, origY = 0;

    g.style.cursor = 'grab';

    const ac = new AbortController();
    controllers.push(ac);
    const { signal } = ac;

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
      e.stopPropagation();
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

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      g.style.cursor = 'grab';
      const tf = g.getAttribute('transform') ?? '';
      const m = tf.match(/translate\(([^,]+),([^)]+)\)/);
      if (m) {
        onEntityMove(entityName, Math.round(parseFloat(m[1])), Math.round(parseFloat(m[2])));
      }
    };

    g.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove, { signal });
    window.addEventListener('mouseup', onMouseUp, { signal });
  });

  return () => { for (const c of controllers) c.abort(); };
}

// ─── Arrow drawing ───────────────────────────────────────────

function attachArrowHandlers(
  container: HTMLDivElement,
  arrowSource: string | null,
  arrowKind: ArrowKind,
  setArrowSource: (name: string | null) => void,
  onAddRelation: (from: string, to: string, op: string, label: string) => void,
): () => void {
  const svg = container.querySelector('svg');
  if (!svg) return () => {};

  const ac = new AbortController();
  const { signal } = ac;

  const groups = svg.querySelectorAll<SVGGElement>('g[data-entity-name]');
  groups.forEach(g => {
    const name = g.getAttribute('data-entity-name');
    if (!name) return;

    g.style.cursor = 'pointer';

    // Highlight on hover during arrow mode
    g.addEventListener('mouseenter', () => {
      const rect = g.querySelector('rect');
      if (rect) rect.setAttribute('stroke-width', '3');
    }, { signal });
    g.addEventListener('mouseleave', () => {
      const rect = g.querySelector('rect');
      if (rect) rect.setAttribute('stroke-width', '1.5');
    }, { signal });

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!arrowSource) {
        // First click: set source
        setArrowSource(name);
      } else if (arrowSource !== name) {
        // Second click: complete the relation
        onAddRelation(arrowSource, name, arrowKind.op, '');
        setArrowSource(null);
      }
    }, { signal });
  });

  return () => ac.abort();
}

// ─── Label editing ───────────────────────────────────────────

function attachLabelEditHandlers(
  container: HTMLDivElement,
  onEditRelationLabel: (from: string, to: string, oldLabel: string, newLabel: string) => void,
): () => void {
  const svg = container.querySelector('svg');
  if (!svg) return () => {};

  const ac = new AbortController();
  const { signal } = ac;

  // Find all relation label text elements (they are italic text inside <g> groups
  // that don't have data-entity-name — the relation groups)
  const groups = svg.querySelectorAll<SVGGElement>('g[data-relation-id]');
  groups.forEach(g => {
    const from = g.getAttribute('data-rel-from') ?? '';
    const to = g.getAttribute('data-rel-to') ?? '';

    const labelText = g.querySelector<SVGTextElement>('text[data-rel-label]');
    if (!labelText) return;

    labelText.style.cursor = 'pointer';

    labelText.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const currentLabel = labelText.textContent ?? '';
      const svgRect = svg.getBoundingClientRect();

      // Create an inline text input overlaid on the SVG
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentLabel;
      input.style.cssText = `
        position: absolute;
        left: ${e.clientX - svgRect.left - 40}px;
        top: ${e.clientY - svgRect.top - 12}px;
        width: 120px;
        height: 24px;
        font-size: 11px;
        font-family: sans-serif;
        border: 2px solid #6366f1;
        border-radius: 4px;
        padding: 2px 6px;
        background: white;
        color: #333;
        outline: none;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      `;

      const parent = svg.parentElement;
      if (!parent) return;
      parent.style.position = 'relative';
      parent.appendChild(input);
      input.focus();
      input.select();

      const commit = () => {
        const newLabel = input.value.trim();
        if (parent.contains(input)) parent.removeChild(input);
        onEditRelationLabel(from, to, currentLabel, newLabel);
      };

      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') commit();
        if (ke.key === 'Escape') {
          if (parent.contains(input)) parent.removeChild(input);
        }
      });
      input.addEventListener('blur', commit);
    }, { signal });
  });

  return () => ac.abort();
}

