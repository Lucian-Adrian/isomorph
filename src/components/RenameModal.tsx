interface RenameModalProps {
  isOpen: boolean;
  renameType: 'project' | 'category' | 'diagram' | null;
  renameValue: string;
  setRenameValue: (val: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  t: (key: string, vars?: any) => string;
}

export function RenameModal({
  isOpen,
  renameType,
  renameValue,
  setRenameValue,
  onClose,
  onConfirm,
  t,
}: RenameModalProps) {
  if (!isOpen || !renameType) return null;

  return (
    <div className="iso-modal-overlay" onClick={onClose}>
      <div className="iso-modal" onClick={(e) => e.stopPropagation()} style={{ width: '400px' }}>
        <button className="iso-modal-close-btn" onClick={onClose}>
          ×
        </button>
        <h3 style={{ margin: 0, fontSize: '18px', marginBottom: '16px' }}>
          Rename {renameType === 'project' ? 'Project' : renameType === 'category' ? 'Category' : 'Diagram'}
        </h3>
        <div className="iso-modal-field">
          <label>New Name</label>
          <input
            type="text"
            className="iso-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder={
              renameType === 'project'
                ? 'Project name...'
                : renameType === 'category'
                  ? 'Category name...'
                  : 'Diagram name...'
            }
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameValue.trim()) {
                onConfirm();
              }
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '16px',
          }}
        >
          <button className="iso-btn" onClick={onClose}>
            {t('ui.cancel')}
          </button>
          <button className="iso-btn iso-btn--primary" disabled={!renameValue.trim()} onClick={onConfirm}>
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}
