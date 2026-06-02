import { IsomorphEditor, type LintDiagnostic } from '../../editor/IsomorphEditor.js';
import { IconCode } from '../Icons.js';
import React from 'react';

interface SourcePanelProps {
  title: string;
  value: string;
  diagnostics: LintDiagnostic[];
  statusText: string;
  lineCountText: string;
  onChange: (value: string) => void;
  // Relocated tabs props:
  tabs?: { id: string; name: string }[];
  activeTabId?: string | null;
  setActiveTabId?: (id: string) => void;
  renamingTabId?: string | null;
  setRenamingTabId?: (id: string | null) => void;
  setTabs?: React.Dispatch<React.SetStateAction<any[]>>;
  setTabToClose?: (id: string | null) => void;
  t?: (key: string, vars?: Record<string, string | number>) => string;
}

export function SourcePanel({
  title,
  value,
  diagnostics,
  statusText,
  lineCountText,
  onChange,
  tabs = [],
  activeTabId = null,
  setActiveTabId,
  renamingTabId = null,
  setRenamingTabId,
  setTabs,
  setTabToClose,
  t = (k) => k,
}: SourcePanelProps) {
  return (
    <section className="iso-panel iso-workspace-pane">
      <div className="iso-panel-header" style={{ paddingLeft: 0, display: 'flex', alignItems: 'center', height: 34 }}>
        <div className="iso-panel-title-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, paddingLeft: 12, paddingRight: 12, borderRight: '1px solid var(--iso-divider)', height: '100%', color: 'var(--iso-text-muted)', userSelect: 'none' }}>
          <IconCode size={11} />
          <span>{title}</span>
        </div>
        {tabs.length > 0 && (
          <nav className="iso-tabs" aria-label={t('tabs.open_files')} style={{ flex: '1 1 auto', overflowX: 'auto', display: 'flex', scrollbarWidth: 'none', msOverflowStyle: 'none', height: '100%', alignItems: 'center' }}>
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`iso-tab${tab.id === activeTabId ? ' iso-tab--active' : ''}`}
                onClick={() => setActiveTabId?.(tab.id)}
                onDoubleClick={() => setRenamingTabId?.(tab.id)}
                aria-label={t('tabs.open_name', { name: tab.name })}
                style={{
                  height: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderRight: '1px solid var(--iso-divider)',
                  borderRadius: 0,
                  paddingLeft: 12,
                  paddingRight: tabs.length > 1 ? 4 : 12,
                }}
              >
                {renamingTabId === tab.id ? (
                  <span style={{ display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      defaultValue={tab.name.includes('.') ? tab.name.substring(0, tab.name.lastIndexOf('.')) : tab.name}
                      className="iso-tab-rename-input"
                      style={{ background: 'transparent', border: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', outline: 'none', width: '80px', borderBottom: '1px solid currentColor' }}
                      onBlur={(e) => {
                        const ext = tab.name.includes('.') ? tab.name.substring(tab.name.lastIndexOf('.')) : '';
                        const newName = e.target.value ? e.target.value + ext : tab.name;
                        setTabs?.(prev => prev.map(t => t.id === tab.id ? { ...t, name: newName } : t));
                        setRenamingTabId?.(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setRenamingTabId?.(null);
                      }}
                    />
                    <span>{tab.name.includes('.') ? tab.name.substring(tab.name.lastIndexOf('.')) : ''}</span>
                  </span>
                ) : (
                  tab.name
                )}
                {tabs.length > 1 && (
                  <button
                    type="button"
                    style={{ all: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '4px', marginLeft: '6px', cursor: 'pointer', opacity: 0.6 }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'transparent'; }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTabToClose?.(tab.id);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </nav>
        )}
        <span className="iso-panel-info" aria-live="polite">
          {statusText}
        </span>
        <span className="iso-panel-spacer" />
        <span className="iso-pane-metric">
          {lineCountText}
        </span>
      </div>
      <div className="iso-panel-body">
        <IsomorphEditor value={value} onChange={onChange} errors={diagnostics} />
      </div>
    </section>
  );
}
