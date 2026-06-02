import { CANVAS_STATE_VERSION, type CanvasElement, type CanvasElementKind, type CanvasState } from './canvasTypes.js';
import { DEFAULT_CANVAS_STYLE, normalizeCanvasStyle } from './canvasStyle.js';
import { validateCanvasState } from './canvasValidation.js';

const KNOWN_KINDS = new Set<CanvasElementKind>([
  'rectangle',
  'ellipse',
  'arrow',
  'line',
  'pen',
  'text',
  'image',
  'eraser',
  'frame',
  'embed',
  'laser',
  'lasso',
  'uml-package',
  'unknown',
]);

export function createEmptyCanvasState(now = new Date().toISOString()): CanvasState {
  return {
    version: CANVAS_STATE_VERSION,
    viewport: { x: 0, y: 0, zoom: 1 },
    activeTool: 'select',
    locked: false,
    selectedElementIds: [],
    elements: [],
    styleDefaults: DEFAULT_CANVAS_STYLE,
    draftSemanticLinks: [],
    updatedAt: now,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function normalizeElement(rawElement: unknown, index: number, now: string): CanvasElement {
  const raw = asRecord(rawElement);
  const kind = KNOWN_KINDS.has(raw.kind as CanvasElementKind) ? raw.kind as CanvasElementKind : 'unknown';
  const bounds = asRecord(raw.bounds);
  const element = {
    ...raw,
    id: String(raw.id || `imported-${index}`),
    kind,
    bounds: {
      x: Number(bounds.x ?? 0),
      y: Number(bounds.y ?? 0),
      width: Math.max(1, Number(bounds.width ?? 1)),
      height: Math.max(1, Number(bounds.height ?? 1)),
    },
    rotation: Number(raw.rotation ?? 0),
    locked: Boolean(raw.locked),
    layer: Number(raw.layer ?? index),
    style: normalizeCanvasStyle(raw.style as Partial<typeof DEFAULT_CANVAS_STYLE>),
    createdAt: String(raw.createdAt || now),
    updatedAt: String(raw.updatedAt || now),
    raw: kind === 'unknown' ? rawElement : raw.raw,
  };
  return element as CanvasElement;
}

export function normalizeCanvasState(input: unknown, now = new Date().toISOString()): CanvasState {
  const raw = asRecord(input);
  const viewport = asRecord(raw.viewport);
  const selected = Array.isArray(raw.selectedElementIds) ? raw.selectedElementIds.map(String) : [];
  const elements = Array.isArray(raw.elements)
    ? raw.elements.map((element, index) => normalizeElement(element, index, now))
    : [];

  return validateCanvasState({
    version: CANVAS_STATE_VERSION,
    viewport: {
      x: Number(viewport.x ?? 0),
      y: Number(viewport.y ?? 0),
      zoom: Math.min(8, Math.max(0.05, Number(viewport.zoom ?? 1))),
    },
    activeTool: typeof raw.activeTool === 'string' ? (raw.activeTool as CanvasState['activeTool']) : 'select',
    locked: Boolean(raw.locked),
    selectedElementIds: selected.filter(id => elements.some(element => element.id === id)),
    elements,
    styleDefaults: normalizeCanvasStyle(raw.styleDefaults as Partial<typeof DEFAULT_CANVAS_STYLE>),
    draftSemanticLinks: Array.isArray(raw.draftSemanticLinks) ? raw.draftSemanticLinks as CanvasState['draftSemanticLinks'] : [],
    updatedAt: String(raw.updatedAt || now),
  }).state;
}

export function serializeCanvasState(state: CanvasState): string {
  return JSON.stringify(normalizeCanvasState(state, state.updatedAt), null, 2);
}

export function parseCanvasStateText(text: string | null | undefined): CanvasState {
  if (!text || !text.trim()) return createEmptyCanvasState();
  try {
    return normalizeCanvasState(JSON.parse(text));
  } catch {
    return createEmptyCanvasState();
  }
}
