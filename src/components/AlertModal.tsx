import React, { useEffect } from 'react';
import { sound } from '../lib/sound.js';

export interface AlertModalProps {
  isOpen: boolean;
  type?: 'caution' | 'error' | 'info';
  title?: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm?: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  type = 'caution',
  title,
  message,
  confirmLabel = 'OK',
  onClose,
  onConfirm,
}) => {
  useEffect(() => {
    if (isOpen) {
      if (type === 'error') {
        sound.toast('error');
      } else if (type === 'caution') {
        sound.warn();
      } else {
        sound.modalOpen();
      }
    }
  }, [isOpen, type]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        handleAction();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAction = () => {
    sound.modalClose();
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const defaultTitle =
    type === 'error' ? 'Error' : type === 'caution' ? 'Caution' : 'Notice';
  const displayTitle = title || defaultTitle;

  return (
    <div className="iso-modal-overlay" style={{ zIndex: 3000 }} onClick={handleAction}>
      <div
        className={`iso-modal iso-alert-modal iso-alert-modal--${type}`}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '420px', maxWidth: '92vw' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
          <div className={`iso-alert-icon-badge iso-alert-icon-badge--${type}`}>
            {type === 'error' && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            {type === 'caution' && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {type === 'info' && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              className="iso-modal-title"
              style={{
                fontSize: '16px',
                fontWeight: 600,
                marginBottom: '6px',
                color: 'var(--iso-text)',
              }}
            >
              {displayTitle}
            </h3>
            <p
              className="iso-modal-desc"
              style={{
                margin: 0,
                fontSize: '13px',
                lineHeight: 1.5,
                color: 'var(--iso-text-muted)',
                wordBreak: 'break-word',
              }}
            >
              {message}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <button
            type="button"
            className="iso-modal-btn confirm"
            style={{ minWidth: '84px', flex: '0 0 auto' }}
            onClick={handleAction}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
