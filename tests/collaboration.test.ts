import { describe, expect, it, vi } from 'vitest';
import type { CollaborationAdapter, CollaborationPresence } from '../src/collaboration/collaborationTypes.js';

describe('collaboration adapter contract', () => {
  it('supports presence, selection, and broadcast without requiring a CRDT provider in v1', async () => {
    const members: CollaborationPresence[] = [];
    const adapter: CollaborationAdapter = {
      join: vi.fn(async (_roomId, presence) => { members.push(presence); }),
      leave: vi.fn(async () => undefined),
      updatePresence: vi.fn(async presence => {
        members[0] = { ...members[0], ...presence };
      }),
      onPresenceChange: vi.fn(() => () => undefined),
      broadcast: vi.fn(async () => undefined),
      onBroadcast: vi.fn(() => () => undefined),
    };

    await adapter.join('room-1', {
      user: { id: 'u1', color: '#2563eb' },
      mode: 'canvas',
      updatedAt: '2026-05-13T00:00:00.000Z',
    });
    await adapter.updatePresence({ selection: { type: 'canvas-element', id: 'rect-1', elementKind: 'rectangle' } });
    await adapter.broadcast({ type: 'tool', payload: { tool: 'rectangle' } });

    expect(members[0].selection).toEqual({ type: 'canvas-element', id: 'rect-1', elementKind: 'rectangle' });
    expect(adapter.broadcast).toHaveBeenCalledWith({ type: 'tool', payload: { tool: 'rectangle' } });
  });
});
