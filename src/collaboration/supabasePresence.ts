import { supabase } from '../services/supabase.js';
import type { CollaborationAdapter, CollaborationBroadcastMessage, CollaborationPresence } from './collaborationTypes.js';

interface SupabasePresenceChannel {
  on(
    type: 'presence' | 'broadcast',
    filter: Record<string, string>,
    callback: (payload: { payload?: CollaborationBroadcastMessage }) => void,
  ): SupabasePresenceChannel;
  subscribe(callback?: (status: string) => void): SupabasePresenceChannel;
  track(payload: CollaborationPresence): Promise<unknown>;
  untrack(): Promise<unknown>;
  send(payload: { type: 'broadcast'; event: string; payload: CollaborationBroadcastMessage }): Promise<unknown>;
}

function flattenPresenceState(state: Record<string, CollaborationPresence[]>): CollaborationPresence[] {
  return Object.values(state).flat().filter(Boolean);
}

export class SupabasePresenceAdapter implements CollaborationAdapter {
  private channel: SupabasePresenceChannel | null = null;
  private presenceCallbacks = new Set<(members: CollaborationPresence[]) => void>();
  private broadcastCallbacks = new Set<(message: CollaborationBroadcastMessage) => void>();

  async join(roomId: string, presence: CollaborationPresence): Promise<void> {
    if (!supabase) return;
    const channel = supabase.channel(`isomorph:${roomId}`) as unknown as SupabasePresenceChannel & {
      presenceState?: () => Record<string, CollaborationPresence[]>;
    };
    this.channel = channel
      .on('presence', { event: 'sync' }, () => {
        const state = typeof channel.presenceState === 'function' ? channel.presenceState() : {};
        const members = flattenPresenceState(state);
        this.presenceCallbacks.forEach(callback => callback(members));
      })
      .on('broadcast', { event: 'isomorph' }, event => {
        if (event.payload) this.broadcastCallbacks.forEach(callback => callback(event.payload!));
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') await channel.track(presence);
      });
  }

  async leave(): Promise<void> {
    if (!this.channel) return;
    await this.channel.untrack();
    this.channel = null;
  }

  async updatePresence(presence: Partial<CollaborationPresence>): Promise<void> {
    if (!this.channel) return;
    await this.channel.track(presence as CollaborationPresence);
  }

  onPresenceChange(callback: (members: CollaborationPresence[]) => void): () => void {
    this.presenceCallbacks.add(callback);
    return () => this.presenceCallbacks.delete(callback);
  }

  async broadcast(message: CollaborationBroadcastMessage): Promise<void> {
    if (!this.channel) return;
    await this.channel.send({ type: 'broadcast', event: 'isomorph', payload: message });
  }

  onBroadcast(callback: (message: CollaborationBroadcastMessage) => void): () => void {
    this.broadcastCallbacks.add(callback);
    return () => this.broadcastCallbacks.delete(callback);
  }
}

export function createSupabasePresenceAdapter(): CollaborationAdapter {
  return new SupabasePresenceAdapter();
}
