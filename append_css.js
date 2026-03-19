const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');
css += \
  .iso-modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 2000;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(4px);
    animation: overlay-fade-in 180ms var(--iso-ease);
  }
  .iso-modal {
    background: var(--white); border: 1px solid var(--iso-border-strong);
    border-radius: var(--iso-radius-lg); padding: 24px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2); width: 360px; text-align: center;
    animation: overlay-slide-in 220ms var(--iso-ease);
  }
  .iso-modal-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: var(--iso-text); }
  .iso-modal-desc { font-size: 13px; color: var(--iso-text-muted); margin-bottom: 20px; line-height: 1.5; }
  .iso-modal-select { width: 100%; padding: 8px 12px; border: 1px solid var(--iso-border); border-radius: var(--iso-radius); margin-bottom: 20px; font-size: 14px; background: white; color: var(--iso-text); }
  .iso-modal-actions { display: flex; gap: 12px; justify-content: stretch; }
  .iso-modal-btn { flex: 1; padding: 10px; border-radius: var(--iso-radius); border: 1px solid transparent; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
  .iso-modal-btn.cancel { background: var(--iso-bg-hover); color: var(--iso-text); }
  .iso-modal-btn.cancel:hover { background: var(--iso-divider); }
  .iso-modal-btn.confirm { background: var(--ink-deep); color: white; }
  .iso-modal-btn.confirm:hover { background: var(--ink); }
  .iso-modal-btn.danger { background: var(--iso-error); color: white; }
  .iso-modal-btn.danger:hover { background: #e04a43; }
\;
fs.writeFileSync('src/index.css', css);
