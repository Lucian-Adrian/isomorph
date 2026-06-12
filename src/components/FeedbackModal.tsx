import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth-context.js';
import { tText, getStoredLanguage } from '../i18n.js';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [content, setContent] = useState('');
  const [type, setType] = useState<'bug' | 'feature' | 'general'>('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { session, user } = useAuth();
  const lang = getStoredLanguage();

  const t = (key: string) => tText(lang, key);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    setError(null);

    const { error: submitError } = await supabase.from('feedback').insert([
      {
        user_id: user?.id || null, // Allow anonymous feedback but link if logged in
        type,
        content,
        created_at: new Date().toISOString()
      }
    ]);

    setLoading(false);

    if (submitError) {
      console.error('Feedback error:', submitError);
      setError(t('feedback.error'));
    } else {
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setContent('');
        setType('general');
      }, 2000);
    }
  };

  return (
    <div className="iso-modal-overlay" onMouseDown={onClose} style={{ zIndex: 10000 }}>
      <div className="iso-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="iso-modal-header">
          <h2 className="iso-modal-title">{t('ui.feedback')}</h2>
          <button className="iso-modal-close" onClick={onClose} aria-label={t('ui.close')}>×</button>
        </div>
        <div className="iso-modal-body">
          {success ? (
            <div className="iso-success-message" style={{ textAlign: 'center', padding: '24px 0' }}>
              {t('feedback.success')}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="iso-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="iso-modal-field">
                <label>{t('feedback.type')}</label>
                <select className="iso-select" value={type} onChange={e => setType(e.target.value as any)} style={{ width: '100%' }}>
                  <option value="general">{t('feedback.type_general')}</option>
                  <option value="bug">{t('feedback.type_bug')}</option>
                  <option value="feature">{t('feedback.type_feature')}</option>
                </select>
              </div>
              <div className="iso-modal-field">
                <label>{t('feedback.content')}</label>
                <textarea
                  className="iso-input"
                  style={{ minHeight: '100px', resize: 'vertical' }}
                  required
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={t('feedback.placeholder')}
                />
              </div>
              
              {!session && (
                <p style={{ fontSize: '12px', color: 'var(--iso-text-muted)', marginBottom: '16px' }}>
                  {t('feedback.anon_warning')}
                </p>
              )}

              {error && <div className="iso-error-message">{error}</div>}

              <button type="submit" className="iso-btn iso-btn--primary" style={{ width: '100%', padding: '12px', fontSize: '16px' }} disabled={loading}>
                {loading ? '...' : t('feedback.submit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
