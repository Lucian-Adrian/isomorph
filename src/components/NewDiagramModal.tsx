import React from 'react';
import type { DiagramKind } from '../types/index.js';
import { DIAGRAM_KINDS } from '../constants.js';

export interface NewDiagramModalProps {
  isNewModalOpen: boolean;
  setIsNewModalOpen: (open: boolean) => void;
  setIsSavingFlow: (saving: boolean) => void;
  newModalTab: 'tab' | 'project';
  setNewModalTab: (tab: 'tab' | 'project') => void;
  newDiagramKind: DiagramKind;
  setNewDiagramKind: (kind: DiagramKind) => void;
  executeNewDiagram: (kind: DiagramKind) => void;
  newProjectName: string;
  setNewProjectName: (name: string) => void;
  newProjectError: string;
  setNewProjectError: (error: string) => void;
  isCreatingProject: boolean;
  handleCreateProjectSubmit: () => void;
  user: any;
  t: (key: string, options?: any) => string;
}

export const NewDiagramModal: React.FC<NewDiagramModalProps> = ({
  isNewModalOpen,
  setIsNewModalOpen,
  setIsSavingFlow,
  newModalTab,
  setNewModalTab,
  newDiagramKind,
  setNewDiagramKind,
  executeNewDiagram,
  newProjectName,
  setNewProjectName,
  newProjectError,
  setNewProjectError,
  isCreatingProject,
  handleCreateProjectSubmit,
  user,
  t,
}) => {
  if (!isNewModalOpen) return null;

  return (
    <div
      className="iso-modal-overlay"
      onClick={() => {
        setIsNewModalOpen(false);
        setIsSavingFlow(false);
      }}
    >
      <div className="iso-modal" onClick={(e) => e.stopPropagation()} style={{ width: '400px' }}>
        <button
          className="iso-modal-close-btn"
          onClick={() => {
            setIsNewModalOpen(false);
            setIsSavingFlow(false);
          }}
        >
          ×
        </button>
        <h2 className="iso-modal-title" style={{ marginBottom: '16px' }}>{t('welcome.create_new_short') || 'Create new'}</h2>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            background: 'var(--iso-bg-header)',
            padding: '4px',
            borderRadius: '8px',
          }}
        >
          <button
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              background: newModalTab === 'tab' ? 'var(--iso-primary)' : 'transparent',
              color: newModalTab === 'tab' ? 'var(--white)' : 'var(--iso-text)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
            onClick={() => {
              setNewModalTab('tab');
              setNewProjectError('');
            }}
          >
            {t('ui.diagram')}
          </button>
          <button
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              background: newModalTab === 'project' ? 'var(--iso-primary)' : 'transparent',
              color: newModalTab === 'project' ? 'var(--white)' : 'var(--iso-text)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
            onClick={() => {
              setNewModalTab('project');
              setNewProjectError('');
            }}
          >
            {t('ui.project')}
          </button>
        </div>

        {newModalTab === 'tab' ? (
          <>
            <div className="iso-modal-field" style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--iso-text)' }}>
                {t('new_modal.diagram_type')}
              </label>
              <select
                className="iso-select"
                value={newDiagramKind}
                onChange={(e) => setNewDiagramKind(e.target.value as DiagramKind)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    executeNewDiagram(newDiagramKind);
                  }
                }}
              >
                {DIAGRAM_KINDS.filter((k) => k !== 'all').map((k) => (
                  <option
                    key={k}
                    value={k}
                  >{t(`diagram_type.${k}`) || `${k.charAt(0).toUpperCase() + k.slice(1)} diagram`}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                className="iso-btn"
                onClick={() => {
                  setIsNewModalOpen(false);
                  setIsSavingFlow(false);
                }}
              >
                {t('ui.cancel')}
              </button>
              <button className="iso-btn iso-btn--primary" onClick={() => executeNewDiagram(newDiagramKind)}>
                {t('ui.create')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="iso-modal-field" style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--iso-text)' }}>
                {t('ui.project_name')}
              </label>
              <input
                type="text"
                className="iso-input"
                value={newProjectName}
                onChange={(e) => {
                  setNewProjectName(e.target.value);
                  setNewProjectError('');
                }}
                onBlur={() => setNewProjectName(newProjectName.trim())}
                placeholder="Q3 System architecture..."
                autoFocus
                style={{ borderColor: newProjectError ? 'var(--iso-danger)' : undefined }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCreateProjectSubmit();
                  }
                }}
              />
              {newProjectError && (
                <div style={{ color: 'var(--iso-danger)', fontSize: '12px', marginTop: '6px' }}>{newProjectError}</div>
              )}
              {!user && (
                <div style={{ color: 'var(--iso-text)', fontSize: '12px', marginTop: '6px' }}>
                  {t('new_modal.must_be_logged_in')}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                className="iso-btn"
                onClick={() => {
                  setIsNewModalOpen(false);
                  setIsSavingFlow(false);
                }}
              >
                {t('ui.cancel')}
              </button>
              <button
                className="iso-btn iso-btn--primary"
                disabled={!user || !newProjectName.trim() || isCreatingProject}
                onClick={handleCreateProjectSubmit}
              >
                {isCreatingProject ? (t('new_modal.creating') || 'Creating...') : t('ui.create')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
