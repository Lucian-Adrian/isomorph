import { MetricsPanel, type MetricsPanelProps } from './MetricsPanel.js';

export interface MetricsDrawerProps extends MetricsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function MetricsDrawer({ open, onClose, ...props }: MetricsDrawerProps) {
  if (!open) return null;
  return (
    <div className="iso-workspace-overlay" role="presentation" onMouseDown={onClose}>
      <section className="iso-workspace-modal" role="dialog" aria-modal="true" aria-label="Metrics report" onMouseDown={event => event.stopPropagation()}>
        <div className="iso-workspace-modal-header">
          <strong>Metrics</strong>
          <button type="button" className="iso-icon-button" onClick={onClose} aria-label="Close metrics">x</button>
        </div>
        <div className="iso-workspace-modal-body">
          <MetricsPanel {...props} />
        </div>
      </section>
    </div>
  );
}
