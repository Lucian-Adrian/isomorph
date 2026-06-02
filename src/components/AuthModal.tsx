import { AuthCloudPanel, type AuthCloudPanelProps } from './AuthCloudPanel.js';
import { tText } from '../i18n.js';

export interface AuthModalProps extends AuthCloudPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose, ...props }: AuthModalProps) {
  if (!open) return null;
  const uiLanguage = props.uiLanguage ?? 'en';
  const t = (key: string) => tText(uiLanguage, key);
  return (
    <div className="iso-workspace-overlay" role="presentation" onMouseDown={onClose}>
      <section className="iso-workspace-modal" role="dialog" aria-modal="true" aria-label={t('account.cloud_aria')} onMouseDown={event => event.stopPropagation()}>
        <div className="iso-workspace-modal-header">
          <strong>{t('account.cloud_title')}</strong>
          <button type="button" className="iso-icon-button" onClick={onClose} aria-label={t('account.close')}>x</button>
        </div>
        <div className="iso-workspace-modal-body">
          <AuthCloudPanel {...props} />
        </div>
      </section>
    </div>
  );
}
