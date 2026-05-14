import { AuthCloudPanel, type AuthCloudPanelProps } from './AuthCloudPanel.js';

export interface AuthModalProps extends AuthCloudPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose, ...props }: AuthModalProps) {
  if (!open) return null;
  return (
    <div className="iso-workspace-overlay" role="presentation" onMouseDown={onClose}>
      <section className="iso-workspace-modal" role="dialog" aria-modal="true" aria-label="Account and cloud sync" onMouseDown={event => event.stopPropagation()}>
        <div className="iso-workspace-modal-header">
          <strong>Account & Cloud</strong>
          <button type="button" className="iso-icon-button" onClick={onClose} aria-label="Close account and cloud">x</button>
        </div>
        <div className="iso-workspace-modal-body">
          <AuthCloudPanel {...props} />
        </div>
      </section>
    </div>
  );
}
