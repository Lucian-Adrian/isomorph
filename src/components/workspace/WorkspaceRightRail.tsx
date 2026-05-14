import { IconDiagram } from '../Icons.js';
import type { IOMDiagram } from '../../semantics/iom.js';
import { tText, type Language } from '../../i18n.js';
import { getStencilsForKind } from './stencils.js';
import type { DiagramSelection } from './types.js';

export type WorkspaceRightRailMode = 'stencils' | 'properties' | 'problems';

interface WorkspaceRightRailProps {
  diagram: IOMDiagram | null;
  language: Language;
  mode: WorkspaceRightRailMode;
  selectedItem: DiagramSelection | null;
  errors: string[];
  errorsCopied: boolean;
  onRequestProblems: () => void;
  onBackToAuto: () => void;
  onCopyErrors: () => void;
  onEditSelection: () => void;
  onClearSelection: () => void;
  onInsertStencil: (keyword: string) => void;
}

function selectedSummary(diagram: IOMDiagram | null, selectedItem: DiagramSelection | null) {
  if (!diagram || !selectedItem || selectedItem.type !== 'entity') return null;

  const entity = diagram.entities.get(selectedItem.id);
  if (entity) {
    return { kind: entity.kind, name: entity.name, position: entity.position };
  }

  const pkg = diagram.packages.find(item => item.name === selectedItem.id);
  if (pkg) {
    return { kind: 'package', name: pkg.name ?? selectedItem.id, position: pkg.position };
  }

  const fragment = diagram.fragments?.find(item => item.id === selectedItem.id);
  if (fragment) {
    return { kind: fragment.kind, name: fragment.id, position: fragment.position };
  }

  return null;
}

export function WorkspaceRightRail({
  diagram,
  language,
  mode,
  selectedItem,
  errors,
  errorsCopied,
  onRequestProblems,
  onBackToAuto,
  onCopyErrors,
  onEditSelection,
  onClearSelection,
  onInsertStencil,
}: WorkspaceRightRailProps) {
  const t = (key: string, vars?: Record<string, string | number>) => tText(language, key, vars);
  const summary = selectedSummary(diagram, selectedItem);
  const relation = selectedItem?.type === 'relation'
    ? diagram?.relations.find(item => item.id === selectedItem.id) ?? null
    : null;
  const stencils = getStencilsForKind(diagram?.kind);
  const title = mode === 'problems' ? 'Problems' : mode === 'properties' ? 'Properties' : t('ui.shapes');

  return (
    <aside className="iso-sidebar iso-rail-pane" aria-label={title}>
      <div className="iso-panel-header iso-rail-header">
        <IconDiagram size={11} />
        {title}
        <span className="iso-panel-spacer" />
        {mode !== 'problems' && errors.length > 0 && (
          <button type="button" className="iso-btn iso-btn--compact" onClick={onRequestProblems}>
            Validate
          </button>
        )}
        {mode === 'problems' && (
          <button type="button" className="iso-btn iso-btn--compact" onClick={onBackToAuto}>
            Back
          </button>
        )}
      </div>
      <div className="iso-sidebar-body">
        {mode === 'problems' ? (
          <RailProblems
            errors={errors}
            errorsCopied={errorsCopied}
            onCopyErrors={onCopyErrors}
            copyLabel={t('ui.copy_errors')}
            copiedLabel={t('ui.copied')}
            moreLabel={count => t('status.more_error_many', { count })}
          />
        ) : mode === 'properties' && selectedItem ? (
          <RailProperties
            selectedItem={selectedItem}
            summary={summary}
            relation={relation}
            onEditSelection={onEditSelection}
            onClearSelection={onClearSelection}
          />
        ) : (
          <RailStencils stencils={stencils} onInsertStencil={onInsertStencil} />
        )}
      </div>
    </aside>
  );
}

function RailProblems({
  errors,
  errorsCopied,
  onCopyErrors,
  copyLabel,
  copiedLabel,
  moreLabel,
}: {
  errors: string[];
  errorsCopied: boolean;
  onCopyErrors: () => void;
  copyLabel: string;
  copiedLabel: string;
  moreLabel: (count: number) => string;
}) {
  if (errors.length === 0) {
    return <div className="iso-panel-info iso-panel-info--flush">No validation issues found.</div>;
  }

  return (
    <>
      <div className="iso-panel-info iso-panel-info--flush">
        {errors.length} issue{errors.length === 1 ? '' : 's'} detected.
      </div>
      <button type="button" className="iso-btn" onClick={onCopyErrors}>
        {errorsCopied ? copiedLabel : copyLabel}
      </button>
      <div className="iso-rail-list">
        {errors.slice(0, 8).map((msg, index) => (
          <div key={`${index}-${msg.slice(0, 18)}`} className="iso-stencil iso-stencil--static">
            {msg}
          </div>
        ))}
        {errors.length > 8 && (
          <div className="iso-panel-info iso-panel-info--flush">
            {moreLabel(errors.length - 8)}
          </div>
        )}
      </div>
    </>
  );
}

function RailProperties({
  selectedItem,
  summary,
  relation,
  onEditSelection,
  onClearSelection,
}: {
  selectedItem: DiagramSelection;
  summary: ReturnType<typeof selectedSummary>;
  relation: IOMDiagram['relations'][number] | null;
  onEditSelection: () => void;
  onClearSelection: () => void;
}) {
  if (summary) {
    return (
      <>
        <RailLabel label="Type" value={summary.kind} />
        <RailLabel label="Name" value={summary.name ?? selectedItem.id} truncate />
        {summary.position && (
          <RailLabel label="Position" value={`${Math.round(summary.position.x)}, ${Math.round(summary.position.y)}`} mono />
        )}
        <div className="iso-panel-info iso-panel-info--flush">
          Use the editor for rich property changes.
        </div>
        <button type="button" className="iso-btn iso-btn--primary" onClick={onEditSelection}>
          Edit
        </button>
        <button type="button" className="iso-btn" onClick={onClearSelection}>
          Clear selection
        </button>
      </>
    );
  }

  if (relation) {
    return (
      <>
        <RailLabel label="Relation" value={relation.label || relation.id} />
        <RailLabel label="Kind" value={relation.kind} />
        <div className="iso-panel-info iso-panel-info--flush">
          {relation.from} {'->'} {relation.to}
        </div>
        <button type="button" className="iso-btn iso-btn--primary" onClick={onEditSelection}>
          Edit
        </button>
        <button type="button" className="iso-btn" onClick={onClearSelection}>
          Clear selection
        </button>
      </>
    );
  }

  return <div className="iso-panel-info iso-panel-info--flush">Nothing selected.</div>;
}

function RailLabel({ label, value, truncate = false, mono = false }: { label: string; value: string; truncate?: boolean; mono?: boolean }) {
  return (
    <>
      <div className="iso-panel-info iso-panel-info--flush">{label}</div>
      <div className={`iso-rail-value${truncate ? ' iso-rail-value--truncate' : ''}${mono ? ' iso-rail-value--mono' : ''}`}>
        {value}
      </div>
    </>
  );
}

function RailStencils({ stencils, onInsertStencil }: { stencils: ReturnType<typeof getStencilsForKind>; onInsertStencil: (keyword: string) => void }) {
  if (stencils.length === 0) {
    return <div className="iso-panel-info iso-panel-info--flush">No stencil palette for this diagram type.</div>;
  }

  return (
    <>
      {stencils.map(stencil => (
        <button
          key={stencil.label}
          type="button"
          draggable
          onDragStart={event => {
            event.dataTransfer.setData('text/plain', stencil.keyword);
            event.dataTransfer.effectAllowed = 'copy';
          }}
          onClick={() => onInsertStencil(stencil.keyword)}
          className="iso-stencil"
        >
          {stencil.label}
        </button>
      ))}
    </>
  );
}
