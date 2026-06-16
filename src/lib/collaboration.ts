import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useState, useEffect, useCallback } from 'react';

// Use an environment variable or fallback for the WebSocket server
export const COLLAB_SERVER_URL = import.meta.env.VITE_COLLAB_SERVER_URL || 'ws://localhost:1234';

class YjsManager {
  public doc: Y.Doc;
  public provider: any = null;
  public roomName: string | null = null;

  constructor() {
    this.doc = new Y.Doc();
  }

  public connect(roomName: string, userName: string, cursorColor: string) {
    if (this.provider) {
      if (this.roomName === roomName) {
        // Already connected to this room
        return this.provider;
      }
      // Disconnect from previous room
      this.disconnect();
    }

    this.roomName = roomName;
    // We clear the doc before connecting to a new room to start fresh
    this.doc = new Y.Doc();

    this.provider = new WebsocketProvider(COLLAB_SERVER_URL, roomName, this.doc, {
      connect: true,
    });

    // Set up awareness (presence)
    const awareness = this.provider.awareness;
    awareness.setLocalStateField('user', {
      name: userName,
      color: cursorColor,
    });

    return this.provider;
  }

  public disconnect() {
    if (this.provider) {
      this.provider.disconnect();
      this.provider.destroy();
      this.provider = null;
      this.roomName = null;
    }
  }

  public getAwareness() {
    return this.provider?.awareness;
  }
}

export const yjsManager = new YjsManager();

export function useCollaboration(
  diagramId: string | null,
  userName: string = 'Anonymous',
  cursorColor: string = '#3B82F6',
  avatarUrl: string | null = null,
  role: string = 'viewer'
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [awareness, setAwareness] = useState(yjsManager.getAwareness());
  const [connectedDiagramId, setConnectedDiagramId] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<{ clientId: number; name: string; color: string; avatarUrl: string | null; role: string }[]>([]);

  useEffect(() => {
    if (!diagramId) {
      yjsManager.disconnect();
      setIsConnected(false);
      setConnectedDiagramId(null);
      setCollaborators([]);
      return;
    }

    const provider = yjsManager.connect(diagramId, userName, cursorColor);
    setAwareness(provider.awareness);
    setConnectedDiagramId(diagramId);

    // Set local presence data including avatar and role
    provider.awareness.setLocalStateField('user', {
      name: userName,
      color: cursorColor,
      avatarUrl,
      role
    });

    const handleStatus = (event: { status: string }) => {
      setIsConnected(event.status === 'connected');
    };

    const handleSync = (synced: boolean) => {
      setIsSynced(synced);
    };

    const updateCollaborators = () => {
      const states = provider.awareness.getStates();
      const users: { clientId: number; name: string; color: string; avatarUrl: string | null; role: string }[] = [];
      states.forEach((state: any, clientId: number) => {
        if (state.user) {
          users.push({
            clientId,
            name: state.user.name || 'Anonymous',
            color: state.user.color || '#3B82F6',
            avatarUrl: state.user.avatarUrl || null,
            role: state.user.role || 'viewer',
          });
        }
      });
      setCollaborators(users);
    };

    provider.on('status', handleStatus);
    provider.on('sync', handleSync);
    provider.awareness.on('change', updateCollaborators);

    setIsConnected(provider.wsconnected);
    setIsSynced(provider.synced);
    updateCollaborators();

    return () => {
      provider.off('status', handleStatus);
      provider.off('sync', handleSync);
      provider.awareness.off('change', updateCollaborators);
      // We don't automatically disconnect here if the component unmounts but we are still in the diagram.
      // The diagram switch logic handles reconnecting/disconnecting.
    };
  }, [diagramId, userName, cursorColor, avatarUrl, role]);

  // Provide a way to get the active Y.Text for the source code
  const getSourceText = useCallback(() => {
    return yjsManager.doc.getText('source');
  }, []);

  return {
    doc: yjsManager.doc,
    provider: yjsManager.provider,
    awareness,
    isConnected,
    isSynced,
    getSourceText,
    connectedDiagramId,
    collaborators,
  };
}
