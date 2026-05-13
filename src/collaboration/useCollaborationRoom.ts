import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WorkspaceMode } from '../app/modeState.js';
import type { WorkspaceSelection } from '../app/selectionState.js';
import { createSupabasePresenceAdapter } from './supabasePresence.js';
import type {
  CollaborationAdapter,
  CollaborationBroadcastMessage,
  CollaborationCursor,
  CollaborationPresence,
  CollaborationUser,
} from './collaborationTypes.js';

export interface UseCollaborationRoomOptions {
  roomId: string | null;
  user: CollaborationUser | null;
  mode: WorkspaceMode;
  adapter?: CollaborationAdapter;
}

export function useCollaborationRoom({ roomId, user, mode, adapter }: UseCollaborationRoomOptions) {
  const resolvedAdapter = useMemo(() => adapter ?? createSupabasePresenceAdapter(), [adapter]);
  const [members, setMembers] = useState<CollaborationPresence[]>([]);

  useEffect(() => {
    if (!roomId || !user) return undefined;
    const presence: CollaborationPresence = {
      user,
      mode,
      updatedAt: new Date().toISOString(),
    };
    const disposePresence = resolvedAdapter.onPresenceChange(setMembers);
    void resolvedAdapter.join(roomId, presence);
    return () => {
      disposePresence();
      void resolvedAdapter.leave();
    };
  }, [mode, resolvedAdapter, roomId, user]);

  const updateCursor = useCallback(
    async (cursor: CollaborationCursor) => {
      await resolvedAdapter.updatePresence({ cursor, mode, updatedAt: new Date().toISOString() });
    },
    [mode, resolvedAdapter],
  );

  const updateSelection = useCallback(
    async (selection: WorkspaceSelection) => {
      await resolvedAdapter.updatePresence({ selection, mode, updatedAt: new Date().toISOString() });
    },
    [mode, resolvedAdapter],
  );

  const broadcast = useCallback(
    async (message: CollaborationBroadcastMessage) => {
      await resolvedAdapter.broadcast(message);
    },
    [resolvedAdapter],
  );

  return {
    members,
    updateCursor,
    updateSelection,
    broadcast,
  };
}
