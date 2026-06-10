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
export function renderDiagram(diag: IOMDiagram, options?: { isWatermarkEnabled?: boolean }): string {
  let svgStr = '';
  switch (diag.kind) {
    case 'class':      svgStr = renderClassDiagram(diag); break;
    case 'usecase':    svgStr = renderUseCaseDiagram(diag); break;
    case 'component':
    case 'deployment': svgStr = renderComponentDiagram(diag); break;
    case 'sequence':   svgStr = renderSequenceDiagram(diag); break;
    case 'activity':
    case 'state':      svgStr = renderStateOrActivityDiagram(diag); break;
    case 'collaboration': svgStr = renderCollaborationDiagram(diag); break;
    case 'flow':       svgStr = renderFlowDiagram(diag); break;
  }

  if (options?.isWatermarkEnabled) {
    const watermarkStr = `\n  <text x="100%" y="100%" dx="-20" dy="-20" text-anchor="end" font-family="DM Sans, system-ui, sans-serif" font-size="12" fill="var(--iso-text-muted)" opacity="0.5" pointer-events="none">Generated with Isomorph</text>\n</svg>`;
    return svgStr.replace(/<\/svg>\s*$/, watermarkStr);
  }

  return svgStr;
}
