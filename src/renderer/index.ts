import type { IOMDiagram } from '../semantics/iom.js';
import { renderClassDiagram } from './class-renderer.js';
import { renderUseCaseDiagram } from './usecase-renderer.js';
import { renderComponentDiagram } from './component-renderer.js';
import { renderFlowDiagram } from './flow-renderer.js';
import { renderSequenceDiagram } from './sequence-renderer.js';
import { renderStateOrActivityDiagram } from './state-renderer.js';
import { renderCollaborationDiagram } from './collaboration-renderer.js';

export { renderClassDiagram } from './class-renderer.js';
export { renderUseCaseDiagram } from './usecase-renderer.js';
export { renderComponentDiagram } from './component-renderer.js';
export { renderFlowDiagram } from './flow-renderer.js';
export { renderSequenceDiagram } from './sequence-renderer.js';
export { renderStateOrActivityDiagram } from './state-renderer.js';
export { renderCollaborationDiagram } from './collaboration-renderer.js';

/**
 * Render any IOMDiagram to an SVG string.
 * Dispatches to the appropriate renderer based on diagram kind.
 */
export function renderDiagram(diag: IOMDiagram): string {
  switch (diag.kind) {
    case 'class':      return renderClassDiagram(diag);
    case 'usecase':    return renderUseCaseDiagram(diag);
    case 'component':
    case 'deployment': return renderComponentDiagram(diag);
    case 'sequence':   return renderSequenceDiagram(diag);
    case 'activity':
    case 'state':      return renderStateOrActivityDiagram(diag);
    case 'collaboration': return renderCollaborationDiagram(diag);
    case 'flow':       return renderFlowDiagram(diag);
  }
}
