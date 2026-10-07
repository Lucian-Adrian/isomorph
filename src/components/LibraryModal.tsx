import { useState, useRef, useEffect } from 'react';
import { type Project } from '../lib/projects.js';
import type { WorkspaceTab } from '../types/index.js';
import { EXAMPLES } from '../data/examples.js';
import { slugId } from '../utils/source-manipulation.js';

interface LibraryModalProps {
  onClose: () => void;
  user: any;
  session: any;
  projects: Project[];
  sharedProjects: Project[];
  publicProjectIds: Set<string>;
  customCategories: string[];
  setCustomCategories: (cats: string[]) => void;
  saveCustomCategoriesToDB: (cats: string[]) => Promise<void>;
  libraryCategory?: string;
  setLibraryCategory?: (category: string) => void;

  // Tab actions
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  setActiveTabId: (id: string) => void;

  // Handlers from App
  handleOpenProjectDetails: (project: Project) => void;
  setContextMenu: (menu: any) => void;
  updateActiveTab: (updater: (tab: WorkspaceTab) => WorkspaceTab, sync?: boolean) => void;
  addToast: (message: string, type?: 'success' | 'info') => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  initialTab?: 'my' | 'shared' | 'open_folder' | 'examples';
}

export function LibraryModal({
  onClose,
  user,
  session,
  projects,
  sharedProjects,
  publicProjectIds,
  customCategories,
  setCustomCategories,
  saveCustomCategoriesToDB,
  libraryCategory: externalCategory,
  setLibraryCategory: externalSetCategory,
  setTabs,
  setActiveTabId,
  handleOpenProjectDetails,
  setContextMenu,
  updateActiveTab,
  addToast,
  t,
  initialTab,
}: LibraryModalProps) {
  const [libraryTab, setLibraryTab] = useState<'my' | 'shared' | 'open_folder' | 'examples'>(initialTab || 'my');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [libraryVisibilityFilter, setLibraryVisibilityFilter] = useState('all');
  const [librarySort, setLibrarySort] = useState('accessed');
  const [internalCategory, setInternalCategory] = useState('All projects');

  const libraryCategory = externalCategory ?? internalCategory;
  const setLibraryCategory = externalSetCategory ?? setInternalCategory;

  useEffect(() => {
    const isProtected =
      libraryCategory.toLowerCase() === 'all projects' ||
      libraryCategory.toLowerCase() === 'favorites' ||
      libraryCategory.toLowerCase() === 'favourites';
    if (!isProtected && !customCategories.includes(libraryCategory)) {
      setLibraryCategory('All projects');
    }
  }, [customCategories, libraryCategory, setLibraryCategory]);

  // Category addition states
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryPrompt, setNewCategoryPrompt] = useState(false);

  // File loading states
  const [localStagedFiles, setLocalStagedFiles] = useState<Array<{ name: string; source: string; id: string }>>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const localFileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadedFiles = (files: File[]) => {
    const isxFiles = files.filter((f) => f.name.endsWith('.isx'));
    if (isxFiles.length === 0) {
      addToast('No valid .isx files found', 'info');
      return;
    }

    let loadedCount = 0;
    const newStagedFiles: Array<{ name: string; source: string; id: string }> = [];

    isxFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          newStagedFiles.push({
            id: `staged-${slugId()}`,
            name: file.name,
            source: reader.result,
          });
        }
        loadedCount++;
        if (loadedCount === isxFiles.length) {
          setLocalStagedFiles((prev) => [...prev, ...newStagedFiles]);
          addToast(`Loaded ${newStagedFiles.length} file(s) for preview`);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) {
      handleLoadedFiles(files);
    }
  };

  const applyExample = (ex: (typeof EXAMPLES)[number]) => {
    updateActiveTab((tab) => ({
      ...tab,
      source: ex.source,
      activeDiagramIdx: 0,
      diagramKindFilter: ex.kind as any,
    }));
  };

  return (
    <>
      <div className="iso-modal-overlay" onClick={onClose}>
        <div className="iso-modal iso-modal-large" onClick={(e) => e.stopPropagation()}>
          <div className="iso-modal-sidebar">
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--iso-text)' }}>{t('ui.library')}</h2>
            <button
              className={`iso-modal-sidebar-tab ${libraryTab === 'my' ? 'active' : ''}`}
              onClick={() => setLibraryTab('my')}
            >
              {t('ui.my_works')}
            </button>
            <button
              className={`iso-modal-sidebar-tab ${libraryTab === 'shared' ? 'active' : ''}`}
              onClick={() => setLibraryTab('shared')}
            >
              {t('ui.shared_works')}
            </button>
            <button
              className={`iso-modal-sidebar-tab ${libraryTab === 'open_folder' ? 'active' : ''}`}
              onClick={() => setLibraryTab('open_folder')}
            >
              {t('ui.open_folder')}
            </button>
            <button
              className={`iso-modal-sidebar-tab ${libraryTab === 'examples' ? 'active' : ''}`}
              onClick={() => setLibraryTab('examples')}
            >
              {t('ui.examples')}
            </button>
          </div>
          <div
            className="iso-modal-content"
            style={{ position: 'relative', overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}
          >
            <button
              className="iso-modal-close-btn"
              style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}
              onClick={onClose}
            >
              ×
            </button>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '40px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                height: '100%',
              }}
            >
              {libraryTab === 'my' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '24px',
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: '20px' }}>{t('ui.my_works')}</h3>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          style={{
                            position: 'absolute',
                            left: '10px',
                            color: 'var(--iso-text-muted)',
                            pointerEvents: 'none',
                          }}
                        >
                          <circle cx="11" cy="11" r="8"></circle>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input
                          type="text"
                          placeholder={t('ui.search') || 'Search projects...'}
                          value={librarySearchQuery}
                          onChange={(e) => setLibrarySearchQuery(e.target.value)}
                          style={{
                            width: '200px',
                            padding: '6px 12px 6px 32px',
                            borderRadius: '20px',
                            background: 'var(--iso-bg-app)',
                            border: '1px solid transparent',
                            outline: 'none',
                            color: 'inherit',
                            fontSize: '13px',
                          }}
                        />
                      </div>
                      <select
                        className="iso-select"
                        value={libraryVisibilityFilter}
                        onChange={(e) => setLibraryVisibilityFilter(e.target.value)}
                        style={{ width: '120px', borderRadius: '20px', background: 'var(--iso-bg-app)' }}
                        aria-label={t('library.filter_visibility') || 'Filter visibility'}
                      >
                        <option value="all">{t('library.all')}</option>
                        <option value="public">{t('library.public')}</option>
                        <option value="private">{t('library.private')}</option>
                      </select>
                      <select
                        className="iso-select"
                        value={librarySort}
                        onChange={(e) => setLibrarySort(e.target.value)}
                        style={{ width: '150px', borderRadius: '20px', background: 'var(--iso-bg-app)' }}
                        aria-label={t('library.sort_projects') || 'Sort projects'}
                      >
                        <option value="accessed">{t('library.sort_accessed')}</option>
                        <option value="name">{t('library.sort_name')}</option>
                      </select>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      marginBottom: '16px',
                      overflowX: 'auto',
                      paddingBottom: '4px',
                    }}
                  >
                    {['All projects', ...customCategories].map((cat) => (
                      <button
                        key={cat}
                        className={libraryCategory === cat ? 'iso-btn iso-btn--primary' : 'iso-btn'}
                        style={{
                          borderRadius: '20px',
                          padding: '4px 12px',
                          background: libraryCategory === cat ? undefined : 'var(--iso-bg-header)',
                        }}
                        onClick={() => setLibraryCategory(cat)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          const isProtected =
                            cat.toLowerCase() === 'all projects' ||
                            cat.toLowerCase() === 'favorites' ||
                            cat.toLowerCase() === 'favourites';
                          if (!isProtected) {
                            setContextMenu({ type: 'category', id: cat, x: e.clientX, y: e.clientY });
                          }
                        }}
                      >
                        {cat.toLowerCase() === 'all projects'
                          ? (t('library.all_projects') || 'All projects')
                          : (cat.toLowerCase() === 'favorites' || cat.toLowerCase() === 'favourites')
                            ? (t('library.favorites') || cat)
                            : cat}
                      </button>
                    ))}
                    <button
                      className="iso-btn"
                      style={{ borderRadius: '20px', padding: '4px 12px', background: 'var(--iso-bg-header)' }}
                      onClick={() => {
                        setNewCategoryName('');
                        setNewCategoryPrompt(true);
                      }}
                    >
                      +
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '16px',
                      overflowY: 'auto',
                    }}
                  >
                    {!user ? (
                      <div
                        style={{
                          gridColumn: '1 / -1',
                          textAlign: 'center',
                          padding: '40px',
                          color: 'var(--iso-text-muted)',
                        }}
                      >
                        {t('ui.projects_login_needed')}
                      </div>
                    ) : (
                      (() => {
                        let filtered = projects.filter((p) =>
                          p.name.toLowerCase().includes(librarySearchQuery.toLowerCase()),
                        );

                        if (libraryVisibilityFilter === 'public') {
                          filtered = filtered.filter((p) => publicProjectIds.has(p.id));
                        } else if (libraryVisibilityFilter === 'private') {
                          filtered = filtered.filter((p) => !publicProjectIds.has(p.id));
                        }

                        const isFavTab =
                          libraryCategory.toLowerCase() === 'favorites' ||
                          libraryCategory.toLowerCase() === 'favourites';
                        if (isFavTab) {
                          filtered = filtered.filter((p) => p.settings?.is_favorite);
                        } else if (libraryCategory.toLowerCase() !== 'all projects') {
                          filtered = filtered.filter((p) => p.settings?.category === libraryCategory);
                        }

                        filtered = filtered.sort((a, b) => {
                          if (librarySort === 'name') return a.name.localeCompare(b.name);
                          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                        });

                        if (filtered.length === 0) {
                          return (
                            <div
                              style={{
                                gridColumn: '1 / -1',
                                textAlign: 'center',
                                padding: '40px',
                                color: 'var(--iso-text-muted)',
                              }}
                            >
                              {t('library.no_matching_filters')}
                            </div>
                          );
                        }

                        return filtered.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              handleOpenProjectDetails(p);
                              onClose();
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setContextMenu({ type: 'project', id: p.id, x: e.clientX, y: e.clientY });
                            }}
                            style={{
                              height: '140px',
                              background: 'var(--iso-bg-header)',
                              borderRadius: '8px',
                              border: '1px solid var(--iso-border)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--iso-text)',
                              cursor: 'pointer',
                              padding: '16px',
                              textAlign: 'center',
                            }}
                          >
                            <strong style={{ marginBottom: '8px' }}>{p.name}</strong>
                            <span style={{ fontSize: '12px', color: 'var(--iso-text-muted)' }}>
                              {new Date(p.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        ));
                      })()
                    )}
                  </div>
                </div>
              )}

              {libraryTab === 'shared' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {!session ? (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--iso-text-muted)',
                        minHeight: '200px',
                      }}
                    >
                      {t('ui.shared_login_needed')}
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '24px',
                        }}
                      >
                        <h3 style={{ margin: 0, fontSize: '20px' }}>{t('ui.shared_works')}</h3>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              style={{
                                position: 'absolute',
                                left: '10px',
                                color: 'var(--iso-text-muted)',
                                pointerEvents: 'none',
                              }}
                            >
                              <circle cx="11" cy="11" r="8"></circle>
                              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input
                              type="text"
                              placeholder={t('ui.search') || 'Search projects...'}
                              value={librarySearchQuery}
                              onChange={(e) => setLibrarySearchQuery(e.target.value)}
                              style={{
                                width: '200px',
                                padding: '6px 12px 6px 32px',
                                borderRadius: '20px',
                                background: 'var(--iso-bg-app)',
                                border: '1px solid transparent',
                                outline: 'none',
                                color: 'inherit',
                                fontSize: '13px',
                              }}
                            />
                          </div>
                          <select
                            className="iso-select"
                            value={librarySort}
                            onChange={(e) => setLibrarySort(e.target.value)}
                            style={{ width: '150px', borderRadius: '20px', background: 'var(--iso-bg-app)' }}
                            aria-label={t('library.sort_projects') || 'Sort projects'}
                          >
                            <option value="accessed">{t('library.sort_accessed')}</option>
                            <option value="name">{t('library.sort_name')}</option>
                          </select>
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          marginBottom: '16px',
                          overflowX: 'auto',
                          paddingBottom: '4px',
                        }}
                      >
                        {['All projects', ...customCategories].map((cat) => (
                          <button
                            key={cat}
                            className={libraryCategory === cat ? 'iso-btn iso-btn--primary' : 'iso-btn'}
                            style={{
                              borderRadius: '20px',
                              padding: '4px 12px',
                              background: libraryCategory === cat ? undefined : 'var(--iso-bg-header)',
                            }}
                            onClick={() => setLibraryCategory(cat)}
                          >
                            {cat.toLowerCase() === 'all projects'
                              ? (t('library.all_projects') || 'All projects')
                              : (cat.toLowerCase() === 'favorites' || cat.toLowerCase() === 'favourites')
                                ? (t('library.favorites') || cat)
                                : cat}
                          </button>
                        ))}
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                          gap: '16px',
                          overflowY: 'auto',
                        }}
                      >
                        {(() => {
                          let filtered = sharedProjects.filter((p) =>
                            p.name.toLowerCase().includes(librarySearchQuery.toLowerCase()),
                          );

                          const isFavTab =
                            libraryCategory.toLowerCase() === 'favorites' ||
                            libraryCategory.toLowerCase() === 'favourites';
                          if (isFavTab) {
                            filtered = filtered.filter((p) => p.settings?.is_favorite);
                          } else if (libraryCategory.toLowerCase() !== 'all projects') {
                            filtered = filtered.filter((p) => p.settings?.category === libraryCategory);
                          }

                          filtered = filtered.sort((a, b) => {
                            if (librarySort === 'name') return a.name.localeCompare(b.name);
                            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                          });

                          if (filtered.length === 0) {
                            return (
                              <div
                                style={{
                                  gridColumn: '1 / -1',
                                  textAlign: 'center',
                                  padding: '40px',
                                  color: 'var(--iso-text-muted)',
                                }}
                              >
                                {sharedProjects.length === 0 ? t('ui.shared_future') : t('library.no_matching_filters')}
                              </div>
                            );
                          }

                          return filtered.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => {
                                handleOpenProjectDetails(p);
                                onClose();
                              }}
                              style={{
                                height: '140px',
                                background: 'var(--iso-bg-header)',
                                borderRadius: '8px',
                                border: '1px solid var(--iso-border)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--iso-text)',
                                cursor: 'pointer',
                                padding: '16px',
                                textAlign: 'center',
                                position: 'relative',
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = 'var(--iso-accent)';
                                e.currentTarget.style.background = 'var(--iso-bg-hover)';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = 'var(--iso-border)';
                                e.currentTarget.style.background = 'var(--iso-bg-header)';
                              }}
                            >
                              <span
                                style={{
                                  position: 'absolute',
                                  top: '8px',
                                  right: '8px',
                                  fontSize: '10px',
                                  background: 'var(--iso-bg-app)',
                                  border: '1px solid var(--iso-border)',
                                  padding: '2px 6px',
                                  borderRadius: '12px',
                                  textTransform: 'capitalize',
                                  color: 'var(--iso-text-muted)',
                                  fontWeight: 500,
                                }}
                              >
                                {t(`share.${(p as any).role}`) || (p as any).role}
                              </span>
                              <strong style={{ marginBottom: '8px', marginTop: '12px' }}>{p.name}</strong>
                              <span style={{ fontSize: '12px', color: 'var(--iso-text-muted)' }}>
                                {new Date(p.updated_at).toLocaleDateString()}
                              </span>
                            </div>
                          ));
                        })()}
                      </div>
                    </>
                  )}
                </div>
              )}

              {libraryTab === 'open_folder' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
                  <input
                    ref={localFileInputRef}
                    type="file"
                    accept=".isx"
                    multiple
                    onChange={(e) => {
                      const files = e.target.files ? Array.from(e.target.files) : [];
                      if (files.length > 0) {
                        handleLoadedFiles(files);
                      }
                      if (localFileInputRef.current) localFileInputRef.current.value = '';
                    }}
                    style={{ display: 'none' }}
                  />

                  {localStagedFiles.length === 0 ? (
                    <div
                      onClick={() => localFileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '48px 32px',
                        borderRadius: '16px',
                        border: isDraggingOver ? '2px dashed var(--iso-accent)' : '2px dashed var(--iso-border)',
                        background: isDraggingOver ? 'var(--iso-bg-canvas)' : 'var(--iso-bg-header)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{t('library.drop_title')}</h3>
                      <p
                        style={{
                          margin: '8px 0 16px',
                          fontSize: '13px',
                          color: 'var(--iso-text-muted)',
                          maxWidth: '280px',
                          lineHeight: '1.5',
                        }}
                      >
                        {t('library.drop_desc')}
                      </p>
                      <button
                        className="iso-btn iso-btn--primary"
                        style={{ padding: '8px 24px', borderRadius: '20px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          localFileInputRef.current?.click();
                        }}
                      >
                        {t('library.browse_files')}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '16px',
                        }}
                      >
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                          {t('library.selected_files')} ({localStagedFiles.length})
                        </h3>
                        <button
                          className="iso-btn"
                          style={{ fontSize: '12px', padding: '4px 12px' }}
                          onClick={() => localFileInputRef.current?.click()}
                        >
                          {t('library.add_more')}
                        </button>
                      </div>

                      <div
                        style={{
                          flex: 1,
                          overflowY: 'auto',
                          marginBottom: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          paddingRight: '4px',
                        }}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        {localStagedFiles.map((f) => (
                          <div
                            key={f.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              background: 'var(--iso-bg-header)',
                              border: '1px solid var(--iso-border)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                              <span style={{ fontSize: '18px' }}>📄</span>
                              <span
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 500,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  color: 'var(--iso-text)',
                                }}
                                title={f.name}
                              >
                                {f.name}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className="iso-btn"
                                style={{ fontSize: '12px', padding: '4px 10px', background: 'var(--iso-bg-hover)' }}
                                onClick={() => {
                                  const id = `tab-${slugId()}`;
                                  setTabs((prev) => [
                                    ...prev,
                                    {
                                      id,
                                      name: f.name,
                                      source: f.source,
                                      savedSource: f.source,
                                      activeDiagramIdx: 0,
                                      diagramKindFilter: 'all',
                                    },
                                  ]);
                                  setActiveTabId(id);
                                  setLocalStagedFiles((prev) => prev.filter((item) => item.id !== f.id));
                                  if (localStagedFiles.length === 1) {
                                    onClose();
                                  }
                                }}
                              >
                                {t('menu.open') || 'Open'}
                              </button>
                              <button
                                className="iso-btn"
                                style={{
                                  fontSize: '12px',
                                  padding: '4px 10px',
                                  color: 'var(--iso-error)',
                                  background: 'var(--iso-bg-hover)',
                                }}
                                onClick={() => setLocalStagedFiles((prev) => prev.filter((item) => item.id !== f.id))}
                              >
                                {t('ui.remove') || 'Remove'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: '12px',
                          borderTop: '1px solid var(--iso-border)',
                          paddingTop: '16px',
                        }}
                      >
                        <button
                          className="iso-btn"
                          style={{ flex: 1, justifyContent: 'center' }}
                          onClick={() => setLocalStagedFiles([])}
                        >
                          {t('library.clear_all') || 'Clear all'}
                        </button>
                        <button
                          className="iso-btn iso-btn--primary"
                          style={{ flex: 2, justifyContent: 'center' }}
                          onClick={() => {
                            const newTabs: WorkspaceTab[] = localStagedFiles.map((f) => {
                              const tabId = `tab-${slugId()}`;
                              return {
                                id: tabId,
                                name: f.name,
                                source: f.source,
                                savedSource: f.source,
                                activeDiagramIdx: 0,
                                diagramKindFilter: 'all',
                              };
                            });
                            setTabs((prev) => [...prev, ...newTabs]);
                            if (newTabs.length > 0) {
                              setActiveTabId(newTabs[0].id);
                            }
                            setLocalStagedFiles([]);
                            onClose();
                          }}
                        >
                          {t('library.open_all_files') || 'Open all files'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {libraryTab === 'examples' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '24px',
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: '20px' }}>{t('ui.examples')}</h3>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '16px',
                      overflowY: 'auto',
                    }}
                  >
                    {EXAMPLES.map((ex) => (
                      <div
                        key={ex.label}
                        onClick={() => {
                          applyExample(ex);
                          onClose();
                        }}
                        style={{
                          height: '140px',
                          background: 'var(--iso-bg-header)',
                          borderRadius: '8px',
                          border: '1px solid var(--iso-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--iso-text)',
                          cursor: 'pointer',
                          padding: '16px',
                          textAlign: 'center',
                        }}
                      >
                        <strong style={{ marginBottom: '8px' }}>{ex.label}</strong>
                        <span style={{ fontSize: '12px', color: 'var(--iso-text-muted)' }}>{ex.kind}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {newCategoryPrompt && (
        <div className="iso-modal-overlay" style={{ zIndex: 2000 }} onClick={() => setNewCategoryPrompt(false)}>
          <div className="iso-modal" onClick={(e) => e.stopPropagation()}>
            <button className="iso-modal-close-btn" onClick={() => setNewCategoryPrompt(false)}>
              ×
            </button>
            <h2 className="iso-modal-title">{t('ui.new_category_name') || 'New category name'}</h2>
            <div className="iso-modal-field">
              <input
                type="text"
                className="iso-input"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onBlur={() => setNewCategoryName(newCategoryName.trim())}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCategoryName.trim()) {
                    const name = newCategoryName.trim();
                    if (!customCategories.includes(name)) {
                      const next = [...customCategories, name];
                      setCustomCategories(next);
                      setLibraryCategory(name);
                      saveCustomCategoriesToDB(next);
                    }
                    setNewCategoryPrompt(false);
                  }
                }}
              />
            </div>
            <div className="iso-modal-actions">
              <button className="iso-modal-btn cancel" onClick={() => setNewCategoryPrompt(false)}>
                {t('ui.cancel')}
              </button>
              <button
                className="iso-modal-btn"
                onClick={() => {
                  const name = newCategoryName.trim();
                  if (name && !customCategories.includes(name)) {
                    const next = [...customCategories, name];
                    setCustomCategories(next);
                    setLibraryCategory(name);
                    saveCustomCategoriesToDB(next);
                  }
                  setNewCategoryPrompt(false);
                }}
              >
                {t('ui.add_category') || 'Add category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
