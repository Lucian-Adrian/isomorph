// ============================================================
// ShortcutsOverlay — Keyboard shortcuts dialog component
// ============================================================
// Extracted from App.tsx for component composition (SRP).
// ============================================================

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: 'Ctrl + N',           desc: 'New diagram' },
  { keys: 'Ctrl + O',           desc: 'Open .isx file' },
  { keys: 'Ctrl + E',           desc: 'Export SVG' },
  { keys: 'Ctrl + Shift + E',   desc: 'Export PNG' },
  { keys: 'Ctrl + Z / Y',       desc: 'Undo / Redo' },
  { keys: 'Ctrl + ?',           desc: 'Toggle this panel' },
];

export function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="iso-overlay-backdrop"
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="iso-overlay" role="document" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        <div className="iso-overlay-header">
          <span className="iso-overlay-title">Keyboard Shortcuts</span>
          <button type="button" className="iso-overlay-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="iso-overlay-body">
          {SHORTCUTS.map(s => (
            <div key={s.keys} className="iso-shortcut-row">
              <span className="iso-shortcut-keys">
                {s.keys.split(' + ').map((k, _i, arr) => (
                  <span key={k}>{arr.indexOf(k) > 0 && <span className="iso-shortcut-plus">+</span>}<kbd className="iso-kbd">{k.trim()}</kbd></span>
                ))}
              </span>
              <span className="iso-shortcut-desc">{s.desc}</span>
            </div>
          ))}
        </div>
        <div className="iso-overlay-footer">
          <span style={{ color: 'var(--iso-text-faint)', fontSize: 11 }}>Press <kbd className="iso-kbd">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
