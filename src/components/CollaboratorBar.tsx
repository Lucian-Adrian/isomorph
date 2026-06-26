// ============================================================
// Isomorph — Collaborator Bar Component
// ============================================================
// Renders the list of active/connected collaborators, avatars, and dropdown list.
// Extracted from App.tsx during demonolith decomposition.
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';

export interface Collaborator {
  clientId: number;
  name: string;
  username?: string;
  color: string;
  avatarUrl: string | null;
  role: string;
}

interface CollaboratorBarProps {
  activeTab: { diagram_id?: string } | null;
  isConnected: boolean;
  sortedCollaborators: Collaborator[];
  awareness: any;
  t: (key: string, vars?: any) => string;
}

export function CollaboratorBar({
  activeTab,
  isConnected,
  sortedCollaborators,
  awareness,
  t,
}: CollaboratorBarProps) {
  const [isCollabDropdownOpen, setIsCollabDropdownOpen] = useState(false);
  const collabRef = useRef<HTMLDivElement>(null);

  // Close collaboration dropdown on outside click or Escape
  useEffect(() => {
    function handleOutsideCollabClick(e: Event) {
      if (collabRef.current && !collabRef.current.contains(e.target as Node)) {
        setIsCollabDropdownOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsCollabDropdownOpen(false);
      }
    }
    if (isCollabDropdownOpen) {
      document.addEventListener('click', handleOutsideCollabClick);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('click', handleOutsideCollabClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isCollabDropdownOpen]);

  const getInitials = useCallback((name: string) => {
    const clean = name.trim();
    if (!clean) return '?';
    const parts = clean.split(/\s+/);
    if (parts.length > 1) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }, []);

  if (!activeTab?.diagram_id || !isConnected) {
    return null;
  }

  return (
    <div ref={collabRef} className="iso-avatar-stack">
      {sortedCollaborators.slice(0, 2).map((collab) => (
        <div
          key={collab.clientId}
          className="iso-avatar"
          style={{
            backgroundColor: collab.avatarUrl ? 'transparent' : collab.color,
            border: `2px solid ${collab.color}`,
          }}
          title={
            collab.clientId === awareness?.clientID
              ? `${collab.name} (${t('ui.you')})`
              : collab.name
          }
          onClick={() => setIsCollabDropdownOpen((prev) => !prev)}
        >
          {collab.avatarUrl ? (
            <img
              src={collab.avatarUrl}
              alt={collab.name}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            getInitials(collab.name)
          )}
        </div>
      ))}
      {sortedCollaborators.length > 2 && (
        <div
          className="iso-avatar iso-avatar-more"
          title={t('ui.connected_users')}
          onClick={() => setIsCollabDropdownOpen((prev) => !prev)}
        >
          ...
        </div>
      )}
      {isCollabDropdownOpen && (
        <div className="iso-collab-dropdown">
          <div className="iso-collab-dropdown-title">
            {t('ui.connected_users')} ({sortedCollaborators.length})
          </div>
          {sortedCollaborators.map((c) => (
            <div
              key={c.clientId}
              className="iso-collab-user-row"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {c.avatarUrl ? (
                <img
                  src={c.avatarUrl}
                  alt={c.name}
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                    border: `2px solid ${c.color}`,
                  }}
                />
              ) : (
                <span className="iso-collab-user-dot" style={{ backgroundColor: c.color }} />
              )}
              <div
                className="iso-collab-user-name"
                title={c.name}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.name}
                  {c.clientId === awareness?.clientID && ` (${t('ui.you')})`}
                </span>
                {c.username && (
                  <span style={{ fontSize: '10px', color: 'var(--iso-text-muted)', lineHeight: 1 }}>
                    @{c.username}
                  </span>
                )}
              </div>
              <span
                className="iso-collab-user-role"
                style={{
                  fontSize: '10px',
                  color: 'var(--iso-text-muted)',
                  textTransform: 'capitalize',
                  border: '1px solid var(--iso-border)',
                  borderRadius: '4px',
                  padding: '1px 5px',
                  backgroundColor: 'var(--iso-bg-app)',
                  lineHeight: 1.2,
                }}
              >
                {c.role === 'owner' ? 'editor' : c.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
