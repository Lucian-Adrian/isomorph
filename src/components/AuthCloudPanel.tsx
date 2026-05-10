import { IconSave } from './Icons.js';

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
  limitNotice?: string;
  onAuthEmailChange: (email: string) => void;
  onAuthPasswordChange: (password: string) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onSave: () => void;
  onSignOut: () => void;
  onOpenRemote: (diagram: RemoteDiagramSummary) => void;
}

function formatRemoteMeta(diagram: RemoteDiagramSummary): string {
  const parts: string[] = [];
  if (typeof diagram.line_count === 'number') parts.push(`${diagram.line_count} lines`);
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

  return (
    <section className="iso-sidebar" style={{ borderTop: '1px solid var(--iso-divider)' }} aria-label="Cloud">
      <div className="iso-panel-header" style={{ borderBottom: '1px solid var(--iso-divider)', padding: '0 12px' }}>
        <IconSave size={11} /> Cloud
      </div>
      <div className="iso-sidebar-body" style={{ gap: 8 }}>
        {!isConfigured && (
          <div className="iso-panel-info" style={{ marginLeft: 0 }}>
            Set Supabase env vars to enable cloud sync.
          </div>
        )}

        {signedIn ? (
          <>
            <div className="iso-panel-info" style={{ marginLeft: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userEmail}
            </div>
            <button type="button" className="iso-btn iso-btn--primary" onClick={onSave} disabled={!isConfigured || isWorking}>
              Save to Supabase
            </button>
            <button type="button" className="iso-btn" onClick={onSignOut} disabled={!isConfigured || isWorking}>
              Sign out
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {remoteDiagrams.length === 0 ? (
                <div className="iso-panel-info" style={{ marginLeft: 0 }}>No remote files yet.</div>
              ) : (
                remoteDiagrams.slice(0, 6).map(diagram => {
                  const meta = formatRemoteMeta(diagram);
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
          <>
            <input
              className="iso-select"
              type="email"
              value={authEmail}
              onChange={event => onAuthEmailChange(event.target.value)}
              placeholder="Email"
              aria-label="Cloud email"
              disabled={authDisabled}
            />
            <input
              className="iso-select"
              type="password"
              value={authPassword}
              onChange={event => onAuthPasswordChange(event.target.value)}
              placeholder="Password"
              aria-label="Cloud password"
              disabled={authDisabled}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button type="button" className="iso-btn iso-btn--primary" onClick={onSignIn} disabled={authDisabled}>
                Sign in
              </button>
              <button type="button" className="iso-btn" onClick={onSignUp} disabled={authDisabled}>
                Sign up
              </button>
            </div>
          </>
        )}

        {statusMessage && <div className="iso-panel-info" style={{ marginLeft: 0 }}>{statusMessage}</div>}
        {limitNotice && <div className="iso-panel-info" style={{ marginLeft: 0 }}>{limitNotice}</div>}
      </div>
    </section>
  );
}
