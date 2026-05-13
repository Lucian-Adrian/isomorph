import type { ReactNode } from 'react';

export type WorkspaceOverlay = 'cloud' | 'codegen' | 'metrics';

interface WorkspaceOverlayHostProps {
  activeOverlay: WorkspaceOverlay | null;
  cloudPanel: ReactNode;
  codegenPanel: ReactNode;
  metricsPanel: ReactNode;
  onClose: () => void;
}

const OVERLAY_TITLES: Record<WorkspaceOverlay, string> = {
  cloud: 'Account and Cloud Sync',
  codegen: 'Generated Code',
  metrics: 'Reports and Metrics',
};

export function WorkspaceOverlayHost({
  activeOverlay,
  cloudPanel,
  codegenPanel,
  metricsPanel,
  onClose,
}: WorkspaceOverlayHostProps) {
  if (!activeOverlay) return null;

  return (
    <div className="iso-modal-overlay iso-workspace-overlay" onClick={onClose}>
      <div className="iso-workspace-modal" onClick={event => event.stopPropagation()}>
        <div className="iso-workspace-modal-header">
          <strong>{OVERLAY_TITLES[activeOverlay]}</strong>
          <button type="button" className="iso-btn iso-btn--icon" onClick={onClose} aria-label="Close workspace panel">
            x
          </button>
        </div>
        <div className="iso-workspace-modal-body">
          {activeOverlay === 'cloud' && cloudPanel}
          {activeOverlay === 'codegen' && codegenPanel}
          {activeOverlay === 'metrics' && metricsPanel}
        </div>
      </div>
    </div>
  );
}
