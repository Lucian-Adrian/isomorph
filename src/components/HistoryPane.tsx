// ============================================================
// Isomorph — Version History Sidebar Pane Component
// ============================================================
// Renders the list of previous diagram snapshots.
// Extracted from App.tsx during demonolith decomposition.
// ============================================================



interface HistoryPaneProps {
  diagramHistoryList: any[];
  selectedHistoryId: string | null;
  setSelectedHistoryId: (id: string | null) => void;
  user: any;
  setIsRevertModalOpen: (open: boolean) => void;
  t: (key: string, vars?: any) => string;
}

export function HistoryPane({
  diagramHistoryList,
  selectedHistoryId,
  setSelectedHistoryId,
  user,
  setIsRevertModalOpen,
  t,
}: HistoryPaneProps) {
  return (
    <div className="iso-sidebar" style={{ width: 'var(--iso-sidebar-width, 200px)', flexShrink: 0 }}>
      <div
        className="iso-panel-header"
        style={{ borderBottom: '1px solid var(--iso-divider)', padding: '0 12px' }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginRight: 6 }}
        >
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        {t('ui.history')}
      </div>
      <div className="iso-sidebar-body" style={{ padding: '8px', overflowY: 'auto' }}>
        {diagramHistoryList.length === 0 ? (
          <div
            style={{
              color: 'var(--iso-text-muted)',
              fontSize: '12px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            {t('history.empty')}
          </div>
        ) : (
          diagramHistoryList.map((h) => (
            <button
              key={h.id}
              className="iso-btn"
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                marginBottom: '8px',
                background: selectedHistoryId === h.id ? 'var(--iso-bg-active)' : 'transparent',
                border:
                  selectedHistoryId === h.id
                    ? '1px solid var(--iso-brand)'
                    : '1px solid transparent',
              }}
              onClick={() => setSelectedHistoryId(selectedHistoryId === h.id ? null : h.id)}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    width: '100%',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>
                    {new Date(h.created_at).toLocaleString()}
                  </span>
                </div>
                {h.user_id && (
                  <span style={{ fontSize: '11px', color: 'var(--iso-text-muted)' }}>
                    {t('history.saved_by', { who: h.user_id === user?.id ? t('ui.you') : t('history.collaborator') })}
                  </span>
                )}
                {selectedHistoryId === h.id && (
                  <button
                    className="iso-btn"
                    style={{
                      marginTop: 8,
                      padding: '4px 8px',
                      fontSize: 11,
                      width: '100%',
                      background: 'transparent',
                      color: 'var(--iso-error)',
                      border: '1px solid var(--iso-error)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRevertModalOpen(true);
                    }}
                  >
                    {t('history.revert_snapshot')}
                  </button>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
