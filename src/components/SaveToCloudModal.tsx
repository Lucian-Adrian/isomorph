import React, { useState, useEffect } from 'react';
import type { Project, Diagram } from '../lib/projects.js';
import { getDiagrams } from '../lib/projects.js';
import { sound } from '../lib/sound.js';

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
  const [projectDiagrams, setProjectDiagrams] = useState<Diagram[]>([]);
  const [isLoadingDiagrams, setIsLoadingDiagrams] = useState(false);

  useEffect(() => {
    if (currentFileName) {
      setFileName(currentFileName);
    }
  }, [currentFileName, saveToCloudModalOpen]);

  useEffect(() => {
    if (!saveToCloudModalOpen || !selectedProjectId) {
      setProjectDiagrams([]);
      return;
    }
    let isMounted = true;
    setIsLoadingDiagrams(true);
    getDiagrams(selectedProjectId)
      .then((diagrams) => {
        if (isMounted) {
          setProjectDiagrams(diagrams || []);
        }
      })
      .catch(() => {
        if (isMounted) setProjectDiagrams([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingDiagrams(false);
      });

    return () => {
      isMounted = false;
    };
  }, [saveToCloudModalOpen, selectedProjectId]);

  if (!saveToCloudModalOpen) return null;

  const cleanName = fileName.trim();
  const normalizedCandidate = cleanName.toLowerCase();
  const isDuplicate = Boolean(
    cleanName &&
      projectDiagrams.some(
        (d) => d.name.trim().toLowerCase() === normalizedCandidate
      )
  );

  const handleSubmit = () => {
    if (!cleanName || !selectedProjectId || isDuplicate || isSavingToCloud) {
      sound.warn();
      return;
    }
    sound.button();
    handleSaveToCloudSubmit(cleanName);
  };

  const handleClose = () => {
    sound.modalClose();
    setSaveToCloudModalOpen(false);
  };

  return (
    <div className="iso-modal-overlay" onClick={handleClose}>
      <div className="iso-modal" onClick={(e) => e.stopPropagation()} style={{ width: '420px', maxWidth: '92vw' }}>
        <h2 className="iso-modal-title">{t('ui.save_to_cloud')}</h2>
        <p className="iso-modal-desc">Select a project and verify the file name.</p>

        <div className="iso-modal-field" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--iso-text)' }}>
            File name
          </label>
          <input
            type="text"
            className="iso-modal-select"
            style={{
              marginBottom: 0,
              borderColor: isDuplicate ? 'var(--iso-danger)' : undefined,
            }}
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
          {isDuplicate && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--iso-danger)',
                fontSize: '12px',
                marginTop: '8px',
                lineHeight: 1.4,
              }}
            >
              <span style={{ fontSize: '14px' }}>⚠️</span>
              <span>A file named &quot;{cleanName}&quot; already exists in this project. Please choose a different name.</span>
            </div>
          )}
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
                sound.button();
                setNewModalTab('project');
                setIsNewModalOpen(true);
                setSaveToCloudModalOpen(false);
                setIsSavingFlow(true);
              }}
            >
              New project
            </button>
          </div>
          {isLoadingDiagrams && (
            <span style={{ fontSize: '11px', color: 'var(--iso-text-muted)', marginTop: '4px' }}>
              Checking project files...
            </span>
          )}
        </div>

        <div className="iso-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button type="button" className="iso-modal-btn cancel" onClick={handleClose}>
            {t('ui.cancel')}
          </button>
          <button
            type="button"
            className="iso-modal-btn confirm"
            disabled={!selectedProjectId || !cleanName || isDuplicate || isSavingToCloud}
            onClick={handleSubmit}
          >
            {isSavingToCloud ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
