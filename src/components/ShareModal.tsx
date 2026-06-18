import { useState, useEffect, useCallback } from 'react';
import { createShareLink, getShareLinks, deleteShareLink, type ShareLink } from '../lib/share-links.js';
import { getProjectAccess, grantAccess, revokeAccess, type ProjectAccess } from '../lib/access-control.js';
import { tText, type Language } from '../i18n.js';
import { logAudit } from '../lib/audit.js';

interface ShareModalProps {
  projectId: string;
  diagramId?: string;
  diagramName?: string;
  onClose: () => void;
  onToast: (msg: string, type?: 'success' | 'info') => void;
  language?: Language;
}

export function ShareModal({ projectId, diagramId, diagramName, onClose, onToast, language = 'en' }: ShareModalProps) {
  const t = useCallback((key: string, vars?: Record<string, string | number>) => tText(language, key, vars), [language]);
  
  const [activeTab, setActiveTab] = useState<'links' | 'access'>('links');
  
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [access, setAccess] = useState<ProjectAccess[]>([]);
  
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'commenter' | 'viewer'>('viewer');
  const [inviteScope, setInviteScope] = useState<'project' | 'file'>('project');
  
  const [newLinkRole, setNewLinkRole] = useState<'editor' | 'commenter' | 'viewer'>('viewer');
  const [newLinkScope, setNewLinkScope] = useState<'project' | 'file'>('project');

  useEffect(() => {
    loadLinks();
    loadAccess();
  }, [projectId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function loadLinks() {
    setLoadingLinks(true);
    const data = await getShareLinks(projectId);
    setLinks(data);
    setLoadingLinks(false);
  }

  async function loadAccess() {
    setLoadingAccess(true);
    const data = await getProjectAccess(projectId);
    setAccess(data);
    setLoadingAccess(false);
  }

  async function handleCreateLink() {
    const link = await createShareLink(projectId, newLinkRole, newLinkScope === 'file' ? diagramId : null);
    if (link) {
      setLinks([link, ...links]);
      logAudit('share_link_created', 'share_link', link.id, { role: newLinkRole, scope: newLinkScope, projectId });
      onToast(t('share.success_link_created', { role: t(`share.${newLinkRole}`) }), 'success');
    }
  }

  async function handleDeleteLink(id: string) {
    const success = await deleteShareLink(id);
    if (success) {
      setLinks(links.filter(l => l.id !== id));
      logAudit('share_link_revoked', 'share_link', id, { projectId });
      onToast(t('share.success_link_revoked'), 'success');
    }
  }

  async function handleGrantAccess() {
    if (!inviteEmail.trim()) return;
    const success = await grantAccess(projectId, inviteEmail, inviteRole, inviteScope === 'file' ? diagramId : null);
    if (success) {
      setInviteEmail('');
      loadAccess();
      logAudit('access_granted', 'project', projectId, { email: inviteEmail, role: inviteRole, scope: inviteScope });
      onToast(t('share.success_access_granted'), 'success');
    } else {
      alert(t('share.error_user_not_found'));
    }
  }

  async function handleRevokeAccess(userId: string) {
    const success = await revokeAccess(projectId, userId);
    if (success) {
      setAccess(access.filter(a => a.user_id !== userId));
      logAudit('access_revoked', 'project', projectId, { revokedUserId: userId });
      onToast(t('share.success_access_revoked'), 'success');
    }
  }

  function copyToClipboard(token: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('share', token);
    navigator.clipboard.writeText(url.toString());
    onToast(t('share.link_copied_clipboard'), 'success');
  }

  return (
    <div className="iso-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="iso-modal iso-modal-large" onClick={e => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="iso-modal-sidebar">
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--iso-text)' }}>
            {t('share.share_project')}
          </h2>
          <button
            className={`iso-modal-sidebar-tab ${activeTab === 'links' ? 'active' : ''}`}
            onClick={() => setActiveTab('links')}
          >
            {t('share.share_links')}
          </button>
          <button
            className={`iso-modal-sidebar-tab ${activeTab === 'access' ? 'active' : ''}`}
            onClick={() => setActiveTab('access')}
          >
            {t('share.direct_access')}
          </button>
        </div>

        {/* Content Area */}
        <div className="iso-modal-content" style={{ position: 'relative', overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}>
          <button className="iso-modal-close-btn" style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }} onClick={onClose} aria-label={t('ui.close')}>×</button>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
            {activeTab === 'links' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select 
                    value={newLinkScope}
                    onChange={e => setNewLinkScope(e.target.value as any)}
                    className="iso-input"
                    style={{ width: '160px', height: '36px', padding: '8px' }}
                  >
                    <option value="project">{t('share.entire_project')}</option>
                    {diagramId && <option value="file">{t('share.current_file_only')} ({diagramName || t('share.file')})</option>}
                  </select>
                  <select 
                    value={newLinkRole}
                    onChange={e => setNewLinkRole(e.target.value as any)}
                    className="iso-input"
                    style={{ width: '130px', height: '36px', padding: '8px' }}
                  >
                    <option value="viewer">{t('share.viewer')}</option>
                    <option value="commenter">{t('share.commenter')}</option>
                    <option value="editor">{t('share.editor')}</option>
                  </select>
                  <button
                    onClick={handleCreateLink}
                    className="iso-btn iso-btn--primary"
                    style={{ height: '36px', padding: '0 16px', borderRadius: 'var(--iso-radius)' }}
                  >
                    {t('share.create_link')}
                  </button>
                </div>

                {loadingLinks ? (
                  <div style={{ textAlign: 'center', color: 'var(--iso-text-muted)', padding: '20px' }}>{t('share.loading')}...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {links.map(link => (
                      <div key={link.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--iso-bg-app)', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius)' }}>
                        <div>
                          <div style={{ color: 'var(--iso-text)', fontWeight: 500, textTransform: 'capitalize', fontSize: '13px' }}>
                            {t(`share.${link.role}`)} {t('share.link')} {link.diagram_id ? `(${t('share.file')})` : `(${t('share.project')})`}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--iso-text-muted)', marginTop: '4px' }}>
                            {t('share.created')} {new Date(link.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => copyToClipboard(link.token)}
                            className="iso-btn"
                            style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--iso-border)', background: 'var(--iso-bg-panel)' }}
                          >
                            {t('share.copy')}
                          </button>
                          <button
                            onClick={() => handleDeleteLink(link.id)}
                            className="iso-btn"
                            style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--iso-error)', borderColor: 'rgba(255, 95, 87, 0.2)', background: 'var(--iso-bg-panel)' }}
                          >
                            {t('share.revoke')}
                          </button>
                        </div>
                      </div>
                    ))}
                    {links.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--iso-text-muted)', fontSize: '13px' }}>
                        {t('share.no_share_links_active')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder={t('share.username_or_email')}
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation(); }}
                    onKeyUp={e => { if (e.key !== 'Escape') e.stopPropagation(); }}
                    onKeyPress={e => { if (e.key !== 'Escape') e.stopPropagation(); }}
                    className="iso-input"
                    style={{ flex: 1, minWidth: '150px', height: '36px' }}
                  />
                  <select 
                    value={inviteScope}
                    onChange={e => setInviteScope(e.target.value as any)}
                    className="iso-input"
                    style={{ width: '160px', height: '36px', padding: '8px' }}
                  >
                    <option value="project">{t('share.entire_project')}</option>
                    {diagramId && <option value="file">{t('share.current_file_only')} ({diagramName || t('share.file')})</option>}
                  </select>
                  <select 
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as any)}
                    className="iso-input"
                    style={{ width: '130px', height: '36px', padding: '8px' }}
                  >
                    <option value="viewer">{t('share.viewer')}</option>
                    <option value="commenter">{t('share.commenter')}</option>
                    <option value="editor">{t('share.editor')}</option>
                  </select>
                  <button
                    onClick={handleGrantAccess}
                    className="iso-btn iso-btn--primary"
                    style={{ height: '36px', padding: '0 16px', borderRadius: 'var(--iso-radius)' }}
                  >
                    {t('share.invite')}
                  </button>
                </div>

                {loadingAccess ? (
                  <div style={{ textAlign: 'center', color: 'var(--iso-text-muted)', padding: '20px' }}>{t('share.loading')}...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {access.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--iso-bg-app)', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--iso-border)', overflow: 'hidden', flexShrink: 0 }}>
                            {a.profile?.avatar_url ? (
                              <img src={a.profile.avatar_url} alt={a.profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--iso-text-muted)', fontSize: '12px', fontWeight: 500, textTransform: 'uppercase' }}>
                                {a.profile?.username?.[0] || '?'}
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ color: 'var(--iso-text)', fontWeight: 500, fontSize: '13px' }}>{a.profile?.full_name || a.profile?.username}</div>
                            <div style={{ fontSize: '11px', color: 'var(--iso-text-muted)', marginTop: '2px', textTransform: 'capitalize' }}>
                              {t(`share.${a.role}`)} {a.diagram_id ? `(${t('share.file')})` : `(${t('share.project')})`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevokeAccess(a.user_id)}
                          className="iso-btn"
                          style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--iso-error)', borderColor: 'rgba(255, 95, 87, 0.2)', background: 'var(--iso-bg-panel)' }}
                          title="Remove Access"
                        >
                          {t('share.remove')}
                        </button>
                      </div>
                    ))}
                    {access.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--iso-text-muted)', fontSize: '13px' }}>
                        {t('share.no_direct_access_granted')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
