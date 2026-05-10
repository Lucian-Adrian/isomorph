import { DiagramView } from './DiagramView.js';
import type { CanvasTool } from './DiagramView.js';
import { IconDiagram, IconEdge, IconHand, IconPointer } from './Icons.js';
import type { IOMDiagram, IOMEntity } from '../semantics/iom.js';
import type { Language } from '../i18n.js';

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
  | 'eraser';

export interface FullCanvasShellProps {
  diagram: IOMDiagram | null;
  language?: Language;
  mode: FullCanvasMode;
  zoomLabel?: string;
  fitLabel?: string;
  canSave?: boolean;
  canExport?: boolean;
  onModeChange: (mode: FullCanvasMode) => void;
  onFitCanvas?: () => void;
  onSave: () => void;
  onExportSVG: () => void;
  onExportPNG: () => void;
  onBack: () => void;
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

function ToolGlyph({ tool }: { tool: FullCanvasMode | 'more' }) {
  if (tool === 'move') return <IconPointer size={15} />;
  if (tool === 'hand') return <IconHand size={15} />;
  if (tool === 'add-edge' || tool === 'arrow' || tool === 'line') return <IconEdge size={15} />;
  if (tool === 'locked') return <span aria-hidden="true">L</span>;
  if (tool === 'rectangle') return <span aria-hidden="true">□</span>;
  if (tool === 'ellipse') return <span aria-hidden="true">○</span>;
  if (tool === 'pen') return <span aria-hidden="true">P</span>;
  if (tool === 'text') return <span aria-hidden="true">T</span>;
  if (tool === 'image') return <span aria-hidden="true">I</span>;
  if (tool === 'eraser') return <span aria-hidden="true">E</span>;
  return <span aria-hidden="true">⋯</span>;
}

const FLOATING_TOOLS: Array<{ mode: FullCanvasMode | 'more'; label: string; title: string }> = [
  { mode: 'locked', label: 'Lock tool', title: 'Lock' },
  { mode: 'move', label: 'Select', title: 'Select' },
  { mode: 'hand', label: 'Hand', title: 'Hand' },
  { mode: 'rectangle', label: 'Rectangle', title: 'Rectangle' },
  { mode: 'ellipse', label: 'Ellipse', title: 'Ellipse' },
  { mode: 'arrow', label: 'Arrow', title: 'Arrow' },
  { mode: 'line', label: 'Line', title: 'Line' },
  { mode: 'pen', label: 'Pen', title: 'Pen' },
  { mode: 'text', label: 'Text', title: 'Text' },
  { mode: 'image', label: 'Image', title: 'Image' },
  { mode: 'eraser', label: 'Eraser', title: 'Eraser' },
  { mode: 'more', label: 'More tools', title: 'More' },
];

export function FullCanvasShell({
  diagram,
  language,
  mode,
  zoomLabel = '100%',
  fitLabel = 'Fit',
  canSave = true,
  canExport = true,
  onModeChange,
  onFitCanvas,
  onSave,
  onExportSVG,
  onExportPNG,
  onBack,
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
}: FullCanvasShellProps) {
  const hasDiagram = Boolean(diagram);
  const semanticMode = modeToDiagramTool(mode);

  return (
    <section className="iso-full-canvas-shell" aria-label="Full canvas">
      <div className="iso-full-canvas-toolbar" role="toolbar" aria-label="Canvas tools">
        {FLOATING_TOOLS.map(tool => (
          <button
            key={tool.label}
            type="button"
            className={`iso-full-canvas-tool${tool.mode !== 'more' && mode === tool.mode ? ' iso-full-canvas-tool--active' : ''}`}
            aria-label={tool.label}
            title={tool.title}
            disabled={!hasDiagram && tool.mode !== 'more'}
            onClick={() => {
              if (tool.mode !== 'more') onModeChange(tool.mode);
            }}
          >
            <ToolGlyph tool={tool.mode} />
          </button>
        ))}
      </div>

      <div className="iso-full-canvas-pill" aria-label="Canvas document status">
        <IconDiagram size={12} />
        <strong>{diagram?.name ?? 'No diagram'}</strong>
        <span>{diagram?.kind ?? 'canvas'}</span>
        <span className="iso-status-dot">Valid</span>
      </div>

      <div className="iso-full-canvas-collab" aria-label="Collaboration">
        <span className="iso-avatar-stack" aria-hidden="true"><span>L</span><span>+</span></span>
        <button type="button" className="iso-full-canvas-action">Share</button>
        <button type="button" className="iso-full-canvas-action" onClick={onBack}>Back to IDE</button>
      </div>

      <div className="iso-full-canvas-actions" aria-label="Canvas actions">
        <button type="button" className="iso-full-canvas-action" onClick={onSave} disabled={!hasDiagram || !canSave}>Save</button>
        <button type="button" className="iso-full-canvas-action" onClick={onExportSVG} disabled={!hasDiagram || !canExport}>SVG</button>
        <button type="button" className="iso-full-canvas-action" onClick={onExportPNG} disabled={!hasDiagram || !canExport}>PNG</button>
      </div>

      <div className="iso-full-canvas-viewport">
        <DiagramView
          diagram={diagram}
          language={language}
          availableTools={toolsForMode(semanticMode)}
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
