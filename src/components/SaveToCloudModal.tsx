import React from 'react';
import type { Project } from '../lib/projects.js';

export interface SaveToCloudModalProps {
  saveToCloudModalOpen: boolean;
  setSaveToCloudModalOpen: (open: boolean) => void;
  projects: Project[];
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  isSavingToCloud: boolean;
  handleSaveToCloudSubmit: () => void;
  t: (key: string, options?: any) => string;
  setNewModalTab: (tab: 'tab' | 'project') => void;
  setIsNewModalOpen: (open: boolean) => void;
  setIsSavingFlow: (saving: boolean) => void;
}

export const SaveToCloudModal: React.FC<SaveToCloudModalProps> = ({
  saveToCloudModalOpen,
  setSaveToCloudModalOpen,
  projects,
  selectedProjectId,
  setSelectedProjectId,
  isSavingToCloud,
  handleSaveToCloudSubmit,
  t,
  setNewModalTab,
  setIsNewModalOpen,
  setIsSavingFlow,
}) => {
  if (!saveToCloudModalOpen) return null;

  return (
    <div className="iso-modal-overlay" onClick={() => setSaveToCloudModalOpen(false)}>
      <div className="iso-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="iso-modal-title">{t('ui.save_to_cloud')}</h2>
        <p className="iso-modal-desc">Select a project to save this diagram into.</p>
        <div className="iso-modal-field">
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <select
              className="iso-select"
              style={{ flex: 1 }}
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSaveToCloudSubmit();
                }
              }}
            >
              <option value="">-- Select project --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="iso-btn"
              onClick={() => {
                setNewModalTab('project');
                setIsNewModalOpen(true);
                setSaveToCloudModalOpen(false);
                setIsSavingFlow(true);
              }}
            >
              New project
            </button>
          </div>
        </div>
        <div className="iso-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="iso-modal-btn cancel" onClick={() => setSaveToCloudModalOpen(false)}>
            {t('ui.cancel')}
          </button>
          <button
            type="button"
            className="iso-modal-btn confirm"
            disabled={!selectedProjectId || isSavingToCloud}
            onClick={handleSaveToCloudSubmit}
          >
            {isSavingToCloud ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
