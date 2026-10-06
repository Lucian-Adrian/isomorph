import React from 'react';
import type { Project } from '../lib/projects.js';
import type { WorkspaceTab } from '../types/index.js';

interface ContextMenuProps {
  contextMenu: {
    type: 'category' | 'project' | 'diagram';
    id: string;
    x: number;
    y: number;
    extra?: any;
  } | null;
  setContextMenu: React.Dispatch<React.SetStateAction<any>>;
  setRenameType: React.Dispatch<React.SetStateAction<'project' | 'category' | 'diagram' | null>>;
  setRenameTargetId: React.Dispatch<React.SetStateAction<string | null>>;
  setRenameValue: React.Dispatch<React.SetStateAction<string>>;
  setRenameModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  customCategories: string[];
  setCustomCategories: React.Dispatch<React.SetStateAction<string[]>>;
  saveCustomCategoriesToDB: (cats: string[]) => void;
  libraryCategory: string;
  setLibraryCategory: React.Dispatch<React.SetStateAction<string>>;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  projects: Project[];
  user: any;
  addToast: (message: string, type?: 'success' | 'info') => void;
  setProjectToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  setProjectDetailDiagrams: React.Dispatch<React.SetStateAction<any[]>>;
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  downloadDiagramFile: (diagram: any) => void;
  setDiagramToDelete: React.Dispatch<React.SetStateAction<any>>;
}

export function ContextMenu({
  contextMenu,
  setContextMenu,
  setRenameType,
  setRenameTargetId,
  setRenameValue,
  setRenameModalOpen,
  customCategories,
  setCustomCategories,
  saveCustomCategoriesToDB,
  libraryCategory,
  setLibraryCategory,
  setProjects,
  projects,
  user,
  addToast,
  setProjectToDelete,
  setProjectDetailDiagrams,
  setTabs,
  downloadDiagramFile,
  setDiagramToDelete,
}: ContextMenuProps) {
  if (!contextMenu) return null;

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
        onClick={() => setContextMenu(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu(null);
        }}
      />
      <div className="iso-context-menu" style={{ left: contextMenu.x, top: contextMenu.y, zIndex: 99999 }}>
        {contextMenu.type === 'category' && (
          <>
            <button
              className="iso-context-menu-item"
              onClick={() => {
                setRenameType('category');
                setRenameTargetId(contextMenu.id);
                setRenameValue(contextMenu.id);
                setRenameModalOpen(true);
                setContextMenu(null);
              }}
            >
              Rename
            </button>
            <div className="iso-context-menu-sep" />
            <button
              className="iso-context-menu-item iso-context-menu-item--danger"
              onClick={() => {
                const next = customCategories.filter((c) => c !== contextMenu.id);
                setCustomCategories(next);
                saveCustomCategoriesToDB(next);
                if (libraryCategory === contextMenu.id) setLibraryCategory('All Projects');

                setProjects((prev) =>
                  prev.map((p) => {
                    if (p.settings?.category === contextMenu.id) {
                      const newSettings = { ...p.settings, category: null };
                      if (user) {
                        import('../lib/projects.js').then(({ updateProject }) => {
                          updateProject(user.id, p.id, { settings: newSettings });
                        });
                      }
                      return { ...p, settings: newSettings };
                    }
                    return p;
                  }),
                );

                setContextMenu(null);
              }}
            >
              Delete category
            </button>
          </>
        )}
        {contextMenu.type === 'project' &&
          (() => {
            const project = projects.find((p) => p.id === contextMenu.id);
            const isFav = project?.settings?.is_favorite;
            const currentFolder = project?.settings?.category;

            return (
              <>
                <button
                  className="iso-context-menu-item"
                  onClick={() => {
                    setRenameType('project');
                    setRenameTargetId(contextMenu.id);
                    setRenameValue(project?.name || '');
                    setRenameModalOpen(true);
                    setContextMenu(null);
                  }}
                >
                  Rename
                </button>
                <button
                  className="iso-context-menu-item"
                  onClick={() => {
                    if (project) {
                      const currentSettings = project.settings || {};
                      const nextFav = !currentSettings.is_favorite;
                      const newSettings = { ...currentSettings, is_favorite: nextFav };
                      import('../lib/projects.js').then(({ updateProject }) => {
                        if (user) {
                          updateProject(user.id, contextMenu.id, {
                            settings: newSettings,
                          }).then((success) => {
                            if (success) {
                              setProjects((prev) =>
                                prev.map((p) => (p.id === contextMenu.id ? { ...p, settings: newSettings } : p)),
                              );
                              addToast(nextFav ? 'Added to favorites' : 'Removed from favorites');
                            }
                          });
                        }
                      });
                    }
                    setContextMenu(null);
                  }}
                >
                  {isFav ? 'Remove from favorites' : 'Add to favorites'}
                </button>
                <div style={{ position: 'relative' }} className="iso-menu-dropdown-wrapper">
                  <button
                    className="iso-context-menu-item"
                    style={{ justifyContent: 'space-between', display: 'flex' }}
                  >
                    Add to folder <span>▶</span>
                  </button>
                  <div
                    className="iso-menu-dropdown-submenu"
                    style={{
                      position: 'absolute',
                      left: '100%',
                      top: 0,
                      background: 'var(--white)',
                      border: '1px solid var(--iso-border-strong)',
                      borderRadius: 'var(--iso-radius-lg)',
                      padding: '4px',
                      display: 'none',
                      flexDirection: 'column',
                      minWidth: '120px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
                    }}
                  >
                    {customCategories
                      .filter((cat) => cat.toLowerCase() !== 'favorites' && cat.toLowerCase() !== 'favourites')
                      .map((cat) => {
                        const isCurrent = currentFolder === cat;
                        return (
                          <button
                            key={cat}
                            className="iso-context-menu-item"
                            style={{ fontWeight: isCurrent ? 'bold' : 'normal' }}
                            onClick={() => {
                              if (project) {
                                const currentSettings = project.settings || {};
                                const newSettings = {
                                  ...currentSettings,
                                  category: isCurrent ? null : cat,
                                };
                                import('../lib/projects.js').then(({ updateProject }) => {
                                  if (user) {
                                    updateProject(user.id, contextMenu.id, {
                                      settings: newSettings,
                                    }).then((success) => {
                                      if (success) {
                                        setProjects((prev) =>
                                          prev.map((p) =>
                                            p.id === contextMenu.id ? { ...p, settings: newSettings } : p,
                                          ),
                                        );
                                        addToast(isCurrent ? `Removed from ${cat}` : `Added to ${cat}`);
                                      }
                                    });
                                  }
                                });
                              }
                              setContextMenu(null);
                            }}
                          >
                            {cat} {isCurrent && '✓'}
                          </button>
                        );
                      })}
                  </div>
                </div>
                <div className="iso-context-menu-sep" />
                <button
                  className="iso-context-menu-item iso-context-menu-item--danger"
                  onClick={() => {
                    setProjectToDelete(contextMenu.id);
                    setContextMenu(null);
                  }}
                >
                  Delete project
                </button>
              </>
            );
          })()}
        {contextMenu.type === 'diagram' && (
          <>
            <button
              className="iso-context-menu-item"
              onClick={() => {
                setRenameType('diagram');
                setRenameTargetId(contextMenu.id);
                setRenameValue(contextMenu.extra?.diagramName || '');
                setRenameModalOpen(true);
                setContextMenu(null);
              }}
            >
              Rename
            </button>

            <div style={{ position: 'relative' }} className="iso-menu-dropdown-wrapper">
              <button className="iso-context-menu-item" style={{ justifyContent: 'space-between', display: 'flex' }}>
                Move to project <span>▶</span>
              </button>
              <div
                className="iso-menu-dropdown-submenu"
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: 0,
                  background: 'var(--iso-bg-panel)',
                  border: '1px solid var(--iso-border)',
                  borderRadius: '4px',
                  padding: '4px',
                  display: 'none',
                  flexDirection: 'column',
                  minWidth: '160px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
                }}
              >
                {projects
                  .filter((proj) => proj.id !== contextMenu.extra?.projectId)
                  .map((proj) => (
                    <button
                      key={proj.id}
                      className="iso-context-menu-item"
                      onClick={() => {
                        import('../lib/projects.js').then(({ updateDiagram }) => {
                          updateDiagram(contextMenu.id, { project_id: proj.id }).then((success) => {
                            if (success) {
                              setProjectDetailDiagrams((prev) => prev.filter((d) => d.id !== contextMenu.id));
                              setTabs((prev) =>
                                prev.map((t) => (t.diagram_id === contextMenu.id ? { ...t, project_id: proj.id } : t)),
                              );
                              addToast(`Moved to project ${proj.name}`);
                            } else {
                              addToast('Failed to move diagram', 'info');
                            }
                          });
                        });
                        setContextMenu(null);
                      }}
                    >
                      {proj.name}
                    </button>
                  ))}
                {projects.filter((proj) => proj.id !== contextMenu.extra?.projectId).length === 0 && (
                  <div
                    style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: 'var(--iso-text-muted)',
                      fontStyle: 'italic',
                    }}
                  >
                    No other projects
                  </div>
                )}
              </div>
            </div>

            <button
              className="iso-context-menu-item"
              onClick={() => {
                downloadDiagramFile(contextMenu.extra?.diagram);
                setContextMenu(null);
              }}
            >
              Download
            </button>

            <div className="iso-context-menu-sep" />

            <button
              className="iso-context-menu-item iso-context-menu-item--danger"
              onClick={() => {
                setDiagramToDelete(contextMenu.extra?.diagram);
                setContextMenu(null);
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </>
  );
}
