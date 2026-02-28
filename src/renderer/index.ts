import type { IOMDiagram } from '../semantics/iom.js';
import { renderClassDiagram } from './class-renderer.js';
import { renderUseCaseDiagram } from './usecase-renderer.js';
import { renderComponentDiagram, renderPlaceholderDiagram } from './component-renderer.js';

export { renderClassDiagram } from './class-renderer.js';
export { renderUseCaseDiagram } from './usecase-renderer.js';
export { renderComponentDiagram, renderPlaceholderDiagram } from './component-renderer.js';

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
    // Sequence and flow diagrams: render a styled informational placeholder
    // rather than incorrectly reusing the class renderer (MF-1)
    case 'sequence':
    case 'flow':       return renderPlaceholderDiagram(diag);
  }
}
