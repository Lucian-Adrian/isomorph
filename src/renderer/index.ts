import type { IOMDiagram } from '../semantics/iom.js';
import { renderClassDiagram } from './class-renderer.js';
import { renderUseCaseDiagram } from './usecase-renderer.js';
import { renderComponentDiagram } from './component-renderer.js';
import { renderFlowDiagram } from './flow-renderer.js';
import { renderSequenceDiagram } from './sequence-renderer.js';
import { renderStateOrActivityDiagram } from './state-renderer.js';
import { renderCollaborationDiagram } from './collaboration-renderer.js';
import { escapeXml, svgDefs } from './utils.js';

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

/**
 * Render multiple diagrams side-by-side in horizontal frames.
 */
export function renderMultipleDiagrams(diagrams: IOMDiagram[]): string {
  const frameW = 1200;
  const frameH = 900;
  const gap = 1250;
  const totalW = diagrams.length * gap;
  const totalH = 1100;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" font-family="DM Sans, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" style="background:transparent">\n`;
  svg += svgDefs();

  diagrams.forEach((diag, index) => {
    const offsetX = index * gap;
    const offsetY = 100;

    // Draw the frame group
    svg += `  <g transform="translate(${offsetX}, ${offsetY})" data-diagram-name="${escapeXml(diag.name)}" data-diagram-kind="${escapeXml(diag.kind)}">\n`;

    // Frame border and background
    svg += `    <rect x="0" y="0" width="${frameW}" height="${frameH}" rx="8" ry="8" fill="var(--iso-bg-panel, #ffffff)" stroke="var(--iso-border-color, #e2e8f0)" stroke-width="2" />\n`;

    // Header bar background
    svg += `    <rect x="0" y="0" width="${frameW}" height="40" rx="8" ry="8" fill="var(--iso-bg-header, #f8fafc)" stroke="var(--iso-border-color, #e2e8f0)" stroke-width="2" />\n`;
    svg += `    <rect x="2" y="20" width="${frameW - 4}" height="20" fill="var(--iso-bg-header, #f8fafc)" />\n`;
    svg += `    <line x1="0" y1="40" x2="${frameW}" y2="40" stroke="var(--iso-border-color, #e2e8f0)" stroke-width="2" />\n`;

    // Header label
    svg += `    <text x="16" y="25" fill="var(--iso-text, #1e293b)" font-size="14" font-weight="bold" font-family="DM Sans, system-ui, -apple-system, sans-serif">diagram ${escapeXml(diag.name)} : ${escapeXml(diag.kind)}</text>\n`;

    // Render individual diagram content
    let content = renderDiagram(diag);
    // Strip opening <svg> and closing </svg>
    content = content.replace(/^<svg[^>]*>/i, '');
    content = content.replace(/<\/svg>\s*$/i, '');

    // Translate diagram content below header bar
    svg += `    <g transform="translate(0, 40)">\n`;
    svg += content;
    svg += `    </g>\n`;

    svg += `  </g>\n`;
  });

  svg += `</svg>`;
  return svg;
}
