import { useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { listDiagrams, saveDiagram, type SavedDiagram } from './diagramStore.js';

export function useDiagramSync(user: User | null) {
  const [remoteDiagrams, setRemoteDiagrams] = useState<SavedDiagram[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagrams = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listDiagrams(user);
      setRemoteDiagrams(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  const pushDiagram = useCallback(async (input: {
    title: string;
    source: string;
    canvasState: string | null;
    activeDiagramName?: string;
    existingId?: string;
  }) => {
    if (!user) throw new Error('User must be logged in to save diagrams.');
    setLoading(true);
    setError(null);
    try {
      const saved = await saveDiagram({
        user,
        title: input.title,
        source: input.source,
        canvasState: input.canvasState,
        activeDiagramName: input.activeDiagramName,
        existingId: input.existingId,
        currentFileCount: remoteDiagrams.length,
      });
      // Refresh list
      const list = await listDiagrams(user);
      setRemoteDiagrams(list);
      return saved;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, remoteDiagrams.length]);

  return {
    remoteDiagrams,
    setRemoteDiagrams,
    loading,
    error,
    fetchDiagrams,
    pushDiagram,
  };
}
