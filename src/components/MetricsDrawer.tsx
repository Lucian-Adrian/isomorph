import { MetricsPanel, type MetricsPanelProps } from './MetricsPanel.js';
import { tText } from '../i18n.js';

export interface MetricsDrawerProps extends MetricsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function MetricsDrawer({ open, onClose, ...props }: MetricsDrawerProps) {
  if (!open) return null;
  const uiLanguage = props.uiLanguage ?? 'en';
  const t = (key: string) => tText(uiLanguage, key);
  return (
    <div className="iso-workspace-overlay" role="presentation" onMouseDown={onClose}>
      <section className="iso-workspace-modal" role="dialog" aria-modal="true" aria-label={t('metrics.report_aria')} onMouseDown={event => event.stopPropagation()}>
        <div className="iso-workspace-modal-header">
          <strong>{t('metrics.title')}</strong>
          <button type="button" className="iso-icon-button" onClick={onClose} aria-label={t('metrics.close')}>x</button>
        </div>
        <div className="iso-workspace-modal-body">
          <MetricsPanel {...props} />
        </div>
      </section>
    </div>
  );
}
