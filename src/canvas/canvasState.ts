import type { CanvasElement, CanvasState, CanvasStateAction } from './canvasTypes.js';
import { normalizeCanvasStyle } from './canvasStyle.js';

function stamp<T extends CanvasState>(state: T): T {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
  };
}

function updateElement(elements: CanvasElement[], id: string, patch: Partial<CanvasElement>) {
  return elements.map(element => {
    if (element.id !== id) return element;
    return {
      ...element,
      ...patch,
      style: patch.style ? normalizeCanvasStyle(patch.style) : element.style,
      updatedAt: new Date().toISOString(),
    } as CanvasElement;
  });
}

function reorder(elements: CanvasElement[], ids: string[], direction: 'forward' | 'backward') {
  const selected = new Set(ids);
  const ordered = [...elements].sort((a, b) => a.layer - b.layer);
  if (direction === 'forward') {
    for (let index = ordered.length - 2; index >= 0; index -= 1) {
      if (selected.has(ordered[index].id) && !selected.has(ordered[index + 1].id)) {
        [ordered[index], ordered[index + 1]] = [ordered[index + 1], ordered[index]];
      }
    }
  } else {
    for (let index = 1; index < ordered.length; index += 1) {
      if (selected.has(ordered[index].id) && !selected.has(ordered[index - 1].id)) {
        [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]];
      }
    }
  }
  return ordered.map((element, index) => ({ ...element, layer: index }));
}

export function reduceCanvasState(state: CanvasState, action: CanvasStateAction): CanvasState {
  switch (action.type) {
    case 'set-tool':
      return stamp({ ...state, activeTool: action.tool });
    case 'set-viewport':
      return stamp({
        ...state,
        viewport: {
          ...state.viewport,
          ...action.viewport,
          zoom: action.viewport.zoom === undefined ? state.viewport.zoom : Math.min(8, Math.max(0.05, action.viewport.zoom)),
        },
      });
    case 'select': {
      const nextIds = action.append ? Array.from(new Set([...state.selectedElementIds, ...action.ids])) : action.ids;
      const existing = new Set(state.elements.map(element => element.id));
      return stamp({ ...state, selectedElementIds: nextIds.filter(id => existing.has(id)) });
    }
    case 'clear-selection':
      return stamp({ ...state, selectedElementIds: [] });
    case 'add-element':
      return stamp({
        ...state,
        elements: [...state.elements, { ...action.element, layer: state.elements.length }],
        selectedElementIds: [action.element.id],
      });
    case 'update-element':
      return stamp({ ...state, elements: updateElement(state.elements, action.id, action.patch) });
    case 'delete-elements': {
      const deleted = new Set(action.ids);
      return stamp({
        ...state,
        elements: state.elements.filter(element => !deleted.has(element.id)).map((element, layer) => ({ ...element, layer })),
        selectedElementIds: state.selectedElementIds.filter(id => !deleted.has(id)),
        draftSemanticLinks: state.draftSemanticLinks.filter(link => !deleted.has(link.canvasElementId)),
      });
    }
    case 'set-lock': {
      if (!action.ids) return stamp({ ...state, locked: action.locked });
      const ids = new Set(action.ids);
      return stamp({
        ...state,
        elements: state.elements.map(element => ids.has(element.id) ? { ...element, locked: action.locked } : element),
      });
    }
    case 'bring-forward':
      return stamp({ ...state, elements: reorder(state.elements, action.ids, 'forward') });
    case 'send-backward':
      return stamp({ ...state, elements: reorder(state.elements, action.ids, 'backward') });
    case 'set-style-defaults':
      return stamp({ ...state, styleDefaults: normalizeCanvasStyle({ ...state.styleDefaults, ...action.style }) });
    case 'add-draft-link':
      return stamp({ ...state, draftSemanticLinks: [...state.draftSemanticLinks, action.link] });
    case 'upsert-draft-link': {
      const exists = state.draftSemanticLinks.some(link => link.canvasElementId === action.link.canvasElementId);
      return stamp({
        ...state,
        draftSemanticLinks: exists
          ? state.draftSemanticLinks.map(link => link.canvasElementId === action.link.canvasElementId ? action.link : link)
          : [...state.draftSemanticLinks, action.link],
      });
    }
    default:
      return state;
  }
}
