import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { tText, getStoredLanguage } from '../i18n.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

type AuthMode = 'login' | 'register' | 'reset';

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const lang = getStoredLanguage();

  const t = (key: string) => tText(lang, key);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setEmail('');
      setPassword('');
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else if (mode === 'register') {
        // OSINT protection - don't reveal if email exists, handled by Supabase default settings if configure properly
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess(t('auth.success_register'));
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`, // This would need a route in a real app, placeholder for now
        });
        if (error) throw error;
        setSuccess(t('auth.success_reset'));
      }
    } catch (err: any) {
      setError(err.message || t('auth.error_generic'));
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    login: t('auth.title_login'),
    register: t('auth.title_register'),
    reset: t('auth.title_reset'),
  };

  const submitLabels = {
    login: t('auth.submit_login'),
    register: t('auth.submit_register'),
    reset: t('auth.submit_reset'),
  };

  return (
    <div className="iso-modal-overlay" onMouseDown={onClose}>
      <div className="iso-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="iso-modal-header">
          <h2 className="iso-modal-title">{titles[mode]}</h2>
          <button className="iso-modal-close" onClick={onClose} aria-label={t('ui.close')}>×</button>
        </div>
        <div className="iso-modal-body">
          <form onSubmit={handleSubmit} className="iso-auth-form">
            <div className="iso-form-group">
              <label htmlFor="auth-email">{t('auth.email')}</label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="iso-input"
              />
            </div>
            
            {mode !== 'reset' && (
              <div className="iso-form-group">
                <label htmlFor="auth-password">{t('auth.password')}</label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="iso-input"
                  minLength={6}
                />
              </div>
            )}

            {error && <div className="iso-error-message">{error}</div>}
            {success && <div className="iso-success-message">{success}</div>}

            <button type="submit" className="iso-button iso-button--primary iso-auth-submit" disabled={loading}>
              {loading ? '...' : submitLabels[mode]}
            </button>
          </form>

          <div className="iso-auth-links">
            {mode === 'login' && (
              <>
                <button type="button" className="iso-auth-link" onClick={() => setMode('register')}>
                  {t('auth.switch_to_register')}
                </button>
                <button type="button" className="iso-auth-link" onClick={() => setMode('reset')}>
                  {t('auth.switch_to_reset')}
                </button>
              </>
            )}
            {mode === 'register' && (
              <button type="button" className="iso-auth-link" onClick={() => setMode('login')}>
                {t('auth.switch_to_login')}
              </button>
            )}
            {mode === 'reset' && (
              <button type="button" className="iso-auth-link" onClick={() => setMode('login')}>
                {t('auth.back_to_login')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
