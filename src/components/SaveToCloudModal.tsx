import React, { useState, useEffect } from 'react';
import type { Project } from '../lib/projects.js';

export interface SaveToCloudModalProps {
  saveToCloudModalOpen: boolean;
  setSaveToCloudModalOpen: (open: boolean) => void;
  projects: Project[];
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  isSavingToCloud: boolean;
  handleSaveToCloudSubmit: (customFileName?: string) => void;
  t: (key: string, options?: any) => string;
  setNewModalTab: (tab: 'tab' | 'project') => void;
  setIsNewModalOpen: (open: boolean) => void;
  setIsSavingFlow: (saving: boolean) => void;
  currentFileName?: string;
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
  currentFileName,
}) => {
  const [fileName, setFileName] = useState(currentFileName || 'untitled.isx');

  useEffect(() => {
    if (currentFileName) {
      setFileName(currentFileName);
    }
  }, [currentFileName, saveToCloudModalOpen]);

  if (!saveToCloudModalOpen) return null;

  const handleSubmit = () => {
    handleSaveToCloudSubmit(fileName.trim());
  };

  return (
    <div className="iso-modal-overlay" onClick={() => setSaveToCloudModalOpen(false)}>
      <div className="iso-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="iso-modal-title">{t('ui.save_to_cloud')}</h2>
        <p className="iso-modal-desc">Select a project and verify the file name.</p>
        
        <div className="iso-modal-field" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--iso-text)' }}>
            File name
          </label>
          <input
            type="text"
            className="iso-modal-select"
            style={{ marginBottom: 0 }}
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="e.g. untitled.isx"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
              }
            }}
          />
        </div>

        <div className="iso-modal-field">
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--iso-text)' }}>
            Project
          </label>
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
                  handleSubmit();
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
        <div className="iso-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button type="button" className="iso-modal-btn cancel" onClick={() => setSaveToCloudModalOpen(false)}>
            {t('ui.cancel')}
          </button>
          <button
            type="button"
            className="iso-modal-btn confirm"
            disabled={!selectedProjectId || !fileName.trim() || isSavingToCloud}
            onClick={handleSubmit}
          >
            {isSavingToCloud ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
