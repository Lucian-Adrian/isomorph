import { DiagramView, type CanvasTool } from '../DiagramView.js';
import { IconDiagram } from '../Icons.js';
import type { Language } from '../../i18n.js';
import type { IOMDiagram, IOMEntity } from '../../semantics/iom.js';
import type { DiagramSelection } from './types.js';

interface CanvasPanelProps {
  title: string;
  diagram: IOMDiagram | null;
  language: Language;
  summaryText: string;
  hintText?: string;
  availableTools: CanvasTool[];
  selectedItems: DiagramSelection[];
  pendingDropKeyword: string | null;
  onSelectionChange: (selection: DiagramSelection[]) => void;
  onEntityMove?: (entityName: string, x: number, y: number, dx?: number, dy?: number, seedPositions?: Record<string, { x: number; y: number; w?: number; h?: number }>) => void;
  onEntityResize?: (entityName: string, w: number, h: number, x?: number, y?: number) => void;
  onRelationVerticalMove?: (relationId: string, y: number, seedRelationYs?: Record<string, number>) => void;
  onEntityEditRequest?: (entity: IOMEntity) => void;
  onRelationEditRequest?: (relationId: string, currentLabel: string, currentKind: string) => void;
  onRelationAddRequest?: (fromEntity: string, toEntity: string, y?: number) => void;
  onTextRenameRequest?: (oldText: string, newText: string, type: 'diagram' | 'package') => void;
  onExportSVG?: () => void;
  onDropEntity?: (keyword: string, x: number, y: number, targetPackage?: string) => void;
  onConsumePendingDrop?: () => void;
}

export function CanvasPanel({
  title,
  diagram,
  language,
  summaryText,
  hintText,
  availableTools,
  selectedItems,
  pendingDropKeyword,
  onSelectionChange,
  onEntityMove,
  onEntityResize,
  onRelationVerticalMove,
  onEntityEditRequest,
  onRelationEditRequest,
  onRelationAddRequest,
  onTextRenameRequest,
  onExportSVG,
  onDropEntity,
  onConsumePendingDrop,
}: CanvasPanelProps) {
  return (
    <section className="iso-panel iso-panel--canvas iso-workspace-pane">
      <div className="iso-panel-header">
        <IconDiagram size={11} />
        {title}
        <span className="iso-panel-info" aria-live="polite">
          {summaryText}
        </span>
        <span className="iso-panel-spacer" />
        {hintText && <span className="iso-pane-metric">{hintText}</span>}
      </div>
      <div className="iso-panel-body">
        <DiagramView
          diagram={diagram}
          language={language}
          onEntityMove={onEntityMove}
          onEntityResize={onEntityResize}
          onRelationVerticalMove={onRelationVerticalMove}
          onEntityEditRequest={onEntityEditRequest}
          onRelationEditRequest={onRelationEditRequest}
          onRelationAddRequest={onRelationAddRequest}
          onTextRenameRequest={onTextRenameRequest}
          onExportSVG={onExportSVG}
          onDropEntity={onDropEntity}
          pendingDropKeyword={pendingDropKeyword}
          onConsumePendingDrop={onConsumePendingDrop}
          availableTools={availableTools}
          selectedItems={selectedItems}
          onSelectionChange={onSelectionChange}
        />
      </div>
    </section>
  );
}
