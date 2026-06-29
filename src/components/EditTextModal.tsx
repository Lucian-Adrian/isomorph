import React from 'react';
import type { WorkspaceTab } from '../types/index.js';

export interface EditTextModalProps {
  editingText: {
    type: 'diagram' | 'package';
    oldName: string;
    newName: string;
  } | null;
  setEditingText: (text: any) => void;
  updateActiveTab: (updater: (tab: WorkspaceTab) => WorkspaceTab, saveHistory?: boolean) => void;
  t: (key: string, options?: any) => string;
  isMobileLayout: boolean;
}

export const EditTextModal: React.FC<EditTextModalProps> = ({
  editingText,
  setEditingText,
  updateActiveTab,
  t,
  isMobileLayout,
}) => {
  if (!editingText) return null;

  const handleSave = () => {
    updateActiveTab((tab) => {
      let src = tab.source;
      if (editingText.type === 'diagram') {
        src = src.replace(new RegExp('diagram\\s+' + editingText.oldName), 'diagram ' + editingText.newName);
      } else {
        src = src.replace(new RegExp('package\\s+' + editingText.oldName + '\\b'), 'package ' + editingText.newName);
        src = src.replace(new RegExp('@' + editingText.oldName + '\\s+at'), '@' + editingText.newName + ' at');
      }
      return { ...tab, source: src };
    });
    setEditingText(null);
  };

  return (
    <div className="iso-modal-overlay" onClick={() => setEditingText(null)}>
      <div className="iso-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{editingText.type === 'diagram' ? t('edit.diagram_name') : t('edit.package_name')}</h3>
        <div className="iso-modal-field">
          <label>{t('edit.name')}</label>
          <input
            type="text"
            style={{ width: '100%', padding: '0.4rem' }}
            value={editingText.newName}
            onChange={(e) => setEditingText({ ...editingText, newName: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave();
              }
            }}
            autoFocus={!isMobileLayout}
          />
        </div>
        <div className="iso-modal-actions">
          <button type="button" className="iso-btn" onClick={() => setEditingText(null)}>
            {t('ui.cancel')}
          </button>
          <button type="button" className="iso-btn iso-btn--primary" onClick={handleSave}>
            {t('menu.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
