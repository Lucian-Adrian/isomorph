import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { tText, type Language } from '../../i18n.js';

export type WorkspaceOverlay = 'cloud' | 'codegen' | 'metrics';

interface WorkspaceOverlayHostProps {
  activeOverlay: WorkspaceOverlay | null;
  uiLanguage?: Language;
  cloudPanel?: ReactNode;
  codegenPanel: ReactNode;
  metricsPanel: ReactNode;
  onClose: () => void;
  onSelectOverlay: (overlay: WorkspaceOverlay) => void;
}

const OVERLAY_TITLE_KEYS: Record<WorkspaceOverlay, string> = {
  cloud: 'account.cloud_title',
  codegen: 'codegen.panel_title',
  metrics: 'metrics.panel_title',
};

const OVERLAY_ARIA_KEYS: Record<WorkspaceOverlay, string> = {
  cloud: 'account.cloud_aria',
  codegen: 'codegen.panel_title',
  metrics: 'metrics.panel_title',
};

const OVERLAY_TABS: Array<{ key: WorkspaceOverlay; labelKey: string }> = [
  { key: 'cloud', labelKey: 'account.cloud' },
  { key: 'codegen', labelKey: 'codegen.title' },
  { key: 'metrics', labelKey: 'metrics.title' },
];

export function WorkspaceOverlayHost({
  activeOverlay,
  uiLanguage = 'en',
  cloudPanel,
  codegenPanel,
  metricsPanel,
  onClose,
  onSelectOverlay,
}: WorkspaceOverlayHostProps) {
  const t = (key: string) => tText(uiLanguage, key);

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
    <aside className="iso-workspace-dock" aria-label={t('workspace.utilities')}>
      <section
        className="iso-workspace-dock-panel"
        role="dialog"
        aria-modal="false"
        aria-label={t(OVERLAY_ARIA_KEYS[activeOverlay])}
      >
        <div className="iso-workspace-dock-header">
          <div className="iso-workspace-dock-tabs" role="tablist" aria-label={t('workspace.panels')}>
            {OVERLAY_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={tab.key === activeOverlay}
                className={`iso-workspace-dock-tab${tab.key === activeOverlay ? ' iso-workspace-dock-tab--active' : ''}`}
                onClick={() => onSelectOverlay(tab.key)}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
          <button type="button" className="iso-btn iso-btn--icon" onClick={onClose} aria-label={t('workspace.close_panel')}>
            x
          </button>
        </div>
        <div className="iso-workspace-dock-meta">{t(OVERLAY_TITLE_KEYS[activeOverlay])}</div>
        <div className="iso-workspace-dock-body">
          {activeOverlay === 'cloud' && cloudPanel}
          {activeOverlay === 'codegen' && codegenPanel}
          {activeOverlay === 'metrics' && metricsPanel}
        </div>
      </section>
    </aside>
  );
}
