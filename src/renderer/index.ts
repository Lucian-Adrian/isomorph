import type { IOMDiagram } from '../semantics/iom.js';
import { renderClassDiagram } from './class-renderer.js';
import { renderUseCaseDiagram } from './usecase-renderer.js';

export { renderClassDiagram } from './class-renderer.js';
export { renderUseCaseDiagram } from './usecase-renderer.js';

/**
 * Render any IOMDiagram to an SVG string.
 * Dispatches to the appropriate renderer based on diagram kind.
 */
export function renderDiagram(diag: IOMDiagram): string {
  switch (diag.kind) {
    case 'class':      return renderClassDiagram(diag);
    case 'usecase':    return renderUseCaseDiagram(diag);
    // For unimplemented kinds, fall back to class renderer
    default:           return renderClassDiagram(diag);
  }
}
