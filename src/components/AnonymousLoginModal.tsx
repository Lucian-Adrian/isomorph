import { useState, useEffect } from 'react';
import { getStoredLanguage, tText } from '../i18n.js';

interface AnonymousLoginModalProps {
  onJoin: (displayName: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AnonymousLoginModal({ onJoin, onCancel, isLoading }: AnonymousLoginModalProps) {
  const [name, setName] = useState('');
  const lang = getStoredLanguage();
  const t = (key: string, vars?: Record<string, string | number>) => tText(lang, key, vars);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div 
      className="iso-modal-overlay" 
      onClick={onCancel}
      style={{ zIndex: 10000 }}
    >
      <div 
        className="iso-modal" 
        onClick={e => e.stopPropagation()}
      >
        <div className="iso-modal-header">
          <h3 className="iso-modal-title">{t('join.title')}</h3>
          <button onClick={onCancel} className="iso-modal-close" title={t('ui.close')}>×</button>
        </div>
        <p className="iso-modal-desc">
          {t('join.desc')}
        </p>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onJoin(name.trim());
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          <div className="iso-modal-field">
            <label>{t('join.display_name')}</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation(); }}
              onKeyUp={e => { if (e.key !== 'Escape') e.stopPropagation(); }}
              onKeyPress={e => { if (e.key !== 'Escape') e.stopPropagation(); }}
              className="iso-input"
              placeholder={t('join.placeholder')}
              style={{ width: '100%', padding: '10px' }}
            />
          </div>

          <div className="iso-modal-actions">
            <button
              type="button"
              onClick={onCancel}
              className="iso-modal-btn cancel"
            >
              {t('ui.cancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="iso-modal-btn confirm"
            >
              {isLoading ? t('join.joining') : t('join.join_button')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
