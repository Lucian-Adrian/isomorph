import React from 'react';
import type { DiagramKind, SequenceMessageType, WorkspaceTab } from '../types/index.js';
import { insertSequenceLifecycleAfterRelation } from '../utils/source-manipulation.js';

export interface EditRelationModalProps {
  editingRelation: {
    relationId: string;
    label: string;
    kind: string;
    direction: 'forward' | 'reverse';
    fromMult?: string;
    toMult?: string;
    seqMessageType?: SequenceMessageType;
  } | null;
  setEditingRelation: (relation: any) => void;
  activeDiagram: { kind: DiagramKind } | null;
  t: (key: string, options?: any) => string;
  isMobileLayout: boolean;
  handleRelationEdit: (
    relationId: string,
    updates: {
      label: string;
      kind: string;
      direction: 'forward' | 'reverse';
      fromMult?: string;
      toMult?: string;
      seqMessageType?: SequenceMessageType;
    },
  ) => void;
  updateActiveTab: (updater: (tab: WorkspaceTab) => WorkspaceTab, saveHistory?: boolean) => void;
  formatDiagramSource: (source: string) => string;
}

export const EditRelationModal: React.FC<EditRelationModalProps> = ({
  editingRelation,
  setEditingRelation,
  activeDiagram,
  t,
  isMobileLayout,
  handleRelationEdit,
  updateActiveTab,
  formatDiagramSource,
}) => {
  if (!editingRelation) return null;

  return (
    <div className="iso-modal-overlay" onClick={() => setEditingRelation(null)}>
      <div className="iso-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('edit.relation_title')}</h3>
        <div className="iso-modal-field">
          <label>{t('edit.role_label')}</label>
          <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
            <input
              type="text"
              style={{ flex: 1 }}
              value={editingRelation.label}
              onChange={(e) => setEditingRelation({ ...editingRelation, label: e.target.value })}
              autoFocus={!isMobileLayout}
            />
            {['state', 'activity'].includes(activeDiagram?.kind || '') && (
              <button
                type="button"
                className="iso-btn"
                onClick={() =>
                  setEditingRelation((r: any) =>
                    r ? { ...r, label: r.label.includes('[') ? r.label : `[${r.label || 'guard'}]` } : null,
                  )
                }
              >
                {t('edit.guard')}
              </button>
            )}
          </div>
        </div>
        {['class'].includes(activeDiagram?.kind || '') && (
          <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
            <div className="iso-modal-field" style={{ flex: 1, minWidth: 0 }}>
              <label>{t('edit.from_mult')}</label>
              <input
                type="text"
                value={editingRelation.fromMult || ''}
                onChange={(e) => setEditingRelation({ ...editingRelation, fromMult: e.target.value })}
              />
            </div>
            <div className="iso-modal-field" style={{ flex: 1, minWidth: 0 }}>
              <label>{t('edit.to_mult')}</label>
              <input
                type="text"
                value={editingRelation.toMult || ''}
                onChange={(e) => setEditingRelation({ ...editingRelation, toMult: e.target.value })}
              />
            </div>
          </div>
        )}
        {activeDiagram?.kind === 'sequence' ? (
          <div className="iso-modal-field">
            <label>{t('edit.seq_message_type')}</label>
            <select
              className="iso-select"
              value={editingRelation.seqMessageType || 'synchronous'}
              onChange={(e) =>
                setEditingRelation({ ...editingRelation, seqMessageType: e.target.value as SequenceMessageType })
              }
            >
              <option value="synchronous">{t('rel.seq_synchronous')}</option>
              <option value="asynchronous">{t('rel.seq_asynchronous')}</option>
              <option value="response">{t('rel.seq_response')}</option>
              <option value="self-call">{t('rel.seq_self_call')}</option>
            </select>
          </div>
        ) : (
          <div className="iso-modal-field">
            <label>{t('edit.kind')}</label>
            <select
              className="iso-select"
              value={editingRelation.kind}
              onChange={(e) => setEditingRelation({ ...editingRelation, kind: e.target.value })}
            >
              <option value="association">{t('rel.association')}</option>
              <option value="directed-association">{t('rel.directed_association')}</option>
              <option value="inheritance">{t('rel.inheritance')}</option>
              <option value="realization">{t('rel.realization')}</option>
              <option value="aggregation">{t('rel.aggregation')}</option>
              <option value="composition">{t('rel.composition')}</option>
              <option value="dependency">{t('rel.dependency')}</option>
              <option value="restriction">{t('rel.restriction')}</option>
              {['component', 'deployment'].includes(activeDiagram?.kind || '') && (
                <>
                  <option value="provides">{t('rel.provides')}</option>
                  <option value="requires">{t('rel.requires')}</option>
                </>
              )}
            </select>
          </div>
        )}
        <div className="iso-modal-field">
          <label>{t('edit.direction')}</label>
          <select
            className="iso-select"
            value={editingRelation.direction}
            onChange={(e) =>
              setEditingRelation({ ...editingRelation, direction: e.target.value as 'forward' | 'reverse' })
            }
          >
            <option value="forward">{t('edit.forward')}</option>
            <option value="reverse">{t('edit.reverse')}</option>
          </select>
        </div>
        {activeDiagram?.kind === 'sequence' && (
          <div className="iso-modal-field">
            <label>{t('edit.seq_lifecycle')}</label>
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <button
                type="button"
                className="iso-btn"
                onClick={() => {
                  updateActiveTab((tab) => ({
                    ...tab,
                    source: formatDiagramSource(
                      insertSequenceLifecycleAfterRelation(tab.source, editingRelation.relationId, 'create'),
                    ),
                  }));
                }}
              >
                {t('edit.seq_create_target')}
              </button>
              <button
                type="button"
                className="iso-btn"
                onClick={() => {
                  updateActiveTab((tab) => ({
                    ...tab,
                    source: formatDiagramSource(
                      insertSequenceLifecycleAfterRelation(tab.source, editingRelation.relationId, 'destroy'),
                    ),
                  }));
                }}
              >
                {t('edit.seq_destroy_target')}
              </button>
            </div>
          </div>
        )}
        <div className="iso-modal-actions">
          <button type="button" className="iso-btn" onClick={() => setEditingRelation(null)}>
            {t('ui.cancel')}
          </button>
          <button
            type="button"
            className="iso-btn iso-btn--primary"
            onClick={() =>
              handleRelationEdit(editingRelation.relationId, {
                label: editingRelation.label,
                kind: editingRelation.kind,
                direction: editingRelation.direction,
                fromMult: editingRelation.fromMult,
                toMult: editingRelation.toMult,
                seqMessageType: editingRelation.seqMessageType,
              })
            }
          >
            {t('menu.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
