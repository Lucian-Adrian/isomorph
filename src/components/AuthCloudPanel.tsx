import { IconSave } from './Icons.js';
import { tText, type Language } from '../i18n.js';

export interface RemoteDiagramSummary {
  id: string;
  title: string;
  line_count?: number;
  updated_at?: string;
  created_at?: string;
}

export interface AuthCloudPanelProps {
  isConfigured: boolean;
  userEmail?: string | null;
  statusMessage?: string;
  remoteDiagrams: RemoteDiagramSummary[];
  authEmail: string;
  authPassword: string;
  isWorking?: boolean;
  uiLanguage?: Language;
  limitNotice?: string;
  onAuthEmailChange: (email: string) => void;
  onAuthPasswordChange: (password: string) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onSave: () => void;
  onSignOut: () => void;
  onOpenRemote: (diagram: RemoteDiagramSummary) => void;
}

function formatRemoteMeta(diagram: RemoteDiagramSummary, uiLanguage: Language): string {
  const parts: string[] = [];
  if (typeof diagram.line_count === 'number') parts.push(tText(uiLanguage, 'account.lines', { count: diagram.line_count }));
  const dateValue = diagram.updated_at ?? diagram.created_at;
  if (dateValue) {
    const date = new Date(dateValue);
    if (!Number.isNaN(date.getTime())) parts.push(date.toLocaleDateString());
  }
  return parts.join(' / ');
}

export function AuthCloudPanel({
  isConfigured,
  userEmail,
  statusMessage,
  remoteDiagrams,
  authEmail,
  authPassword,
  isWorking = false,
  uiLanguage = 'en',
  limitNotice,
  onAuthEmailChange,
  onAuthPasswordChange,
  onSignIn,
  onSignUp,
  onSave,
  onSignOut,
  onOpenRemote,
}: AuthCloudPanelProps) {
  const signedIn = Boolean(userEmail);
  const authDisabled = !isConfigured || isWorking;
  const t = (key: string, vars?: Record<string, string | number>) => tText(uiLanguage, key, vars);

  return (
    <section className="iso-sidebar" style={{ borderTop: '1px solid var(--iso-divider)' }} aria-label={t('account.cloud')}>
      <div className="iso-panel-header" style={{ borderBottom: '1px solid var(--iso-divider)', padding: '0 12px' }}>
        <IconSave size={11} /> {t('account.cloud')}
      </div>
      <div className="iso-sidebar-body" style={{ gap: 8 }}>
        {!isConfigured && (
          <div className="iso-panel-info" style={{ marginLeft: 0 }}>
            {t('account.configure_supabase')}
          </div>
        )}

        {signedIn ? (
          <>
            <div className="iso-panel-info" style={{ marginLeft: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userEmail}
            </div>
            <button type="button" className="iso-btn iso-btn--primary" onClick={onSave} disabled={!isConfigured || isWorking}>
              {t('account.save_supabase')}
            </button>
            <button type="button" className="iso-btn" onClick={onSignOut} disabled={!isConfigured || isWorking}>
              {t('account.sign_out')}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {remoteDiagrams.length === 0 ? (
                <div className="iso-panel-info" style={{ marginLeft: 0 }}>{t('account.no_remote_files')}</div>
              ) : (
                remoteDiagrams.slice(0, 6).map(diagram => {
                  const meta = formatRemoteMeta(diagram, uiLanguage);
                  return (
                    <button
                      key={diagram.id}
                      type="button"
                      className="iso-stencil"
                      onClick={() => onOpenRemote(diagram)}
                      style={{ textAlign: 'left' }}
                    >
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{diagram.title}</span>
                      {meta && <span className="iso-panel-info" style={{ display: 'block', marginLeft: 0 }}>{meta}</span>}
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSignIn();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <input
              className="iso-select"
              type="email"
              value={authEmail}
              onChange={event => onAuthEmailChange(event.target.value)}
              placeholder={t('account.email')}
              aria-label={t('account.cloud_email')}
              disabled={authDisabled}
            />
            <input
              className="iso-select"
              type="password"
              value={authPassword}
              onChange={event => onAuthPasswordChange(event.target.value)}
              placeholder={t('account.password')}
              aria-label={t('account.cloud_password')}
              disabled={authDisabled}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button type="submit" className="iso-btn iso-btn--primary" disabled={authDisabled}>
                {t('account.sign_in')}
              </button>
              <button type="button" className="iso-btn" onClick={onSignUp} disabled={authDisabled}>
                {t('account.sign_up')}
              </button>
            </div>
          </form>
        )}

        {statusMessage && <div className="iso-panel-info" style={{ marginLeft: 0 }}>{statusMessage}</div>}
        {limitNotice && <div className="iso-panel-info" style={{ marginLeft: 0 }}>{limitNotice}</div>}
      </div>
    </section>
  );
}
