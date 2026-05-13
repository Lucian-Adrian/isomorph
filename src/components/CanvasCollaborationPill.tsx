import type { CollaborationPresence } from '../collaboration/collaborationTypes.js';

export interface CanvasCollaborationPillProps {
  members: CollaborationPresence[];
  active?: boolean;
}

export function CanvasCollaborationPill({ members, active = false }: CanvasCollaborationPillProps) {
  const visibleMembers = members.slice(0, 4);
  return (
    <div className="iso-canvas-collab" aria-label="Canvas collaborators">
      <span className={active ? 'iso-presence-dot is-live' : 'iso-presence-dot'} />
      {visibleMembers.length === 0 ? (
        <span>Solo</span>
      ) : (
        visibleMembers.map(member => (
          <span
            key={member.user.id}
            className="iso-avatar"
            title={member.user.displayName || member.user.email || member.user.id}
            style={{ background: member.user.color }}
          >
            {(member.user.displayName || member.user.email || member.user.id).slice(0, 1).toUpperCase()}
          </span>
        ))
      )}
      {members.length > visibleMembers.length ? <span>+{members.length - visibleMembers.length}</span> : null}
    </div>
  );
}
