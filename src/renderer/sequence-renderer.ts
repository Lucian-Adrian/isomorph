// ============================================================
// Sequence Diagram SVG Renderer
// ============================================================
import type { IOMDiagram } from '../semantics/iom.js';
import { escapeXml, svgDefs } from './utils.js';

export function renderSequenceDiagram(diag: IOMDiagram): string {
  const entities = Array.from(diag.entities.values());
  if (entities.length === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" style="font-family:Segoe UI,Arial,sans-serif;background:#fafafa"><text x="20" y="40">Empty Sequence Diagram</text></svg>`;

  const paddingX = 80;
  const colSpacing = 160;
  const paddingY = 60;
  const rowSpacing = 60;
  
  const width = paddingX * 2 + Math.max(0, entities.length - 1) * colSpacing;
  const height = paddingY * 2 + 40 + Math.max(0, diag.relations.length) * rowSpacing + 60;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="font-family:Segoe UI,Arial,sans-serif;background:#fafafa">\n`;
  svg += svgDefs();

  // Entities as columns
  const entityX = new Map<string, number>();
  let currentX = paddingX;
  for (const ent of entities) {
    entityX.set(ent.name, currentX);
    const isActor = ent.kind === 'actor' || ent.stereotype === 'actor';
    const label = escapeXml(ent.name);
    
    svg += `  <g transform="translate(${currentX},${paddingY})" data-entity-name="${label}">\n`;
    if (isActor) {
      svg += `    <circle cx="0" cy="0" r="8" fill="#bfdbfe" stroke="#475569" stroke-width="1.5" />\n`;
      svg += `    <path d="M0,8 v12 M-8,14 h16 M-4,30 l4,-10 l4,10" stroke="#475569" stroke-width="1.5" fill="none" />\n`;
      svg += `    <text x="0" y="46" text-anchor="middle" font-size="12" font-weight="600" fill="#1e293b">${label}</text>\n`;
    } else {
      svg += `    <rect x="-50" y="-15" width="100" height="30" rx="4" fill="#bfdbfe" stroke="#3b82f6" stroke-width="1.5" filter="url(#shadow)" />\n`;
      svg += `    <text x="0" y="4" text-anchor="middle" font-size="12" font-weight="600" fill="#1e293b">${label}</text>\n`;
    }
    
    // Lifeline
    svg += `    <line x1="0" y1="${isActor ? 50 : 20}" x2="0" y2="${height - paddingY - 20}" stroke="#94a3b8" stroke-dasharray="4,4" />\n`;
    
    svg += `  </g>\n`;
    currentX += colSpacing;
  }

  // Relations as messages
  let currentY = paddingY + 80;
  for (const rel of diag.relations) {
    const startX = entityX.get(rel.from);
    const endX = entityX.get(rel.to);
    if (startX !== undefined && endX !== undefined) {
      const isRight = endX > startX;
      // const arrowX = isRight ? endX - 6 : endX + 6;
      const dash = rel.kind === 'dependency' || rel.kind === 'realization' ? ' stroke-dasharray="6,3"' : '';
      
      svg += `  <g data-relation-id="${escapeXml(rel.id)}" data-relation-from="${escapeXml(rel.from)}" data-relation-to="${escapeXml(rel.to)}" data-relation-kind="${escapeXml(rel.kind)}">\n`;
      // Hitbox
      svg += `    <line x1="${startX}" y1="${currentY}" x2="${endX}" y2="${currentY}" stroke="transparent" stroke-width="15" style="cursor: pointer"/>\n`;
      svg += `    <line x1="${startX}" y1="${currentY}" x2="${endX}" y2="${currentY}" stroke="#475569" stroke-width="1.5"${dash} />\n`;
      
      if (isRight) {
        svg += `    <polygon points="${endX},${currentY} ${endX-10},${currentY-4} ${endX-10},${currentY+4}" fill="#475569" />\n`;
      } else {
        svg += `    <polygon points="${endX},${currentY} ${endX+10},${currentY-4} ${endX+10},${currentY+4}" fill="#475569" />\n`;
      }

      const labelTxt = rel.label ? escapeXml(rel.label) : '';
      if (labelTxt) {
        svg += `    <text x="${Math.min(startX, endX) + Math.abs(endX - startX)/2}" y="${currentY - 6}" text-anchor="middle" font-size="11" fill="#475569">${labelTxt}</text>\n`;
      }
      svg += `  </g>\n`;
      currentY += rowSpacing;
    }
  }

  svg += `</svg>`;
  return svg;
}