import type { WorkspaceMode } from '../app/modeState.js';
import type { WorkspaceSelection } from '../app/selectionState.js';

export type CollaborationRole = 'owner' | 'editor' | 'viewer';

export interface CollaborationCursor {
  x: number;
  y: number;
  color: string;
}

export interface CollaborationUser {
  id: string;
  email?: string;
  displayName?: string;
  color: string;
}

export interface CollaborationPresence {
  user: CollaborationUser;
  mode: WorkspaceMode;
  cursor?: CollaborationCursor;
  selection?: WorkspaceSelection;
  updatedAt: string;
}

export interface CollaborationRoom {
  id: string;
  diagramId: string;
  role: CollaborationRole;
}

export interface RoomMembership {
  roomId: string;
  userId?: string;
  invitedEmail?: string;
  role: CollaborationRole;
}

export interface CollaborationBroadcastMessage {
  type: 'cursor' | 'selection' | 'tool' | 'comment' | 'snapshot-request';
  payload: Record<string, unknown>;
}

export interface CollaborationAdapter {
  join(roomId: string, presence: CollaborationPresence): Promise<void>;
  leave(): Promise<void>;
  updatePresence(presence: Partial<CollaborationPresence>): Promise<void>;
  onPresenceChange(callback: (members: CollaborationPresence[]) => void): () => void;
  broadcast(message: CollaborationBroadcastMessage): Promise<void>;
  onBroadcast(callback: (message: CollaborationBroadcastMessage) => void): () => void;
}

export interface CrdtProvider {
  connect(roomId: string): Promise<void>;
  disconnect(): Promise<void>;
  applyRemoteUpdate(update: Uint8Array): void;
  encodeLocalUpdate(): Uint8Array;
}
