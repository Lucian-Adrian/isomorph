import { useState, useEffect } from 'react';
import { isSoundEnabled, setSoundEnabled, getSoundVolume, setSoundVolume, sound } from '../lib/sound.js';
import { type Language, LANGUAGE_OPTIONS } from '../i18n.js';
import { type Project } from '../lib/projects.js';
import { IconSun, IconMoon } from './Icons.js';

interface SettingsModalProps {
  onClose: () => void;
  session: any;
  user: any;
  profile: any;
  setProfile: (profile: any) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  isUMLCompliant: boolean;
  setIsUMLCompliant: (val: boolean) => void;
  isWatermarkEnabled: boolean;
  setIsWatermarkEnabled: (val: boolean) => void;
  isAnimationsEnabled: boolean;
  setIsAnimationsEnabled: (val: boolean) => void;
  setIsAnimating: (val: boolean) => void;
  telemetry: boolean;
  setTelemetry: (val: boolean) => void;
  setTelemetryEnabled: (val: boolean) => void;
  animationSpeed: number;
  setAnimationSpeed: (val: number) => void;
  themeMode: 'light' | 'dark';
  setThemeMode: (mode: 'light' | 'dark') => void;
  collabShowTrail: boolean;
  setCollabShowTrail: (val: boolean) => void;
  collabShowNameLabel: boolean;
  setCollabShowNameLabel: (val: boolean) => void;
  autoSaveInterval: number;
  setAutoSaveInterval: (val: number) => void;
  addToast: (message: string, type?: 'success' | 'info') => void;
  handleSignOut: () => Promise<void>;
  setAuthMode: (mode: 'login' | 'register') => void;
  setIsAuthOpen: (open: boolean) => void;
  projects: Project[];
  autoSaveProfile: (updates: { full_name?: string | null; username?: string | null; avatar_url?: string | null; settings?: any }) => Promise<void>;
  autoSaveSettings: (settingsUpdates: any) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export function SettingsModal({
  onClose,
  session,
  user,
  profile,
  setProfile,
  language,
  setLanguage,
  isUMLCompliant,
  setIsUMLCompliant,
  isWatermarkEnabled,
  setIsWatermarkEnabled,
  isAnimationsEnabled,
  setIsAnimationsEnabled,
  setIsAnimating,
  telemetry,
  setTelemetry,
  setTelemetryEnabled,
  animationSpeed,
  setAnimationSpeed,
  themeMode,
  setThemeMode,
  collabShowTrail,
  setCollabShowTrail,
  collabShowNameLabel,
  setCollabShowNameLabel,
  autoSaveInterval,
  setAutoSaveInterval,
  addToast,
  handleSignOut,
  setAuthMode,
  setIsAuthOpen,
  projects,
  autoSaveProfile,
  autoSaveSettings,
  t
}: SettingsModalProps) {
  const [settingsTab, setSettingsTab] = useState<'profile' | 'collab' | 'storage' | 'app'>('profile');
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState<boolean>(() => isSoundEnabled());
  const [soundVolumeLevel, setSoundVolumeLevel] = useState<number>(() => Math.round(getSoundVolume() * 100));

  useEffect(() => {
    sound.modalOpen();
  }, []);
  const [newPassword, setNewPassword] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0);

  const handleResetPassword = async (pass: string) => {
    if (!pass || pass.length < 6) {
      addToast('Password must be at least 6 characters long', 'info');
      return;
    }
    const { supabase } = await import('../lib/supabase.js');
    const { error } = await supabase.auth.updateUser({ password: pass });
    if (error) {
      addToast(error.message, 'info');
    } else {
      setNewPassword('');
      addToast('Password updated successfully');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    const { logAudit } = await import('../lib/audit.js');
    await logAudit('account_deleted');

    const { supabase } = await import('../lib/supabase.js');
    const { error } = await supabase.rpc('delete_user');
    if (error) {
      console.warn('RPC delete failed, falling back to profile row delete:', error);
      const { error: deleteError } = await supabase.from('profiles').delete().eq('id', user.id);
      if (deleteError) {
        addToast('Failed to delete account', 'info');
        return;
      }
    }
    await handleSignOut();
    setIsDeleteModalOpen(false);
    setDeleteStep(0);
    addToast('Account deleted successfully');
    onClose();
  };

  return (
    <>
      <div className="iso-modal-overlay" onClick={onClose}>
        <div className="iso-modal iso-modal-large" onClick={e => e.stopPropagation()}>
          <div className="iso-modal-sidebar">
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--iso-text)' }}>{t('ui.settings')}</h2>
            <button className={`iso-modal-sidebar-tab ${settingsTab === 'profile' ? 'active' : ''}`} onClick={() => setSettingsTab('profile')}>{t('ui.profile')}</button>
            <button className={`iso-modal-sidebar-tab ${settingsTab === 'collab' ? 'active' : ''}`} onClick={() => setSettingsTab('collab')}>{t('ui.collab_settings')}</button>
            <button className={`iso-modal-sidebar-tab ${settingsTab === 'storage' ? 'active' : ''}`} onClick={() => setSettingsTab('storage')}>{t('ui.storage')}</button>
            <button className={`iso-modal-sidebar-tab ${settingsTab === 'app' ? 'active' : ''}`} onClick={() => setSettingsTab('app')}>{t('ui.app_settings')}</button>
          </div>
          <div className="iso-modal-content" style={{ position: 'relative', overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}>
            <button className="iso-modal-close-btn" style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }} onClick={onClose}>×</button>
            <div style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>

              {settingsTab === 'profile' && (
                <div>
                  <h3 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: 700, color: 'var(--iso-text)' }}>{t('ui.profile')}</h3>
                  {session ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                      
                      {/* Section 1: Personal Info */}
                      <div className="iso-settings-section">
                        <div className="iso-settings-section-title">Personal information</div>
                        <div className="iso-settings-grid" style={{ gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
                          {/* Profile Photo Card */}
                          <div className="iso-settings-card" style={{ display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'center', justifyContent: 'flex-start' }}>
                            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--iso-divider)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--iso-border-strong)', flexShrink: 0 }}>
                              {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--iso-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, alignItems: 'flex-start' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <div className="iso-settings-label" style={{ marginBottom: '2px' }}>{t('ui.profile_photo')}</div>
                                <div className="iso-settings-desc">Upload a custom profile photo. Supports JPG, PNG, and GIF.</div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  className="iso-btn"
                                  style={{ padding: '4px 12px', fontSize: '12px' }}
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = async (e: any) => {
                                      const file = e.target.files?.[0];
                                      if (file && user) {
                                        addToast('Uploading photo...', 'info');
                                        const { uploadAvatar } = await import('../lib/profile.js');
                                        const url = await uploadAvatar(user.id, file);
                                        if (url && profile) {
                                          const updated = { ...profile, avatar_url: url };
                                          setProfile(updated);
                                          await autoSaveProfile({ avatar_url: url });
                                          addToast('Photo uploaded successfully');
                                        }
                                      }
                                    };
                                    input.click();
                                  }}
                                >
                                  Upload photo
                                </button>
                                {profile?.avatar_url && (
                                  <button
                                    className="iso-btn"
                                    style={{ padding: '4px 12px', fontSize: '12px', color: 'var(--iso-danger)', borderColor: 'var(--iso-danger)' }}
                                    onClick={async () => {
                                      if (profile && user) {
                                        const { updateProfile } = await import('../lib/profile.js');
                                        await updateProfile(user.id, { avatar_url: null });
                                        const updated = { ...profile, avatar_url: null };
                                        setProfile(updated);
                                        await autoSaveProfile({ avatar_url: null });
                                        addToast('Photo removed');
                                      }
                                    }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="iso-settings-grid">
                          
                          {/* Display Name Card */}
                          <div className="iso-settings-card">
                            <div className="iso-settings-info">
                              <div className="iso-settings-label">Display name</div>
                              <div className="iso-settings-desc">What name should we display in comments and live previews?</div>
                            </div>
                            <div className="iso-settings-control" style={{ width: '100%', marginTop: '8px' }}>
                              <input
                                type="text"
                                value={profile?.full_name || ''}
                                onChange={e => setProfile(profile ? { ...profile, full_name: e.target.value } : null)}
                                onBlur={e => autoSaveProfile({ full_name: e.target.value })}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    autoSaveProfile({ full_name: (e.target as HTMLInputElement).value });
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="iso-input"
                                style={{ width: '100%' }}
                              />
                            </div>
                          </div>

                          {/* Username Card */}
                          <div className="iso-settings-card">
                            <div className="iso-settings-info">
                              <div className="iso-settings-label">Username</div>
                              <div className="iso-settings-desc">Your unique identifier used for mentions and project mapping.</div>
                            </div>
                            <div className="iso-settings-control" style={{ width: '100%', marginTop: '8px' }}>
                              <input
                                type="text"
                                value={profile?.username || ''}
                                onChange={e => setProfile(profile ? { ...profile, username: e.target.value } : null)}
                                onBlur={e => autoSaveProfile({ username: e.target.value })}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    autoSaveProfile({ username: (e.target as HTMLInputElement).value });
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="iso-input"
                                style={{ width: '100%' }}
                              />
                            </div>
                          </div>

                          {/* Email Address Card */}
                          <div className="iso-settings-card" style={{ gridColumn: 'span 2' }}>
                            <div className="iso-settings-info">
                              <div className="iso-settings-label">Email address</div>
                              <div className="iso-settings-desc">Your verified account email address. Managed via authentication settings.</div>
                            </div>
                            <div className="iso-settings-control" style={{ width: '100%', marginTop: '8px' }}>
                              <input
                                type="email"
                                value={user?.email || ''}
                                disabled
                                className="iso-input"
                                style={{ opacity: 0.6, cursor: 'not-allowed', width: '100%' }}
                              />
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Section 2: Account Status & Actions */}
                      <div className="iso-settings-section">
                        <div className="iso-settings-section-title">Account actions</div>
                        <div className="iso-settings-grid" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
                          {/* Reset Password Card */}
                          <div className="iso-settings-card iso-settings-card-horizontal">
                            <div className="iso-settings-info">
                              <div className="iso-settings-label">Update password</div>
                              <div className="iso-settings-desc">Choose a new, secure password for your account.</div>
                            </div>
                            <div className="iso-settings-control" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="password"
                                placeholder="New password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="iso-input"
                                style={{ width: '180px' }}
                              />
                              <button className="iso-btn" onClick={() => handleResetPassword(newPassword)}>
                                Update
                              </button>
                            </div>
                          </div>

                          {/* Sign Out Card */}
                          <div className="iso-settings-card iso-settings-card-horizontal">
                            <div className="iso-settings-info">
                              <div className="iso-settings-label">Sign out</div>
                              <div className="iso-settings-desc">Log out of your session on this browser.</div>
                            </div>
                            <div className="iso-settings-control">
                              <button className="iso-btn" onClick={handleSignOut}>
                                Sign out
                              </button>
                            </div>
                          </div>

                          {/* Delete Account Card */}
                          <div className="iso-settings-card iso-settings-card-horizontal" style={{ borderColor: 'rgba(255, 95, 87, 0.2)', background: 'rgba(255, 95, 87, 0.02)' }}>
                            <div className="iso-settings-info">
                              <div className="iso-settings-label" style={{ color: 'var(--iso-danger)' }}>Delete account</div>
                              <div className="iso-settings-desc">Permanently erase your account, all projects, and custom diagrams.</div>
                            </div>
                            <div className="iso-settings-control">
                              <button 
                                className="iso-btn" 
                                style={{ color: 'var(--iso-danger)', borderColor: 'var(--iso-danger)' }} 
                                onClick={() => {
                                  setDeleteStep(0);
                                  setIsDeleteModalOpen(true);
                                }}
                              >
                                Delete account
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
                      <p style={{ color: 'var(--iso-text-muted)' }}>You are not logged in.</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="iso-btn iso-btn--primary" onClick={() => { setAuthMode('login'); setIsAuthOpen(true); onClose(); }}>{t('ui.login')}</button>
                        <button className="iso-btn" onClick={() => { setAuthMode('register'); setIsAuthOpen(true); onClose(); }}>{t('auth.title_register')}</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {settingsTab === 'collab' && (
                <div>
                  <h3 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: 700, color: 'var(--iso-text)' }}>{t('ui.collab_settings')}</h3>
                  {!session ? (
                    <p style={{ color: 'var(--iso-text-muted)' }}>{t('ui.collab_login_needed')}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                      
                      {/* Section 1: Live Cursor Options */}
                      <div className="iso-settings-section">
                        <div className="iso-settings-section-title">Live cursor options</div>
                        <div className="iso-settings-grid">
                          
                          {/* Cursor Color Card */}
                          <div className="iso-settings-card">
                            <div className="iso-settings-info">
                              <div className="iso-settings-label">Cursor color</div>
                              <div className="iso-settings-desc">Choose a custom color that represents your cursor on shared canvas boards.</div>
                            </div>
                            <div className="iso-settings-control" style={{ flexDirection: 'column', gap: '16px', width: '100%', marginTop: '8px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                {['#EF4444', '#22C55E', '#3B82F6', '#EAB308', '#EC4899', '#F97316', '#F8FAFC', '#1E293B'].map(color => (
                                  <button
                                    key={color}
                                    onClick={() => {
                                      setProfile({ ...profile, settings: { ...(profile.settings || {}), cursor_colour: color } });
                                      autoSaveSettings({ cursor_colour: color });
                                    }}
                                    style={{
                                      width: '32px', height: '32px', borderRadius: '50%', background: color,
                                      border: profile?.settings?.cursor_colour === color ? '2px solid var(--iso-bg-app)' : '2px solid transparent',
                                      boxShadow: profile?.settings?.cursor_colour === color ? `0 0 0 2px ${color}` : (color === '#F8FAFC' ? '0 0 0 1px #E2E8F0' : '0 0 0 1px var(--iso-border)'),
                                      outline: 'none',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                    aria-label={`Select color ${color}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Cursor Preview Card */}
                          <div className="iso-settings-card">
                            <div className="iso-settings-info">
                              <div className="iso-settings-label">Live preview</div>
                              <div className="iso-settings-desc">How other developers will see your active cursor live.</div>
                            </div>
                            <div className="iso-settings-control" style={{ width: '100%', height: '80px', background: 'var(--iso-bg-canvas)', borderRadius: '8px', border: '1px solid var(--iso-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
                                  <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.84c.45 0 .67-.54.35-.85L5.5 3.21z" fill={profile?.settings?.cursor_colour || '#3B82F6'} stroke={profile?.settings?.cursor_colour === '#F8FAFC' ? '#CBD5E1' : 'white'} strokeWidth="1.5" />
                                </svg>
                                {collabShowNameLabel && (
                                  <div style={{
                                    background: profile?.settings?.cursor_colour || '#3B82F6',
                                    color: profile?.settings?.cursor_colour === '#F8FAFC' ? '#1E293B' : 'white',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    marginTop: '4px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                  }}>
                                    {profile?.full_name || profile?.username || 'You'}
                                  </div>
                                )}
                              </div>
                              {collabShowTrail && (
                                <>
                                  <div className="iso-particle-trail" style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: profile?.settings?.cursor_colour || '#3B82F6', opacity: 0.5, transform: 'translate(-12px, 12px)', zIndex: 1 }} />
                                  <div className="iso-particle-trail" style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: profile?.settings?.cursor_colour || '#3B82F6', opacity: 0.3, transform: 'translate(-20px, 20px)', zIndex: 1 }} />
                                  <div className="iso-particle-trail" style={{ position: 'absolute', width: 4, height: 4, borderRadius: '50%', background: profile?.settings?.cursor_colour || '#3B82F6', opacity: 0.15, transform: 'translate(-26px, 26px)', zIndex: 1 }} />
                                </>
                              )}
                            </div>
                          </div>

                          {/* Show Name Label Card */}
                          <div className="iso-settings-card iso-settings-card-horizontal">
                            <div className="iso-settings-info">
                              <div className="iso-settings-label">Display name label</div>
                              <div className="iso-settings-desc">Show your name badge alongside your live cursor indicator to others.</div>
                            </div>
                            <div className="iso-settings-control">
                              <label className="iso-switch">
                                <input 
                                  type="checkbox" 
                                  checked={collabShowNameLabel} 
                                  onChange={e => {
                                    const next = e.target.checked;
                                    setCollabShowNameLabel(next);
                                    autoSaveSettings({ show_name_label: next });
                                  }} 
                                />
                                <span className="iso-switch-slider"></span>
                              </label>
                            </div>
                          </div>

                          {/* Cursor Trail Card */}
                          <div className="iso-settings-card iso-settings-card-horizontal">
                            <div className="iso-settings-info">
                              <div className="iso-settings-label">Cursor particle trails</div>
                              <div className="iso-settings-desc">Draw a subtle particle trail behind your cursor when in active motion.</div>
                            </div>
                            <div className="iso-settings-control">
                              <label className="iso-switch">
                                <input 
                                  type="checkbox" 
                                  checked={collabShowTrail} 
                                  onChange={e => {
                                    const next = e.target.checked;
                                    setCollabShowTrail(next);
                                    autoSaveSettings({ show_trail: next });
                                  }} 
                                />
                                <span className="iso-switch-slider"></span>
                              </label>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Section 2: Future Collaboration Features */}
                      <div className="iso-settings-section">
                        <div className="iso-settings-section-title">Collaboration status</div>
                        <div className="iso-settings-grid">
                          <div className="iso-settings-card">
                            <div className="iso-settings-info">
                              <div className="iso-settings-label">Multiplayer canvas</div>
                              <div className="iso-settings-desc">{t('ui.collab_future')}</div>
                            </div>
                            <div className="iso-settings-control" style={{ marginTop: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--iso-brand)', background: 'var(--iso-bg-active)', padding: '4px 8px', borderRadius: '12px', fontWeight: 600 }}>Coming soon</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}

              {settingsTab === 'storage' && (
                <div>
                  <h3 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: 700, color: 'var(--iso-text)' }}>{t('ui.storage')}</h3>
                  {!session ? (
                    <p style={{ color: 'var(--iso-text-muted)' }}>{t('ui.storage_login_needed')}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                      
                      {/* Section 1: Resource Usage */}
                      <div className="iso-settings-section">
                        <div className="iso-settings-section-title">Resource usage</div>
                        <div className="iso-settings-grid">
                          
                          {/* Subscription Tier Card */}
                          <div className="iso-settings-card">
                            <div className="iso-settings-info">
                              <div className="iso-settings-label">Subscription tier</div>
                              <div className="iso-settings-desc">Your active user plan. Multi-device cloud backup limits apply.</div>
                            </div>
                            <div className="iso-settings-control" style={{ marginTop: '8px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--iso-brand)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {profile?.tier || 'Basic'}
                              </span>
                            </div>
                          </div>

                          {/* Projects Limit Card */}
                          <div className="iso-settings-card">
                            <div className="iso-settings-info">
                              <div className="iso-settings-label">Cloud projects usage</div>
                              <div className="iso-settings-desc">Percentage of your workspace allowance stored in the cloud.</div>
                            </div>
                            <div className="iso-settings-control" style={{ flexDirection: 'column', width: '100%', gap: '8px', marginTop: '12px' }}>
                              {(() => {
                                const maxLimit = profile?.tier === 'enterprise' ? 100 : profile?.tier === 'power' ? 25 : 5;
                                const count = projects.length;
                                const ratio = count / maxLimit;
                                let color = 'var(--iso-brand)';
                                if (ratio >= 0.9) color = 'var(--iso-error)';
                                else if (ratio >= 0.75) color = 'var(--iso-warning)';
                                return (
                                  <>
                                    <div style={{ display: 'flex', gap: '4px', width: '100%', height: '8px' }}>
                                      {Array.from({ length: maxLimit }).map((_, i) => (
                                        <div key={i} style={{ flex: 1, background: i < count ? color : 'var(--iso-divider)', borderRadius: '4px', transition: 'background 0.3s ease' }} />
                                      ))}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '12px', color: 'var(--iso-text-muted)' }}>
                                      <span>{count} created</span>
                                      <span>{maxLimit} max projects</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Section 2: Storage Tiers & Billing */}
                      <div className="iso-settings-section">
                        <div className="iso-settings-section-title">Upgrade plan</div>
                        <div className="iso-settings-grid">
                          
                          {/* Plans Card */}
                          <div className="iso-settings-card" style={{ gridColumn: 'span 2' }}>
                            <div className="iso-settings-info" style={{ marginBottom: '12px' }}>
                              <div className="iso-settings-label">Available subscriptions</div>
                              <div className="iso-settings-desc">{t('ui.storage_future')} Upgrade to scale your projects.</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', width: '100%' }}>
                              <div style={{ background: 'var(--iso-bg-app)', border: '1px solid var(--iso-border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <strong style={{ fontSize: '14px', color: 'var(--iso-text)' }}>Basic (Free)</strong>
                                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--iso-text)' }}>$0 <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--iso-text-muted)' }}>/ month</span></span>
                                <span style={{ fontSize: '12px', color: 'var(--iso-text-muted)' }}>Ideal for starting out. Up to 5 projects stored securely in the cloud.</span>
                              </div>
                              <div style={{ background: 'var(--iso-bg-active)', border: '1px solid var(--iso-brand)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', transform: 'scale(1.02)' }}>
                                <strong style={{ fontSize: '14px', color: 'var(--iso-text)' }}>Power plan</strong>
                                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--iso-brand)' }}>$5 <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--iso-text-muted)' }}>/ month</span></span>
                                <span style={{ fontSize: '12px', color: 'var(--iso-text-muted)' }}>For power users. Up to 25 projects and advanced sharing options.</span>
                              </div>
                              <div style={{ background: 'var(--iso-bg-app)', border: '1px solid var(--iso-border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <strong style={{ fontSize: '14px', color: 'var(--iso-text)' }}>Enterprise</strong>
                                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--iso-text)' }}>Custom <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--iso-text-muted)' }}>pricing</span></span>
                                <span style={{ fontSize: '12px', color: 'var(--iso-text-muted)' }}>For large teams. Up to 100+ projects and enterprise SSO authentication.</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '16px' }}>
                              <button className="iso-btn iso-btn--primary" onClick={() => window.open('https://isomorph.ro/pricing', '_blank')}>
                                View detailed plans
                              </button>
                            </div>
                          </div>

                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}

              {settingsTab === 'app' && (
                <div>
                  <h3 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: 700, color: 'var(--iso-text)' }}>{t('ui.app_settings')}</h3>
                  
                  {/* Section 1: Appearance & Interface */}
                  <div className="iso-settings-section">
                    <div className="iso-settings-section-title">Appearance & interface</div>
                    <div className="iso-settings-grid">
                      
                      {/* Theme Card */}
                      <div className="iso-settings-card">
                        <div className="iso-settings-info">
                          <div className="iso-settings-label">{t('ui.theme')}</div>
                          <div className="iso-settings-desc">Choose between a light theme or dark theme for the editor and panels.</div>
                        </div>
                        <div className="iso-settings-control">
                          <div className="iso-theme-options">
                            <button
                              type="button"
                              className={`iso-theme-option-card ${themeMode === 'light' ? 'active' : ''}`}
                              onClick={() => {
                                setThemeMode('light');
                                document.documentElement.setAttribute('data-theme', 'light');
                                localStorage.setItem('isomorph-theme', 'light');
                                autoSaveSettings({ theme: 'light' });
                              }}
                            >
                              <IconSun size={16} />
                              <span>{t('ui.light_mode')}</span>
                            </button>
                            <button
                              type="button"
                              className={`iso-theme-option-card ${themeMode === 'dark' ? 'active' : ''}`}
                              onClick={() => {
                                setThemeMode('dark');
                                document.documentElement.setAttribute('data-theme', 'dark');
                                localStorage.setItem('isomorph-theme', 'dark');
                                autoSaveSettings({ theme: 'dark' });
                              }}
                            >
                              <IconMoon size={16} />
                              <span>{t('ui.dark_mode')}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Language Card */}
                      <div className="iso-settings-card">
                        <div className="iso-settings-info">
                          <div className="iso-settings-label">{t('ui.language')}</div>
                          <div className="iso-settings-desc">Set the translation for menus, stencils, and error messages.</div>
                        </div>
                        <div className="iso-settings-control">
                          <select
                            className="iso-select"
                            value={language}
                            onChange={e => {
                              const next = e.target.value as Language;
                              setLanguage(next);
                              autoSaveSettings({ language: next });
                            }}
                            style={{ width: '100%' }}
                          >
                            {LANGUAGE_OPTIONS.map(option => (
                              <option key={option.code} value={option.code}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Sound Effects Card */}
                      <div className="iso-settings-card">
                        <div className="iso-settings-info">
                          <div className="iso-settings-label">Sound effects</div>
                          <div className="iso-settings-desc">Play tactile audio feedback on clicks, toggles, and actions.</div>
                        </div>
                        <div className="iso-settings-control">
                          <label className="iso-toggle">
                            <input
                              type="checkbox"
                              checked={soundEffectsEnabled}
                              onChange={e => {
                                const next = e.target.checked;
                                setSoundEffectsEnabled(next);
                                setSoundEnabled(next);
                                sound.toggle(next);
                              }}
                            />
                            <span className="iso-toggle-slider" />
                          </label>
                        </div>
                      </div>

                      {/* Sound Volume Card */}
                      {soundEffectsEnabled && (
                        <div className="iso-settings-card">
                          <div className="iso-settings-info">
                            <div className="iso-settings-label">Sound volume ({soundVolumeLevel}%)</div>
                            <div className="iso-settings-desc">Adjust the volume level of interface audio effects.</div>
                          </div>
                          <div className="iso-settings-control" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={soundVolumeLevel}
                              onChange={e => {
                                const val = parseInt(e.target.value, 10);
                                setSoundVolumeLevel(val);
                                setSoundVolume(val / 100);
                              }}
                              style={{ width: '120px' }}
                            />
                            <button
                              type="button"
                              className="iso-btn"
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                              onClick={() => sound.button()}
                            >
                              Test sound
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Section 2: Editor & Workspace */}
                  <div className="iso-settings-section">
                    <div className="iso-settings-section-title">Editor & workspace</div>
                    <div className="iso-settings-grid">

                      {/* Strict UML Card */}
                      <div className="iso-settings-card iso-settings-card-horizontal">
                        <div className="iso-settings-info">
                          <div className="iso-settings-label">{t('ui.strict_uml')}</div>
                          <div className="iso-settings-desc">{t('ui.strict_uml_desc')}</div>
                        </div>
                        <div className="iso-settings-control">
                          <label className="iso-switch">
                            <input
                              type="checkbox"
                              checked={isUMLCompliant}
                              onChange={e => {
                                const next = e.target.checked;
                                setIsUMLCompliant(next);
                                localStorage.setItem('isomorph-strict-uml', String(next));
                                autoSaveSettings({ strict_uml: next });
                              }}
                            />
                            <span className="iso-switch-slider"></span>
                          </label>
                        </div>
                      </div>

                      {/* Auto Save Card */}
                      {session && (
                        <div className="iso-settings-card">
                          <div className="iso-settings-info">
                            <div className="iso-settings-label">Auto save</div>
                            <div className="iso-settings-desc">Configure the interval for automatically saving changes to the cloud.</div>
                          </div>
                          <div className="iso-settings-control" style={{ width: '100%' }}>
                            <div className="iso-settings-slider-wrap">
                              <div className="iso-settings-slider-header">
                                <span style={{ fontSize: '12px', color: 'var(--iso-text-muted)' }}>Interval</span>
                                <span className="iso-settings-slider-value">
                                  {autoSaveInterval === 0 ? 'Never' : (autoSaveInterval === 0.5 ? '30 seconds' : `${autoSaveInterval} min`)}
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0" max="5" step="0.5"
                                value={autoSaveInterval}
                                className="iso-settings-slider"
                                onChange={e => {
                                  const val = parseFloat(e.target.value);
                                  setAutoSaveInterval(val);
                                  localStorage.setItem('isomorph-autosave', String(val));
                                  autoSaveSettings({ auto_save: val });
                                }}
                              />
                              <div className="iso-settings-slider-labels">
                                <span>Never</span>
                                <span>5 min</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Section 3: Visuals & Export */}
                  <div className="iso-settings-section">
                    <div className="iso-settings-section-title">Visuals & exports</div>
                    <div className="iso-settings-grid">

                      {/* Output Watermark Card */}
                      <div className="iso-settings-card iso-settings-card-horizontal">
                        <div className="iso-settings-info">
                          <div className="iso-settings-label">Output watermark</div>
                          <div className="iso-settings-desc">{t('ui.watermark')}</div>
                        </div>
                        <div className="iso-settings-control">
                          <label className="iso-switch">
                            <input
                              type="checkbox"
                              checked={isWatermarkEnabled}
                              onChange={e => {
                                const next = e.target.checked;
                                setIsWatermarkEnabled(next);
                                localStorage.setItem('isomorph-watermark', String(next));
                                autoSaveSettings({ watermark: next });
                              }}
                            />
                            <span className="iso-switch-slider"></span>
                          </label>
                        </div>
                      </div>

                      {/* Enable Animations Card */}
                      <div className="iso-settings-card iso-settings-card-horizontal">
                        <div className="iso-settings-info">
                          <div className="iso-settings-label">{t('ui.enable_animations')}</div>
                          <div className="iso-settings-desc">Animate transitions and steps in sequence diagrams.</div>
                        </div>
                        <div className="iso-settings-control">
                          <label className="iso-switch">
                            <input
                              type="checkbox"
                              checked={isAnimationsEnabled}
                              onChange={e => {
                                const next = e.target.checked;
                                setIsAnimationsEnabled(next);
                                if (!next) setIsAnimating(false);
                                localStorage.setItem('isomorph-animations', String(next));
                                autoSaveSettings({ animations: next });
                              }}
                            />
                            <span className="iso-switch-slider"></span>
                          </label>
                        </div>
                      </div>

                      {/* Animation Speed Card */}
                      <div className="iso-settings-card">
                        <div className="iso-settings-info">
                          <div className="iso-settings-label">{t('ui.export_speed')}</div>
                          <div className="iso-settings-desc">Choose the playback rate for diagram animations.</div>
                        </div>
                        <div className="iso-settings-control">
                          <select
                            className="iso-select"
                            value={animationSpeed}
                            disabled={!isAnimationsEnabled}
                            onChange={e => {
                              const speed = parseFloat(e.target.value);
                              setAnimationSpeed(speed);
                              localStorage.setItem('isomorph-anim-speed', String(speed));
                              autoSaveSettings({ anim_speed: speed });
                            }}
                            style={{ width: '100%' }}
                          >
                            <option value={0.5}>0.5x</option>
                            <option value={1.0}>1.0x</option>
                            <option value={1.5}>1.5x</option>
                            <option value={2.0}>2.0x</option>
                          </select>
                        </div>
                      </div>

                      {/* Anonymous Telemetry Card */}
                      <div className="iso-settings-card iso-settings-card-horizontal">
                        <div className="iso-settings-info">
                          <div className="iso-settings-label">Anonymous telemetry</div>
                          <div className="iso-settings-desc">Send anonymous telemetry data to help improve Isomorph.</div>
                        </div>
                        <div className="iso-settings-control">
                          <label className="iso-switch">
                            <input
                              type="checkbox"
                              checked={telemetry}
                              onChange={e => {
                                const next = e.target.checked;
                                setTelemetry(next);
                                setTelemetryEnabled(next);
                                autoSaveSettings({ telemetry: next });
                              }}
                            />
                            <span className="iso-switch-slider"></span>
                          </label>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isDeleteModalOpen && (
        <div className="iso-modal-overlay" style={{ zIndex: 3000 }} onClick={() => setIsDeleteModalOpen(false)}>
          <div className="iso-modal" style={{ width: '400px', maxWidth: '90%', padding: '24px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            
            {deleteStep === 0 && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--iso-text)' }}>Are you sure?</h3>
                <p style={{ fontSize: '13px', color: 'var(--iso-text-muted)', marginBottom: '24px', lineHeight: '1.5' }}>
                  Do you really want to delete your account? This will wipe your profile configuration.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="iso-btn" style={{ flex: 1 }} onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
                  <button className="iso-btn" style={{ flex: 1, background: 'var(--iso-danger)', color: '#fff', border: 'none' }} onClick={() => setDeleteStep(1)}>Yes, I am sure</button>
                </div>
              </>
            )}

            {deleteStep === 1 && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--iso-text)' }}>Are you sure sure?</h3>
                <p style={{ fontSize: '13px', color: 'var(--iso-text-muted)', marginBottom: '24px', lineHeight: '1.5' }}>
                  All of your custom projects and shared cloud diagrams will be permanently erased. There is no way to recover them.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="iso-btn" style={{ flex: 1 }} onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
                  <button className="iso-btn" style={{ flex: 1, background: 'var(--iso-danger)', color: '#fff', border: 'none' }} onClick={() => setDeleteStep(2)}>Yes, delete everything</button>
                </div>
              </>
            )}

            {deleteStep === 2 && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--iso-error)' }}>Are you sure sure sure?</h3>
                <p style={{ fontSize: '13px', color: 'var(--iso-text-muted)', marginBottom: '24px', lineHeight: '1.5' }}>
                  This action is final and irreversible. This will delete your authentication record from our database.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="iso-btn" style={{ flex: 1 }} onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
                  <button className="iso-btn" style={{ flex: 1, background: 'var(--iso-danger)', color: '#fff', border: 'none', fontWeight: 700 }} onClick={handleDeleteAccount}>Yes, permanently delete my account</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
