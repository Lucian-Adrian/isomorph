import { parseCanvasStateText, serializeCanvasState } from '../canvas/canvasSerialization.js';

export function canvasStorageKeyForTab(tabId: string): string {
  return `isomorph-canvas:${tabId}`;
}

export function restoreRemoteCanvasState(
  tabId: string,
  canvasStateText: string | null | undefined,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
): boolean {
  const key = canvasStorageKeyForTab(tabId);
  if (!canvasStateText || canvasStateText.trim().length === 0) {
    storage.removeItem(key);
    return false;
  }

  const normalized = serializeCanvasState(parseCanvasStateText(canvasStateText));
  storage.setItem(key, normalized);
  return true;
}
