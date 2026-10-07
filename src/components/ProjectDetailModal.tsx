import React from 'react';
import type { Project } from '../lib/projects.js';

interface ProjectDetailModalProps {
  isOpen: boolean;
  project: Project | null;
  isLoading: boolean;
  diagrams: any[];
  accessMap: { base: string; diagrams: Record<string, string> };
  user: any;
  t: (key: string, vars?: any) => string;
  onClose: () => void;
  openProjectFile: (diagram: any, projectId: string, role?: string) => void;
  getDiagramRole: (diagramId: string) => string;
  setContextMenu: React.Dispatch<React.SetStateAction<any>>;
  openWholeProject: (diagrams: any[], projectId: string, baseRole: string, rolesMap: Record<string, string>) => void;
}

export function ProjectDetailModal({
  isOpen,
  project,
  isLoading,
  diagrams,
  accessMap,
  user,
  t,
  onClose,
  openProjectFile,
  getDiagramRole,
  setContextMenu,
  openWholeProject,
}: ProjectDetailModalProps) {
  if (!isOpen || !project) return null;

  return (
    <div className="iso-modal-overlay" style={{ zIndex: 2100 }} onClick={onClose}>
      <div
        className="iso-modal"
        style={{
          width: '480px',
          maxWidth: '90%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="iso-modal-header" style={{ marginBottom: '16px' }}>
          <h3 className="iso-modal-title" style={{ fontSize: '18px', fontWeight: 600 }}>
            {project.name}
          </h3>
          <button className="iso-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="iso-modal-desc" style={{ marginBottom: '16px' }}>
          {t('project_detail.desc') || 'Select a file to open, or open the entire project.'}
        </p>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minHeight: '120px',
            maxHeight: '300px',
            paddingRight: '4px',
          }}
        >
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--iso-text-muted)',
              }}
            >
              <div className="iso-spinner" style={{ marginRight: '8px' }} /> {t('project_detail.loading_files') || 'Loading files...'}
            </div>
          ) : diagrams.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flex: 1,
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--iso-text-muted)',
                padding: '24px',
                textAlign: 'center',
                background: 'var(--iso-bg-header)',
                borderRadius: '8px',
                border: '1px dashed var(--iso-border)',
              }}
            >
              <span style={{ fontSize: '24px', marginBottom: '8px' }}>📂</span>
              <span>{t('project_detail.no_files') || 'This project has no files.'}</span>
            </div>
          ) : (
            diagrams.map((d) => (
              <div
                key={d.id}
                onClick={() => openProjectFile(d, project.id, getDiagramRole(d.id))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    type: 'diagram',
                    id: d.id,
                    x: e.clientX,
                    y: e.clientY,
                    extra: {
                      projectId: project.id,
                      diagramName: d.name,
                      diagram: d,
                    },
                  });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: 'var(--iso-bg-header)',
                  border: '1px solid var(--iso-border)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--iso-text)' }}>{d.name}</strong>
                    {project.owner_id !== user?.id && (
                      <span
                        style={{
                          fontSize: '10px',
                          background: 'var(--iso-bg-app)',
                          border: '1px solid var(--iso-border)',
                          padding: '1px 5px',
                          borderRadius: '8px',
                          textTransform: 'capitalize',
                          color: 'var(--iso-text-muted)',
                          fontWeight: 500,
                        }}
                      >
                        {t(`share.${getDiagramRole(d.id)}`) || getDiagramRole(d.id)}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--iso-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {d.kind}
                  </span>
                </div>
                <span style={{ fontSize: '18px', color: 'var(--iso-text-muted)' }}>→</span>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="iso-btn" style={{ flex: 1 }} onClick={onClose}>
            {t('ui.cancel')}
          </button>
          <button
            className="iso-btn iso-btn--primary"
            style={{ flex: 1 }}
            disabled={isLoading || diagrams.length === 0}
            onClick={() => {
              const rolesMap: Record<string, string> = {};
              diagrams.forEach((d) => {
                rolesMap[d.id] = getDiagramRole(d.id);
              });
              openWholeProject(
                diagrams,
                project.id,
                project.owner_id === user?.id ? 'owner' : accessMap.base || 'viewer',
                rolesMap,
              );
            }}
          >
            {t('project_detail.open_whole_project') || 'Open whole project'}
          </button>
        </div>
      </div>
    </div>
  );
}
