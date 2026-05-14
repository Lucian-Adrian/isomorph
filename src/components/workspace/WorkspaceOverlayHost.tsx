import { useEffect } from 'react';
import type { ReactNode } from 'react';

export type WorkspaceOverlay = 'cloud' | 'codegen' | 'metrics';

interface WorkspaceOverlayHostProps {
  activeOverlay: WorkspaceOverlay | null;
  cloudPanel: ReactNode;
  codegenPanel: ReactNode;
  metricsPanel: ReactNode;
  onClose: () => void;
  onSelectOverlay: (overlay: WorkspaceOverlay) => void;
}

const OVERLAY_TITLES: Record<WorkspaceOverlay, string> = {
  cloud: 'Account and Cloud Sync',
  codegen: 'Generated Code',
  metrics: 'Reports and Metrics',
};

const OVERLAY_TABS: Array<{ key: WorkspaceOverlay; label: string }> = [
  { key: 'cloud', label: 'Account' },
  { key: 'codegen', label: 'Codegen' },
  { key: 'metrics', label: 'Metrics' },
];

export function WorkspaceOverlayHost({
  activeOverlay,
  cloudPanel,
  codegenPanel,
  metricsPanel,
  onClose,
  onSelectOverlay,
}: WorkspaceOverlayHostProps) {
  useEffect(() => {
    if (!activeOverlay) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeOverlay, onClose]);

  if (!activeOverlay) return null;

  return (
    <aside className="iso-workspace-dock" aria-label="Workspace utilities">
      <section className="iso-workspace-dock-panel" aria-modal="false" role="region" aria-label={OVERLAY_TITLES[activeOverlay]}>
        <div className="iso-workspace-dock-header">
          <div className="iso-workspace-dock-tabs" role="tablist" aria-label="Workspace panels">
            {OVERLAY_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={tab.key === activeOverlay}
                className={`iso-workspace-dock-tab${tab.key === activeOverlay ? ' iso-workspace-dock-tab--active' : ''}`}
                onClick={() => onSelectOverlay(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button type="button" className="iso-btn iso-btn--icon" onClick={onClose} aria-label="Close workspace panel">
            x
          </button>
        </div>
        <div className="iso-workspace-dock-meta">{OVERLAY_TITLES[activeOverlay]}</div>
        <div className="iso-workspace-dock-body">
          {activeOverlay === 'cloud' && cloudPanel}
          {activeOverlay === 'codegen' && codegenPanel}
          {activeOverlay === 'metrics' && metricsPanel}
        </div>
      </section>
    </aside>
  );
}
