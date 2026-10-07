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

  const sanitizeName = (val: string) => {
    let clean = val.trim();
    if (clean && renameType === 'diagram' && !clean.toLowerCase().endsWith('.isx')) {
      clean += '.isx';
    }
    return clean;
  };

  const handleConfirm = () => {
    const clean = sanitizeName(renameValue);
    if (!clean) return;
    setRenameValue(clean);
    onConfirm();
  };

  return (
    <div className="iso-modal-overlay" onClick={onClose}>
      <div className="iso-modal" onClick={(e) => e.stopPropagation()} style={{ width: '400px' }}>
        <button className="iso-modal-close-btn" onClick={onClose}>
          ×
        </button>
        <h2 className="iso-modal-title" style={{ marginBottom: '16px' }}>
          {t('ui.rename_item', { item: t(`ui.${renameType}`) || renameType }) || `Rename ${renameType}`}
        </h2>
        <div className="iso-modal-field">
          <label>{t('ui.new_name') || 'New name'}</label>
          <input
            type="text"
            className="iso-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => {
              if (renameValue.trim()) {
                setRenameValue(sanitizeName(renameValue));
              }
            }}
            placeholder={
              renameType === 'project'
                ? (t('ui.project_name') || 'Project name...')
                : renameType === 'category'
                  ? (t('ui.new_category_name') || 'Category name...')
                  : 'Diagram name...'
            }
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameValue.trim()) {
                handleConfirm();
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
          <button className="iso-btn iso-btn--primary" disabled={!renameValue.trim()} onClick={handleConfirm}>
            {t('ui.rename') || 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
}
