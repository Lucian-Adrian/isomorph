// ============================================================
// Isomorph — Toolbar / Header Component
// ============================================================
// Renders the top logo, project breadcrumbs, workspace tabs,
// collaborator bar, and action buttons.
// Extracted from App.tsx during demonolith decomposition.
// ============================================================

import React from 'react';
import type { Project } from '../lib/projects.js';
import type { WorkspaceTab } from '../types/index.js';
import type { IOMDiagram } from '../semantics/iom.js';
import { CollaboratorBar, type Collaborator } from './CollaboratorBar.js';
import {
  IconNew,
  IconOpen,
  IconKeyboard,
  IconSettings,
  IconSave,
  IconTransform,
  IconExport,
  IconImage,
  IconFileImage,
  IconVideo,
  IconGif,
} from './Icons.js';

interface ToolbarProps {
  activeTab: WorkspaceTab | null;
  activeDiagram: IOMDiagram | null;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  renamingTabId: string | null;
  setRenamingTabId: (id: string | null) => void;
  user: any;
  session: any;
  isMobileLayout: boolean;
  fileName: string;
  tabs: WorkspaceTab[];
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  setActiveTabId: (id: string) => void;
  setTabToClose: (id: string | null) => void;
  isConnected: boolean;
  sortedCollaborators: Collaborator[];
  awareness: any;
  t: (key: string, vars?: any) => string;
  handleNew: () => void;
  setIsLibraryOpen: (open: boolean) => void;
  setIsShareModalOpen: (open: boolean) => void;
  handleTransformToCollaboration: () => void;
  isHistoryOpen: boolean;
  toggleHistory: () => void;
  isExporting: boolean;
  exportTime: number;
  exportMenuOpen: boolean;
  setExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleExportPNG: () => void;
  handleExportSVG: () => void;
  handleExportGIF: () => void;
  handleExportMP4: () => void;
  isAnimationsEnabled: boolean;
  setIsAnimating: React.Dispatch<React.SetStateAction<boolean>>;
  isAnimating: boolean;
  setShortcutsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileOpen: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setSettingsTab?: (tab: 'profile' | 'collab' | 'storage' | 'app') => void;
  setIsSettingsOpen: (open: boolean) => void;
  addToast: (msg: string, type?: 'success' | 'info') => void;
}

export function Toolbar({
  activeTab,
  activeDiagram,
  projects,
  setProjects,
  renamingTabId,
  setRenamingTabId,
  user,
  session,
  isMobileLayout,
  fileName,
  tabs,
  setTabs,
  setActiveTabId,
  setTabToClose,
  isConnected,
  sortedCollaborators,
  awareness,
  t,
  handleNew,
  setIsLibraryOpen,
  setIsShareModalOpen,
  handleTransformToCollaboration,
  isHistoryOpen,
  toggleHistory,
  isExporting,
  exportTime,
  exportMenuOpen,
  setExportMenuOpen,
  handleExportPNG,
  handleExportSVG,
  handleExportGIF,
  handleExportMP4,
  isAnimationsEnabled,
  setIsAnimating,
  isAnimating,
  setShortcutsOpen,
  fileInputRef,
  handleFileOpen,
  setSettingsTab,
  setIsSettingsOpen,
  addToast,
}: ToolbarProps) {
  return (
    <header className="iso-header">
      {/* Logo */}
      <button
        type="button"
        className="iso-logo"
        aria-label={t('ui.isomorph_home')}
        onClick={(e) => e.preventDefault()}
      >
        <span className="iso-logo-name">Isomorph</span>
      </button>

      <div className="iso-header-sep iso-mobile-hide" aria-hidden="true" />

      {/* File breadcrumb */}
      <div
        className="iso-breadcrumb iso-mobile-hide"
        onDoubleClick={() => {
          if (activeTab?.project_id && (!activeTab.project_role || activeTab.project_role === 'owner')) {
            setRenamingTabId('project-' + activeTab.project_id);
          }
        }}
      >
        {renamingTabId === 'project-' + activeTab?.project_id ? (
          <input
            autoFocus
            defaultValue={projects.find((p) => p.id === activeTab?.project_id)?.name || 'Local Project'}
            className="iso-tab-rename-input"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              outline: 'none',
              width: '100%',
              borderBottom: '1px solid currentColor',
            }}
            onBlur={() => setRenamingTabId(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const newName = e.currentTarget.value;
                if (activeTab?.project_id && user && newName) {
                  setProjects((prev) =>
                    prev.map((p) => (p.id === activeTab.project_id ? { ...p, name: newName } : p))
                  );
                  import('../lib/projects.js').then((m) =>
                    m.updateProject(user.id, activeTab.project_id!, { name: newName })
                  );
                  addToast('Project renamed');
                }
                setRenamingTabId(null);
              }
              if (e.key === 'Escape') setRenamingTabId(null);
            }}
          />
        ) : (
          <span
            className="iso-breadcrumb-name"
            style={{
              cursor:
                activeTab?.project_id && (!activeTab.project_role || activeTab.project_role === 'owner')
                  ? 'pointer'
                  : 'default',
            }}
            data-tooltip={
              activeTab?.project_id && (!activeTab.project_role || activeTab.project_role === 'owner')
                ? 'Double click to rename project'
                : undefined
            }
          >
            {projects.find((p) => p.id === activeTab?.project_id)?.name || 'Local Project'}
          </span>
        )}
      </div>

      {isMobileLayout && (
        <div
          className="iso-mobile-title"
          title={fileName}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setRenamingTabId(activeTab?.id ?? null);
          }}
          onDoubleClick={() => setRenamingTabId(activeTab?.id ?? null)}
          onClick={() => setRenamingTabId(activeTab?.id ?? null)}
        >
          {renamingTabId === activeTab?.id ? (
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <input
                autoFocus
                defaultValue={
                  fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName
                }
                className="iso-tab-rename-input"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  outline: 'none',
                  width: '100%',
                  borderBottom: '1px solid currentColor',
                }}
                onBlur={(e) => {
                  if (isMobileLayout) return;
                  const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
                  const newName = e.target.value ? e.target.value + ext : fileName;
                  if (activeTab) {
                    setTabs((prev) =>
                      prev.map((t) => (t.id === activeTab.id ? { ...t, name: newName } : t))
                    );
                  }
                  setRenamingTabId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
                    const newName = e.currentTarget.value ? e.currentTarget.value + ext : fileName;
                    if (activeTab) {
                      setTabs((prev) =>
                        prev.map((t) => (t.id === activeTab.id ? { ...t, name: newName } : t))
                      );
                    }
                    setRenamingTabId(null);
                  }
                  if (e.key === 'Escape') setRenamingTabId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span>{fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : ''}</span>
            </span>
          ) : (
            fileName
          )}
        </div>
      )}

      <div className="iso-header-sep iso-mobile-hide" aria-hidden="true" />

      <div
        className="iso-mobile-hide"
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: '0 1 auto',
          minWidth: 0,
          overflow: 'hidden',
          marginLeft: '12px',
        }}
      >
        <button
          type="button"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--iso-text)',
            cursor: 'pointer',
            padding: '0 4px',
            opacity: 0.6,
          }}
          onClick={(e) =>
            (e.currentTarget.nextElementSibling as HTMLElement)?.scrollBy({
              left: -150,
              behavior: 'smooth',
            })
          }
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
        >
          ◀
        </button>
        <nav
          className="iso-tabs"
          aria-label={t('tabs.open_files')}
          style={{
            flex: '1 1 auto',
            overflowX: 'auto',
            display: 'flex',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {tabs.map((tab, idx) => (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', idx.toString());
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                if (isNaN(fromIdx) || fromIdx === idx) return;
                setTabs((prev) => {
                  const next = [...prev];
                  const [moved] = next.splice(fromIdx, 1);
                  next.splice(idx, 0, moved);
                  return next;
                });
              }}
              className={`iso-tab${tab.id === activeTab?.id ? ' iso-tab--active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={() => {
                if (!tab.project_role || tab.project_role === 'owner') setRenamingTabId(tab.id);
              }}
              aria-label={t('tabs.open_name', { name: tab.name })}
              style={{ paddingRight: tabs.length > 1 ? '4px' : '10px', cursor: 'grab' }}
            >
              {renamingTabId === tab.id ? (
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    autoFocus
                    defaultValue={
                      tab.name.includes('.') ? tab.name.substring(0, tab.name.lastIndexOf('.')) : tab.name
                    }
                    className="iso-tab-rename-input"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'inherit',
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      outline: 'none',
                      width: '80px',
                      borderBottom: '1px solid currentColor',
                    }}
                    onBlur={(e) => {
                      const ext = tab.name.includes('.') ? tab.name.substring(tab.name.lastIndexOf('.')) : '';
                      const newName = e.target.value ? e.target.value + ext : tab.name;
                      setTabs((prev) =>
                        prev.map((t) => (t.id === tab.id ? { ...t, name: newName } : t))
                      );
                      setRenamingTabId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setRenamingTabId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>{tab.name.includes('.') ? tab.name.substring(tab.name.lastIndexOf('.')) : ''}</span>
                </span>
              ) : (
                tab.name
              )}
              {tabs.length > 1 && (
                <button
                  type="button"
                  style={{
                    all: 'unset',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    marginLeft: '4px',
                    cursor: 'pointer',
                    opacity: 0.6,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.6';
                    e.currentTarget.style.background = 'transparent';
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTabToClose(tab.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </nav>
        <button
          type="button"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--iso-text)',
            cursor: 'pointer',
            padding: '0 4px',
            opacity: 0.6,
          }}
          onClick={(e) =>
            (e.currentTarget.previousElementSibling as HTMLElement)?.scrollBy({
              left: 150,
              behavior: 'smooth',
            })
          }
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
        >
          ▶
        </button>
      </div>

      <div className="iso-header-spacer" />

      {activeDiagram && (
        <div
          className={
            isMobileLayout
              ? 'iso-kind-badge iso-kind-badge--mobile iso-mobile-hide'
              : 'iso-kind-badge'
          }
        >
          {activeDiagram.kind}
        </div>
      )}

      <CollaboratorBar
        activeTab={activeTab}
        isConnected={isConnected}
        sortedCollaborators={sortedCollaborators}
        awareness={awareness}
        t={t}
      />

      {!isMobileLayout && (
        <div className="iso-header-actions">
          {(!activeTab?.project_id || activeTab?.project_role === 'owner') && (
            <>
              <button
                type="button"
                className="iso-btn"
                onClick={handleNew}
                aria-label={t('menu.new_diagram')}
                data-tooltip={t('menu.new_shortcut')}
              >
                <IconNew />
                {t('menu.new')}
              </button>

              <button
                type="button"
                className="iso-btn"
                onClick={() => setIsLibraryOpen(true)}
                aria-label={t('menu.open_isx')}
                data-tooltip={t('menu.open_shortcut')}
              >
                <IconOpen />
                {t('menu.open')}
              </button>
            </>
          )}

          {activeTab?.project_role === 'owner' && (
            <button
              type="button"
              className="iso-btn"
              onClick={() => setIsShareModalOpen(true)}
              aria-label="Share Project"
              data-tooltip="Share Project"
            >
              <svg
                width="14"
                height="14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                style={{ marginRight: 4 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              {t('ui.share')}
            </button>
          )}

          {activeDiagram?.kind === 'sequence' && (
            <button
              type="button"
              className="iso-btn"
              onClick={handleTransformToCollaboration}
              aria-label={t('menu.transform_seq_collab')}
              data-tooltip={t('menu.transform_collab')}
            >
              <IconTransform />
              {t('menu.transform')}
            </button>
          )}

          <button
            type="button"
            className="iso-btn"
            onClick={() => {
              if (!activeTab) return;
              const blob = new Blob([activeTab.source], { type: 'application/octet-stream' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = activeTab.name || 'diagram.isx';
              a.click();
              URL.revokeObjectURL(url);
            }}
            disabled={!activeTab}
            aria-label={t('menu.export_source')}
            data-tooltip={t('menu.save_isx')}
          >
            <IconSave />
            {t('menu.save_isx_ext')}
          </button>

          {session && (
            <button
              type="button"
              className={`iso-btn${isHistoryOpen ? ' iso-btn--active' : ''}`}
              onClick={toggleHistory}
              aria-label="Toggle History"
              data-tooltip="View History"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              History
            </button>
          )}

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="iso-btn"
              onClick={(e) => {
                e.stopPropagation();
                setExportMenuOpen((o) => !o);
              }}
              disabled={!activeDiagram || isExporting}
              aria-label={t('ui.export')}
              data-tooltip={t('ui.export')}
            >
              {isExporting ? <div className="iso-spinner" /> : <IconExport />}
              {isExporting
                ? `${t('ui.exporting') || 'Exporting...'} (${exportTime}s)`
                : t('ui.export')}
            </button>
            {exportMenuOpen && activeDiagram && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  background: 'var(--iso-bg-panel)',
                  border: '1px solid var(--iso-border)',
                  borderRadius: '4px',
                  padding: '4px',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: '160px',
                  boxShadow: '0 4px 12px var(--iso-glass-shadow)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="iso-dropdown-item"
                  style={{
                    border: 'none',
                    textAlign: 'left',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    color: 'var(--iso-text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onClick={() => {
                    setExportMenuOpen(false);
                    handleExportPNG();
                  }}
                >
                  <IconImage /> {t('ui.export_png')}
                </button>
                <button
                  className="iso-dropdown-item"
                  style={{
                    border: 'none',
                    textAlign: 'left',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    color: 'var(--iso-text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onClick={() => {
                    setExportMenuOpen(false);
                    handleExportSVG();
                  }}
                >
                  <IconFileImage /> {t('ui.export_svg')}
                </button>
                {isAnimationsEnabled && (
                  <>
                    <button
                      className="iso-dropdown-item"
                      style={{
                        border: 'none',
                        textAlign: 'left',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        color: 'var(--iso-text)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                      onClick={() => {
                        setExportMenuOpen(false);
                        handleExportGIF();
                      }}
                    >
                      <IconGif /> {t('ui.export_gif')}
                    </button>
                    <button
                      className="iso-dropdown-item"
                      style={{
                        border: 'none',
                        textAlign: 'left',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        color: 'var(--iso-text)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                      onClick={() => {
                        setExportMenuOpen(false);
                        handleExportMP4();
                      }}
                    >
                      <IconVideo /> {t('ui.export_mp4')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {isAnimationsEnabled && activeDiagram && (
            <button
              type="button"
              className="iso-btn"
              onClick={() => setIsAnimating((a) => !a)}
              aria-label={isAnimating ? t('ui.pause') : t('ui.play')}
              data-tooltip={isAnimating ? t('ui.pause') : t('ui.play')}
              style={{ color: isAnimating ? 'var(--iso-accent)' : 'inherit' }}
            >
              {isAnimating ? '⏸' : '▶'} {isAnimating ? t('ui.pause') : t('ui.play')}
            </button>
          )}

          <div className="iso-header-sep" aria-hidden="true" />

          <button
            type="button"
            className="iso-btn iso-btn--icon"
            onClick={() => setShortcutsOpen((o) => !o)}
            aria-label={t('ui.shortcuts')}
            data-tooltip={t('menu.shortcuts')}
          >
            <IconKeyboard size={20} />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".isx"
        onChange={handleFileOpen}
        style={{ display: 'none' }}
        tabIndex={-1}
      />

      <button
        type="button"
        className="iso-btn iso-btn--icon iso-mobile-hide"
        style={{ marginLeft: 'auto' }}
        onClick={() => {
          setSettingsTab?.('profile');
          setIsSettingsOpen(true);
        }}
        aria-label="Settings"
        data-tooltip="Settings"
      >
        <IconSettings size={20} />
      </button>
    </header>
  );
}
