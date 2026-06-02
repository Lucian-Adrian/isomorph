export const CANVAS_STATE_VERSION = 1;

export type CanvasToolId =
  | 'lock'
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'pen'
  | 'text'
  | 'image'
  | 'eraser'
  | 'frame'
  | 'embed'
  | 'laser'
  | 'lasso'
  | 'uml-package';

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasBounds extends CanvasPoint {
  width: number;
  height: number;
}

export interface CanvasViewport extends CanvasPoint {
  zoom: number;
}

export interface CanvasStyle {
  stroke: string;
  fill: string;
  text: string;
  strokeWidth: number;
  opacity: number;
  roughness: number;
}

export interface CanvasElementBase {
  id: string;
  kind: CanvasElementKind;
  bounds: CanvasBounds;
  rotation: number;
  locked: boolean;
  layer: number;
  style: CanvasStyle;
  createdAt: string;
  updatedAt: string;
  semanticRef?: string;
}

export type CanvasElementKind =
  | 'rectangle'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'pen'
  | 'text'
  | 'image'
  | 'eraser'
  | 'frame'
  | 'embed'
  | 'laser'
  | 'lasso'
  | 'uml-package'
  | 'unknown';

export interface CanvasLinearElement extends CanvasElementBase {
  kind: 'arrow' | 'line';
  points: CanvasPoint[];
  startBinding?: string;
  endBinding?: string;
  label?: string;
}

export interface CanvasPenElement extends CanvasElementBase {
  kind: 'pen' | 'eraser' | 'laser' | 'lasso';
  points: CanvasPoint[];
}

export interface CanvasTextElement extends CanvasElementBase {
  kind: 'text';
  text: string;
  fontSize: number;
}

export interface CanvasImageElement extends CanvasElementBase {
  kind: 'image';
  src: string;
  alt: string;
  fit?: 'contain' | 'cover' | 'stretch';
}

export interface CanvasEmbedElement extends CanvasElementBase {
  kind: 'embed';
  url: string;
  title?: string;
}

export interface CanvasFrameElement extends CanvasElementBase {
  kind: 'frame' | 'uml-package';
  title: string;
  children: string[];
}

export interface CanvasShapeElement extends CanvasElementBase {
  kind: 'rectangle' | 'ellipse' | 'unknown';
  text?: string;
  raw?: unknown;
}

export type CanvasElement =
  | CanvasShapeElement
  | CanvasLinearElement
  | CanvasPenElement
  | CanvasTextElement
  | CanvasImageElement
  | CanvasEmbedElement
  | CanvasFrameElement;

export interface CanvasDraftSemanticLink {
  id: string;
  canvasElementId: string;
  targetKind: 'entity' | 'relation' | 'package';
  status: 'draft' | 'committed' | 'unresolved';
  reason?: string;
}

export interface CanvasState {
  version: number;
  viewport: CanvasViewport;
  activeTool: CanvasToolId;
  locked: boolean;
  selectedElementIds: string[];
  elements: CanvasElement[];
  styleDefaults: CanvasStyle;
  draftSemanticLinks: CanvasDraftSemanticLink[];
  updatedAt: string;
}

export type CanvasStateAction =
  | { type: 'set-tool'; tool: CanvasToolId }
  | { type: 'set-viewport'; viewport: Partial<CanvasViewport> }
  | { type: 'select'; ids: string[]; append?: boolean }
  | { type: 'clear-selection' }
  | { type: 'add-element'; element: CanvasElement }
  | { type: 'update-element'; id: string; patch: Partial<CanvasElement> }
  | { type: 'delete-elements'; ids: string[] }
  | { type: 'set-lock'; locked: boolean; ids?: string[] }
  | { type: 'bring-forward'; ids: string[] }
  | { type: 'send-backward'; ids: string[] }
  | { type: 'set-style-defaults'; style: Partial<CanvasStyle> }
  | { type: 'add-draft-link'; link: CanvasDraftSemanticLink }
  | { type: 'upsert-draft-link'; link: CanvasDraftSemanticLink };
