import type { CanvasBounds, CanvasElement, CanvasPoint, CanvasState } from './canvasTypes.js';
import { CANVAS_STATE_VERSION } from './canvasTypes.js';
import { DEFAULT_CANVAS_STYLE, normalizeCanvasStyle } from './canvasStyle.js';

export interface CanvasValidationIssue {
  code:
    | 'canvas.too_many_elements'
    | 'canvas.too_many_points'
    | 'canvas.invalid_bounds'
    | 'canvas.invalid_point'
    | 'canvas.missing_selection_target'
    | 'canvas.missing_draft_link_target';
  message: string;
  elementId?: string;
}

export interface CanvasValidationOptions {
  maxElements?: number;
  maxPoints?: number;
}

export interface CanvasValidationResult {
  state: CanvasState;
  issues: CanvasValidationIssue[];
}

const DEFAULT_MAX_ELEMENTS = 5000;
const DEFAULT_MAX_POINTS = 50000;

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function validateBounds(bounds: CanvasBounds, elementId: string, issues: CanvasValidationIssue[]): CanvasBounds {
  const hadInvalidValue = !Number.isFinite(bounds.x)
    || !Number.isFinite(bounds.y)
    || !Number.isFinite(bounds.width)
    || !Number.isFinite(bounds.height)
    || bounds.width <= 0
    || bounds.height <= 0;
  if (hadInvalidValue) {
    issues.push({
      code: 'canvas.invalid_bounds',
      message: `Canvas element '${elementId}' had invalid bounds and was normalized.`,
      elementId,
    });
  }
  return {
    x: finite(bounds.x),
    y: finite(bounds.y),
    width: Math.max(1, finite(bounds.width, 1)),
    height: Math.max(1, finite(bounds.height, 1)),
  };
}

function validatePoints(points: CanvasPoint[] | undefined, elementId: string, issues: CanvasValidationIssue[]): CanvasPoint[] | undefined {
  if (!points) return undefined;
  const validPoints = points.map(point => {
    const x = finite(point.x);
    const y = finite(point.y);
    if (x !== point.x || y !== point.y) {
      issues.push({
        code: 'canvas.invalid_point',
        message: `Canvas element '${elementId}' had an invalid point and was normalized.`,
        elementId,
      });
    }
    return { x, y };
  });
  return validPoints;
}

export function validateCanvasState(input: CanvasState, options: CanvasValidationOptions = {}): CanvasValidationResult {
  const issues: CanvasValidationIssue[] = [];
  const maxElements = Math.max(0, options.maxElements ?? DEFAULT_MAX_ELEMENTS);
  const maxPoints = Math.max(0, options.maxPoints ?? DEFAULT_MAX_POINTS);
  const rawElements = Array.isArray(input.elements) ? input.elements : [];
  const elements = rawElements.slice(0, maxElements).map((element, index) => {
    const normalized = {
      ...element,
      layer: Number.isFinite(element.layer) ? element.layer : index,
      bounds: validateBounds(element.bounds, element.id, issues),
      style: normalizeCanvasStyle(element.style ?? DEFAULT_CANVAS_STYLE),
    } as CanvasElement;
    if ('points' in normalized) {
      return {
        ...normalized,
        points: validatePoints(normalized.points, normalized.id, issues) ?? [],
      } as CanvasElement;
    }
    return normalized;
  });

  if (rawElements.length > maxElements) {
    issues.push({
      code: 'canvas.too_many_elements',
      message: `Canvas state has ${rawElements.length} elements; only ${maxElements} were kept for performance.`,
    });
  }

  let totalPoints = 0;
  const pointLimitedElements = elements.map(element => {
    if (!('points' in element)) return element;
    const allowed = Math.max(0, maxPoints - totalPoints);
    const nextPoints = element.points.slice(0, allowed);
    totalPoints += nextPoints.length;
    if (nextPoints.length < element.points.length) {
      issues.push({
        code: 'canvas.too_many_points',
        message: `Canvas element '${element.id}' exceeded the global point budget and was truncated.`,
        elementId: element.id,
      });
    }
    return { ...element, points: nextPoints } as CanvasElement;
  });

  const elementIds = new Set(pointLimitedElements.map(element => element.id));
  const selectedElementIds = input.selectedElementIds.filter(id => {
    const exists = elementIds.has(id);
    if (!exists) {
      issues.push({
        code: 'canvas.missing_selection_target',
        message: `Canvas selection referenced missing element '${id}'.`,
        elementId: id,
      });
    }
    return exists;
  });
  const draftSemanticLinks = input.draftSemanticLinks.filter(link => {
    const exists = elementIds.has(link.canvasElementId);
    if (!exists) {
      issues.push({
        code: 'canvas.missing_draft_link_target',
        message: `Canvas draft link '${link.id}' referenced missing element '${link.canvasElementId}'.`,
        elementId: link.canvasElementId,
      });
    }
    return exists;
  });

  return {
    issues,
    state: {
      ...input,
      version: CANVAS_STATE_VERSION,
      viewport: {
        x: finite(input.viewport.x),
        y: finite(input.viewport.y),
        zoom: Math.min(8, Math.max(0.05, finite(input.viewport.zoom, 1))),
      },
      elements: pointLimitedElements.map((element, layer) => ({ ...element, layer })),
      selectedElementIds,
      draftSemanticLinks,
      styleDefaults: normalizeCanvasStyle(input.styleDefaults),
    },
  };
}
