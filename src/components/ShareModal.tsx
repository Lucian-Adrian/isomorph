import type { CollaborationRole } from '../collaboration/collaborationTypes.js';

export interface ShareModalProps {
  open: boolean;
  diagramTitle: string;
  inviteEmail: string;
  role: CollaborationRole;
  onInviteEmailChange: (value: string) => void;
  onRoleChange: (role: CollaborationRole) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function ShareModal({
  open,
  diagramTitle,
  inviteEmail,
  role,
  onInviteEmailChange,
  onRoleChange,
  onClose,
  onSubmit,
}: ShareModalProps) {
  if (!open) return null;

  return (
    <div className="iso-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="iso-modal" role="dialog" aria-modal="true" aria-label="Share diagram" onMouseDown={event => event.stopPropagation()}>
        <div className="iso-modal-header">
          <div>
            <strong>Share {diagramTitle || 'diagram'}</strong>
            <span>Invite collaborators without exposing private source in telemetry.</span>
          </div>
          <button type="button" className="iso-icon-button" onClick={onClose} aria-label="Close share dialog">x</button>
        </div>
        <form
          className="iso-auth-form"
          onSubmit={event => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="iso-form-field">
            <span>Email</span>
            <input
              className="iso-select"
              type="email"
              value={inviteEmail}
              placeholder="teammate@example.com"
              onChange={event => onInviteEmailChange(event.target.value)}
            />
          </label>
          <label className="iso-form-field">
            <span>Role</span>
            <select className="iso-select" value={role} onChange={event => onRoleChange(event.target.value as CollaborationRole)}>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <p className="iso-panel-info">
            Presence shares cursors, active mode, and selected objects. Concurrent source merging is reserved for the Yjs phase.
          </p>
          <button type="submit" className="iso-btn iso-primary">Create invite</button>
        </form>
      </section>
    </div>
  );
}
