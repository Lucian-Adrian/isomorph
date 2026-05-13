export type WorkspaceSelection =
  | { type: 'none' }
  | { type: 'source'; range?: { from: number; to: number } }
  | { type: 'entity'; id: string; diagramName?: string }
  | { type: 'relation'; id: string; diagramName?: string }
  | { type: 'canvas-element'; id: string; elementKind: string }
  | { type: 'error'; id: string; message: string; line?: number; column?: number };

export type DiagramRailMode = 'stencils' | 'entity-properties' | 'relation-editor' | 'canvas-style' | 'fix-suggestions';

export function rightRailModeForSelection(selection: WorkspaceSelection): DiagramRailMode {
  switch (selection.type) {
    case 'entity':
      return 'entity-properties';
    case 'relation':
      return 'relation-editor';
    case 'canvas-element':
      return 'canvas-style';
    case 'error':
      return 'fix-suggestions';
    case 'source':
    case 'none':
    default:
      return 'stencils';
  }
}

export function selectionBelongsToDiagramSurface(selection: WorkspaceSelection): boolean {
  return selection.type === 'entity' || selection.type === 'relation' || selection.type === 'canvas-element';
}

export function selectionLabel(selection: WorkspaceSelection): string {
  switch (selection.type) {
    case 'none':
      return 'No selection';
    case 'source':
      return 'Source selection';
    case 'entity':
      return `Entity ${selection.id}`;
    case 'relation':
      return `Relation ${selection.id}`;
    case 'canvas-element':
      return `${selection.elementKind} ${selection.id}`;
    case 'error':
      return selection.line ? `Problem on line ${selection.line}` : 'Problem';
  }
}
