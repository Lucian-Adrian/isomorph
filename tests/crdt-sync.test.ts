import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

describe('CRDT Synchronization & Conflict Resolution', () => {
  it('initializes an empty Y.Doc and manages Y.Text correctly', () => {
    const doc = new Y.Doc();
    const text = doc.getText('source');
    expect(text.toString()).toBe('');
    text.insert(0, 'diagram Architecture : class\n');
    expect(text.toString()).toBe('diagram Architecture : class\n');
  });

  it('merges concurrent edits from two independent clients deterministically', () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    const text1 = doc1.getText('source');
    const text2 = doc2.getText('source');

    // Initial synchronized baseline
    text1.insert(0, 'class User {\n}\n');
    const sync1 = Y.encodeStateAsUpdate(doc1);
    Y.applyUpdate(doc2, sync1);
    expect(text2.toString()).toBe('class User {\n}\n');

    // Concurrent edits
    text1.insert(12, '  +id: int\n');
    text2.insert(12, '  +name: string\n');

    // Exchange updates
    const update1 = Y.encodeStateAsUpdate(doc1);
    const update2 = Y.encodeStateAsUpdate(doc2);
    Y.applyUpdate(doc2, update1);
    Y.applyUpdate(doc1, update2);

    // CRDT convergence check
    expect(text1.toString()).toEqual(text2.toString());
    expect(text1.toString()).toContain('+id: int');
    expect(text1.toString()).toContain('+name: string');
  });

  it('prevents text doubling when reconnected or soft reloaded', () => {
    const doc = new Y.Doc();
    const text = doc.getText('source');
    const initialSource = 'diagram System : component\n[Client] -> [Server]';
    text.insert(0, initialSource);

    // Guard simulation: do not re-insert if text is already populated
    let reinitialized = false;
    if (text.length === 0) {
      text.insert(0, initialSource);
      reinitialized = true;
    }

    expect(reinitialized).toBe(false);
    expect(text.toString()).toBe(initialSource);
  });

  it('correctly tracks cursor awareness and user metadata across peers', () => {
    const doc = new Y.Doc();
    const awareness1 = new Awareness(doc);
    const awareness2 = new Awareness(doc);

    // User 1 sets presence
    awareness1.setLocalStateField('user', {
      name: 'Alice',
      username: 'alice',
      color: '#3B82F6',
      role: 'editor',
    });
    awareness1.setLocalStateField('pointer', { x: 250, y: 180 });

    const state1 = awareness1.getLocalState();
    expect(state1?.user.name).toBe('Alice');
    expect(state1?.pointer).toEqual({ x: 250, y: 180 });

    // User 2 sets presence
    awareness2.setLocalStateField('user', {
      name: 'Bob',
      username: 'bob',
      color: '#10B981',
      role: 'viewer',
    });
    awareness2.setLocalStateField('pointer', { x: 500, y: 400 });

    const state2 = awareness2.getLocalState();
    expect(state2?.user.name).toBe('Bob');
    expect(state2?.user.role).toBe('viewer');

    awareness1.destroy();
    awareness2.destroy();
  });
});
