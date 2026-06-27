import React from 'react';
import type { Project } from '../lib/projects.js';
import type { WorkspaceTab } from '../types/index.js';

interface CommonModalsProps {
  diagramToDelete: any;
  setDiagramToDelete: (val: any) => void;
  handleConfirmDeleteDiagram: () => void;
  projectToDelete: string | null;
  setProjectToDelete: (val: string | null) => void;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addToast: (message: string, type?: 'success' | 'info') => void;
  isRevertModalOpen: boolean;
  setIsRevertModalOpen: (val: boolean) => void;
  confirmRevertHistory: () => void;
  tabToClose: string | null;
  setTabToClose: (val: string | null) => void;
  tabs: WorkspaceTab[];
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  t: (key: string, vars?: any) => string;
}

export function CommonModals({
  diagramToDelete,
  setDiagramToDelete,
  handleConfirmDeleteDiagram,
  projectToDelete,
  setProjectToDelete,
  setProjects,
  addToast,
  isRevertModalOpen,
  setIsRevertModalOpen,
  confirmRevertHistory,
  tabToClose,
  setTabToClose,
  tabs,
  setTabs,
  activeTabId,
  setActiveTabId,
  t,
}: CommonModalsProps) {
  return (
    <>
      {/* 1. Delete Diagram Confirmation Modal */}
      {diagramToDelete && (
        <div className="iso-modal-overlay" style={{ zIndex: 2200 }} onClick={() => setDiagramToDelete(null)}>
          <div className="iso-modal" onClick={(e) => e.stopPropagation()} style={{ width: '400px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', marginBottom: '16px' }}>Delete Diagram</h3>
            <p style={{ color: 'var(--iso-text-muted)', marginBottom: '24px' }}>
              Are you sure you want to delete "{diagramToDelete.name}"? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="iso-btn" onClick={() => setDiagramToDelete(null)}>
                {t('ui.cancel')}
              </button>
              <button
                className="iso-btn"
                style={{ background: 'var(--iso-danger)', color: '#fff', border: 'none' }}
                onClick={handleConfirmDeleteDiagram}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div className="iso-modal-overlay" onClick={() => setProjectToDelete(null)}>
          <div className="iso-modal" onClick={(e) => e.stopPropagation()} style={{ width: '400px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', marginBottom: '16px' }}>Delete Project</h3>
            <p style={{ color: 'var(--iso-text-muted)', marginBottom: '24px' }}>
              Are you sure you want to delete this project? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="iso-btn" onClick={() => setProjectToDelete(null)}>
                {t('ui.cancel')}
              </button>
              <button
                className="iso-btn"
                style={{ background: 'var(--iso-danger)', color: '#fff', border: 'none' }}
                onClick={() => {
                  import('../lib/supabase.js').then(({ supabase }) => {
                    supabase
                      .from('projects')
                      .delete()
                      .eq('id', projectToDelete)
                      .then(() => {
                        setProjects((prev) => prev.filter((p) => p.id !== projectToDelete));
                        setProjectToDelete(null);
                        addToast('Project deleted successfully');
                      });
                  });
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Revert to Snapshot History Modal */}
      {isRevertModalOpen && (
        <div className="iso-modal-overlay" onClick={() => setIsRevertModalOpen(false)}>
          <div className="iso-modal" onClick={(e) => e.stopPropagation()}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                confirmRevertHistory();
              }}
            >
              <h2 className="iso-modal-title">Revert to snapshot</h2>
              <p className="iso-modal-desc" style={{ color: 'var(--iso-text-muted)' }}>
                Are you sure you want to revert to this snapshot? This will permanently delete all newer saves.
              </p>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '24px',
                }}
              >
                <button type="button" className="iso-btn" onClick={() => setIsRevertModalOpen(false)}>
                  {t('ui.cancel')}
                </button>
                <button
                  type="submit"
                  className="iso-btn"
                  style={{
                    background: 'var(--iso-error)',
                    color: 'white',
                    borderColor: 'var(--iso-error)',
                  }}
                  autoFocus
                >
                  Revert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Confirm Close Tab Modal */}
      {tabToClose && (
        <div className="iso-modal-overlay" onClick={() => setTabToClose(null)}>
          <div className="iso-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="iso-modal-title">{t('dialog.close_title')}</h2>
            <p className="iso-modal-desc">
              {t('dialog.close_desc', {
                name: tabs.find((t) => t.id === tabToClose)?.name ?? '',
              })}
            </p>
            <div className="iso-modal-actions">
              <button className="iso-modal-btn cancel" onClick={() => setTabToClose(null)}>
                {t('ui.cancel')}
              </button>
              <button
                className="iso-modal-btn danger"
                onClick={() => {
                  setTabs((prev) => {
                    const next = prev.filter((t) => t.id !== tabToClose);
                    if (activeTabId === tabToClose) setActiveTabId(next[Math.max(0, next.length - 1)]?.id ?? '');
                    return next;
                  });
                  setTabToClose(null);
                }}
              >
                {t('ui.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
