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
  onRender?: (stats: { latencyMs: number; svgLength: number }) => void;

  // Diagram tabs props:
  diagrams?: IOMDiagram[];
  activeDiagramIdx?: number;
  onSelectDiagram?: (idx: number) => void;
  t?: (key: string, vars?: Record<string, string | number>) => string;
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
  onRender,
  diagrams = [],
  activeDiagramIdx = 0,
  onSelectDiagram,
  t = (k) => k,
}: CanvasPanelProps) {
  return (
    <section className="iso-panel iso-panel--canvas iso-workspace-pane">
      <div className="iso-panel-header" style={{ paddingLeft: diagrams.length > 1 ? 0 : undefined, display: 'flex', alignItems: 'center', height: 34 }}>
        {diagrams.length > 1 ? (
          <nav className="iso-tabs" aria-label={t('ui.diagrams')} style={{ flex: '1 1 auto', minWidth: 0, overflowX: 'auto', display: 'flex', height: '100%', alignItems: 'center' }}>
            {diagrams.map((d, i) => (
              <button
                key={d.name}
                className={`iso-tab${i === activeDiagramIdx ? ' iso-tab--active' : ''}`}
                type="button"
                onClick={() => onSelectDiagram?.(i)}
                aria-pressed={i === activeDiagramIdx}
                aria-label={t('tabs.switch', { name: d.name, kind: d.kind })}
                style={{
                  height: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderRight: '1px solid var(--iso-divider)',
                  borderRadius: 0,
                  paddingLeft: 12,
                  paddingRight: 10,
                  background: 'transparent',
                  borderTop: 'none',
                  borderBottom: 'none',
                }}
              >
                {d.name}
                <span className="iso-tab-kind" style={{ marginLeft: 6 }}>{d.kind}</span>
              </button>
            ))}
          </nav>
        ) : (
          <>
            <IconDiagram size={11} />
            {title}
          </>
        )}
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
          onRender={onRender}
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
