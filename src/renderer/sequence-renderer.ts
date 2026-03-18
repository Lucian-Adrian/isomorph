// ============================================================
// Sequence Diagram SVG Renderer (Enhanced)
// ============================================================
import type { IOMDiagram } from '../semantics/iom.js';
import { escapeXml, svgDefs } from './utils.js';

export function renderSequenceDiagram(diag: IOMDiagram): string {
  const entities = Array.from(diag.entities.values());
  if (entities.length === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" style="font-family:Segoe UI,Arial,sans-serif;background:#fafafa"><text x="20" y="40">Empty Sequence Diagram</text></svg>`;

  const paddingX = 80;
  const colSpacing = 180;
  const paddingY = 60;
  const rowSpacing = 60;
  const selfLoopWidth = 40;
  const selfLoopHeight = 30;
  const activationWidth = 12;

  // Count self-messages to allocate extra row height
  let selfMessageCount = 0;
  for (const rel of diag.relations) {
    if (rel.from === rel.to) selfMessageCount++;
  }

  let computedWidth = paddingX * 2 + Math.max(0, entities.length - 1) * colSpacing;
  const height = paddingY * 2 + 40 + Math.max(0, diag.relations.length) * rowSpacing + selfMessageCount * selfLoopHeight + 80;

  for (const ent of entities) {
    if (ent.position && ent.position.x !== undefined) {
      computedWidth = Math.max(computedWidth, ent.position.x + 160);
    }
  }
  const width = computedWidth;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="font-family:Segoe UI,Arial,sans-serif;background:#fafafa">\n`;
  svg += svgDefs();

  // --- Entities as columns ---
  const entityX = new Map<string, number>();
  let currentX = paddingX;

  for (const ent of entities) {
    let xPos = currentX;
    if (ent.position && ent.position.x !== undefined) {
      xPos = ent.position.x;
      currentX = Math.max(currentX, xPos) + colSpacing;
    } else {
      currentX += colSpacing;
    }
    entityX.set(ent.name, xPos);

    const isActor = ent.kind === 'actor' || ent.stereotype === 'actor';
    const label = escapeXml(ent.name);

    svg += `  <g transform="translate(${xPos},${paddingY})" data-entity-name="${label}">\n`;
    // Invisible hitbox for dragging
    svg += `    <rect x="-60" y="-35" width="120" height="${height - paddingY + 20}" fill="transparent" style="cursor: pointer;" />\n`;

    if (isActor) {
      // Actor stick figure with better proportions
      svg += `    <circle cx="0" cy="-4" r="10" fill="#dbeafe" stroke="#3b82f6" stroke-width="1.5" />\n`;
      svg += `    <path d="M0,6 v14 M-10,12 h20 M-6,30 l6,-10 l6,10" stroke="#3b82f6" stroke-width="1.5" fill="none" />\n`;
      svg += `    <text x="0" y="48" text-anchor="middle" font-size="13" font-weight="600" fill="#1e293b">${label}</text>\n`;
    } else {
      // Participant box with gradient and rounded corners
      svg += `    <rect x="-60" y="-20" width="120" height="36" rx="6" fill="#dbeafe" stroke="#3b82f6" stroke-width="1.5" filter="url(#shadow)" />\n`;
      svg += `    <text x="0" y="4" text-anchor="middle" font-size="13" font-weight="600" fill="#1e293b">${label}</text>\n`;
    }

    // Lifeline
    const lifelineStart = isActor ? 52 : 20;
    svg += `    <line x1="0" y1="${lifelineStart}" x2="0" y2="${height - paddingY - 30}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="6,4" />\n`;

    // Bottom box (mirror of top for participant)
    if (!isActor) {
      const bottomY = height - paddingY - 30;
      svg += `    <rect x="-60" y="${bottomY}" width="120" height="30" rx="6" fill="#dbeafe" stroke="#3b82f6" stroke-width="1.5" />\n`;
      svg += `    <text x="0" y="${bottomY + 19}" text-anchor="middle" font-size="12" font-weight="600" fill="#1e293b">${label}</text>\n`;
    }

    svg += `  </g>\n`;
  }

  // --- Relations as messages ---
  let currentY = paddingY + 80;
  for (const rel of diag.relations) {
    const startX = entityX.get(rel.from);
    const endX = entityX.get(rel.to);
    if (startX === undefined || endX === undefined) continue;

    const isDashed = rel.kind === 'dependency' || rel.kind === 'realization';
    const dash = isDashed ? ' stroke-dasharray="6,3"' : '';
    const labelTxt = rel.label ? escapeXml(rel.label) : '';
    const isSelfMessage = rel.from === rel.to;

    svg += `  <g data-relation-id="${escapeXml(rel.id)}" data-relation-from="${escapeXml(rel.from)}" data-relation-to="${escapeXml(rel.to)}" data-relation-kind="${escapeXml(rel.kind)}">\n`;

    if (isSelfMessage) {
      // Self-message loop
      const x = startX;
      const loopRight = x + selfLoopWidth;
      const y1 = currentY;
      const y2 = currentY + selfLoopHeight;

      // Hitbox
      svg += `    <rect x="${x}" y="${y1 - 5}" width="${selfLoopWidth + 10}" height="${selfLoopHeight + 10}" fill="transparent" style="cursor: pointer" />\n`;
      // Loop path
      svg += `    <path d="M${x},${y1} H${loopRight} V${y2} H${x}" stroke="#475569" stroke-width="1.5" fill="none"${dash} />\n`;
      // Arrowhead
      svg += `    <polygon points="${x},${y2} ${x + 8},${y2 - 4} ${x + 8},${y2 + 4}" fill="#475569" />\n`;
      // Activation box
      svg += `    <rect x="${x - activationWidth / 2}" y="${y1 - 4}" width="${activationWidth}" height="${selfLoopHeight + 8}" rx="2" fill="#e0e7ff" stroke="#6366f1" stroke-width="1" />\n`;

      if (labelTxt) {
        svg += `    <text x="${loopRight + 6}" y="${y1 + selfLoopHeight / 2 + 4}" font-size="11" fill="#475569">${labelTxt}</text>\n`;
      }

      currentY += rowSpacing + selfLoopHeight;
    } else {
      // Normal message
      const isRight = endX > startX;

      // Hitbox
      svg += `    <line x1="${startX}" y1="${currentY}" x2="${endX}" y2="${currentY}" stroke="transparent" stroke-width="15" style="cursor: pointer"/>\n`;

      // Activation box at sender
      svg += `    <rect x="${startX - activationWidth / 2}" y="${currentY - 10}" width="${activationWidth}" height="20" rx="2" fill="#e0e7ff" stroke="#6366f1" stroke-width="1" />\n`;

      // Message line
      svg += `    <line x1="${startX}" y1="${currentY}" x2="${endX}" y2="${currentY}" stroke="#475569" stroke-width="1.5"${dash} />\n`;

      // Arrowhead
      if (isDashed) {
        // Open arrowhead for return/dashed
        if (isRight) {
          svg += `    <path d="M${endX - 10},${currentY - 4} L${endX},${currentY} L${endX - 10},${currentY + 4}" stroke="#475569" stroke-width="1.5" fill="none" />\n`;
        } else {
          svg += `    <path d="M${endX + 10},${currentY - 4} L${endX},${currentY} L${endX + 10},${currentY + 4}" stroke="#475569" stroke-width="1.5" fill="none" />\n`;
        }
      } else {
        // Filled arrowhead for solid messages
        if (isRight) {
          svg += `    <polygon points="${endX},${currentY} ${endX - 10},${currentY - 5} ${endX - 10},${currentY + 5}" fill="#475569" />\n`;
        } else {
          svg += `    <polygon points="${endX},${currentY} ${endX + 10},${currentY - 5} ${endX + 10},${currentY + 5}" fill="#475569" />\n`;
        }
      }

      // Label
      if (labelTxt) {
        const mx = Math.min(startX, endX) + Math.abs(endX - startX) / 2;
        // Label background
        const labelWidth = labelTxt.length * 7 + 10;
        svg += `    <rect x="${mx - labelWidth / 2}" y="${currentY - 18}" width="${labelWidth}" height="16" rx="3" fill="white" opacity="0.9" />\n`;
        svg += `    <text x="${mx}" y="${currentY - 6}" text-anchor="middle" font-size="11" fill="#475569">${labelTxt}</text>\n`;
      }

      currentY += rowSpacing;
    }

    svg += `  </g>\n`;
  }

  svg += `</svg>`;
  return svg;
}