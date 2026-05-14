import type { WorkspaceMode } from './modeState.js';
import type { WorkspaceSelection } from './selectionState.js';

export type WorkspaceCommandId =
  | 'validate'
  | 'generate'
  | 'sync'
  | 'share'
  | 'export'
  | 'report'
  | 'enter-canvas'
  | 'back-to-ide'
  | 'open-account'
  | 'open-cloud-files'
  | 'open-source-view'
  | 'fit-canvas'
  | 'toggle-lock';

export interface WorkspaceCommandContext {
  mode: WorkspaceMode;
  hasDiagram: boolean;
  hasSource: boolean;
  isAuthenticated: boolean;
  selection: WorkspaceSelection;
}

export interface WorkspaceCommandAvailability {
  id: WorkspaceCommandId;
  enabled: boolean;
  reason?: string;
}

const IDE_ONLY: WorkspaceCommandId[] = ['generate', 'report', 'enter-canvas', 'open-account', 'open-cloud-files'];
const CANVAS_ONLY: WorkspaceCommandId[] = ['back-to-ide', 'open-source-view', 'fit-canvas', 'toggle-lock'];
const DIAGRAM_REQUIRED: WorkspaceCommandId[] = ['export', 'enter-canvas', 'fit-canvas'];
const SOURCE_REQUIRED: WorkspaceCommandId[] = ['validate', 'generate', 'sync', 'share'];
const AUTH_REQUIRED: WorkspaceCommandId[] = ['sync', 'share', 'open-cloud-files'];

export function evaluateWorkspaceCommand(
  id: WorkspaceCommandId,
  context: WorkspaceCommandContext,
): WorkspaceCommandAvailability {
  if (IDE_ONLY.includes(id) && context.mode !== 'ide') {
    return { id, enabled: false, reason: 'Available in IDE mode only.' };
  }

  if (CANVAS_ONLY.includes(id) && context.mode !== 'canvas') {
    return { id, enabled: false, reason: 'Available in Canvas mode only.' };
  }

  if (DIAGRAM_REQUIRED.includes(id) && !context.hasDiagram) {
    return { id, enabled: false, reason: 'Open a diagram first.' };
  }

  if (SOURCE_REQUIRED.includes(id) && !context.hasSource) {
    return { id, enabled: false, reason: 'Open a source file first.' };
  }

  if (AUTH_REQUIRED.includes(id) && !context.isAuthenticated) {
    return { id, enabled: false, reason: 'Sign in to use cloud features.' };
  }

  return { id, enabled: true };
}

export function evaluateWorkspaceCommands(
  ids: WorkspaceCommandId[],
  context: WorkspaceCommandContext,
): WorkspaceCommandAvailability[] {
  return ids.map(id => evaluateWorkspaceCommand(id, context));
}
