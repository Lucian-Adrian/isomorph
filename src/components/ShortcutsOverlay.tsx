// ============================================================
// ShortcutsOverlay — Keyboard shortcuts dialog component
// ============================================================
// Extracted from App.tsx for component composition (SRP).
// ============================================================

const SHORTCUTS: { keys: string; descKey: string }[] = [
  { keys: 'Ctrl + N',           descKey: 'New diagram' },
  { keys: 'Ctrl + O',           descKey: 'Open .isx file' },
  { keys: 'Ctrl + E',           descKey: 'Export SVG' },
  { keys: 'Ctrl + Shift + E',   descKey: 'Export PNG' },
  { keys: 'Ctrl + Z / Y',       descKey: 'Undo / Redo' },
  { keys: 'Ctrl + ?',           descKey: 'Toggle this panel' },
];

export function ShortcutsOverlay({
  open,
  onClose,
  t,
}: {
  open: boolean;
  onClose: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (!open) return null;
  return (
    <div
      className="iso-overlay-backdrop"
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.shortcuts')}
    >
      <div className="iso-overlay" role="document" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        <div className="iso-overlay-header">
          <span className="iso-overlay-title">{t('ui.shortcuts_title')}</span>
          <button type="button" className="iso-overlay-close" onClick={onClose} aria-label={t('ui.close')}>&times;</button>
        </div>
        <div className="iso-overlay-body">
          {SHORTCUTS.map(s => (
            <div key={s.keys} className="iso-shortcut-row">
              <span className="iso-shortcut-keys">
                {s.keys.split(' + ').map((k, _i, arr) => (
                  <span key={k}>{arr.indexOf(k) > 0 && <span className="iso-shortcut-plus">+</span>}<kbd className="iso-kbd">{k.trim()}</kbd></span>
                ))}
              </span>
              <span className="iso-shortcut-desc">{t(s.descKey)}</span>
            </div>
          ))}
        </div>
        <div className="iso-overlay-footer">
          <span style={{ color: 'var(--iso-text-faint)', fontSize: 11 }}>{t('ui.press')} <kbd className="iso-kbd">Esc</kbd> {t('ui.to_close')}</span>
        </div>
      </div>
    </div>
  );
}
