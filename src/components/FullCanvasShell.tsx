import { DiagramView } from './DiagramView.js';
import type { CanvasTool } from './DiagramView.js';
import { IconDiagram } from './Icons.js';
import type { IOMDiagram, IOMEntity } from '../semantics/iom.js';
import type { Language } from '../i18n.js';

export type FullCanvasMode = 'move' | 'hand' | 'add-edge';

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
  if (mode === 'add-edge') return ['add-edge', 'edit-node', 'edit-edge'];
  if (mode === 'hand') return ['hand', 'edit-node', 'edit-edge'];
  return ['move', 'hand', 'edit-node', 'edit-edge', 'add-edge'];
}

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

  return (
    <section className="iso-panel iso-panel--canvas" style={{ height: '100%', width: '100%' }} aria-label="Full canvas">
      <div className="iso-panel-header">
        <IconDiagram size={11} />
        Pure Infinite Canvas
        <span className="iso-panel-info">ISX source of truth</span>
        <span className="iso-panel-spacer" />
        <button type="button" className="iso-btn" onClick={onFitCanvas} disabled={!hasDiagram || !onFitCanvas}>
          {fitLabel}
        </button>
        <span className="iso-kind-badge" style={{ height: 28 }}>{zoomLabel}</span>
        <select
          className="iso-select"
          value={mode}
          onChange={event => onModeChange(event.target.value as FullCanvasMode)}
          disabled={!hasDiagram}
          aria-label="Canvas mode"
          style={{ width: 112 }}
        >
          <option value="move">Move</option>
          <option value="hand">Pan</option>
          <option value="add-edge">Edge</option>
        </select>
        <button type="button" className="iso-btn" onClick={onSave} disabled={!hasDiagram || !canSave}>Save</button>
        <button type="button" className="iso-btn" onClick={onExportSVG} disabled={!hasDiagram || !canExport}>SVG</button>
        <button type="button" className="iso-btn" onClick={onExportPNG} disabled={!hasDiagram || !canExport}>PNG</button>
        <button type="button" className="iso-btn" onClick={onBack}>Back to IDE</button>
      </div>
      <div className="iso-panel-body">
        <DiagramView
          diagram={diagram}
          language={language}
          availableTools={toolsForMode(mode)}
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
    </section>
  );
}
