// ============================================================
// Sequence Diagram SVG Renderer (Enhanced)
// ============================================================
import type { IOMDiagram } from '../semantics/iom.js';
import { escapeXml, svgDefs, renderConfigHeaders, renderConfigLegend, renderConfigCaption } from './utils.js';

export function renderSequenceDiagram(diag: IOMDiagram): string {
  const entities = Array.from(diag.entities.values());
  if (entities.length === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>`;

  const paddingX = 80;
  const colSpacing = 180;
  const paddingY = 60;
  const rowSpacing = 60;
  const selfLoopWidth = 40;
  const selfLoopHeight = 30;
  const activationWidth = 12;

  // Track relation positions for fragment rendering
  const relationYCoords = new Map<string, number>();

  // Count self-messages to allocate extra row height
  let selfMessageCount = 0;
  let maxStyledRelationY = 0;
  for (const rel of diag.relations) {
    if (rel.from === rel.to) selfMessageCount++;
    const relY = Number.parseFloat(String(rel.styles?.y ?? ''));
    if (Number.isFinite(relY)) {
      const relDepth = rel.from === rel.to ? relY + selfLoopHeight : relY;
      maxStyledRelationY = Math.max(maxStyledRelationY, relDepth);
    }
  }

  let computedWidth = paddingX * 2 + Math.max(0, entities.length - 1) * colSpacing;
  const autoHeight = paddingY * 2 + 40 + Math.max(0, diag.relations.length) * rowSpacing + selfMessageCount * selfLoopHeight + 80;
  const styledHeight = maxStyledRelationY > 0 ? maxStyledRelationY + 180 : 0;
  const height = Math.max(autoHeight, styledHeight);

  for (const ent of entities) {
    if (ent.position && ent.position.x !== undefined) {
      computedWidth = Math.max(computedWidth, ent.position.x + 160);
    }
  }
  const width = computedWidth;
  const header = renderConfigHeaders(diag, width);
  const legend = renderConfigLegend(diag, width, header.height);
  const caption = renderConfigCaption(diag, width, height + header.height + 40);
  const totalH = height + header.height + caption.height + 40;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}" style="font-family:'DM Sans',system-ui,sans-serif;background:transparent">\n`;
  svg += svgDefs();
  svg += header.svg;
  svg += legend.svg;
  svg += `  <g transform="translate(0, ${header.height})">\n`;

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
    svg += `    <rect x="-60" y="-35" width="120" height="${height - paddingY + 20}" fill="transparent" style="cursor: pointer;" />\n`;

    if (isActor) {
      svg += `    <circle cx="0" cy="-4" r="10" fill="var(--iso-bg-blue, #eff6ff)" stroke="#3b82f6" stroke-width="1.5" />\n`;
      svg += `    <path d="M0,6 v14 M-10,12 h20 M-6,30 l6,-10 l6,10" stroke="#3b82f6" stroke-width="1.5" fill="none" />\n`;
      svg += `    <text x="0" y="48" text-anchor="middle" font-size="13" font-weight="600" fill="var(--iso-text)">${label}</text>\n`;
    } else {
      svg += `    <rect x="-60" y="-20" width="120" height="36" rx="6" fill="var(--iso-bg-blue, #eff6ff)" stroke="#3b82f6" stroke-width="1.5" filter="url(#shadow)" />\n`;
      svg += `    <text x="0" y="4" text-anchor="middle" font-size="13" font-weight="600" fill="var(--iso-text)">${label}</text>\n`;
    }

    const lifelineStart = isActor ? 52 : 20;
    svg += `    <line x1="0" y1="${lifelineStart}" x2="0" y2="${height - paddingY - 30}" stroke="var(--iso-text-muted, #94a3b8)" stroke-width="1" stroke-dasharray="6,4" />\n`;

    if (!isActor) {
      const bottomY = height - paddingY - 30;
      svg += `    <rect x="-60" y="${bottomY}" width="120" height="30" rx="6" fill="var(--iso-bg-blue, #eff6ff)" stroke="#3b82f6" stroke-width="1.5" />\n`;
      svg += `    <text x="0" y="${bottomY + 19}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--iso-text)">${label}</text>\n`;
    }
    svg += `  </g>\n`;
  }

  // --- Relations as messages ---
  let currentY = paddingY + 80;
  let msgIndex = 1;
  const useAutonumber = diag.config.autonumber === true;

  for (const rel of diag.relations) {
    const startX = entityX.get(rel.from);
    const endX = entityX.get(rel.to);
    if (startX === undefined || endX === undefined) continue;

    const isDashed = rel.kind === 'dependency' || rel.kind === 'realization';
    const dash = isDashed ? ' stroke-dasharray="6,3"' : '';
    const rawLabel = rel.label ? escapeXml(rel.label) : '';
    const labelTxt = useAutonumber ? `${msgIndex++}. ${rawLabel}` : rawLabel;
    const isSelfMessage = rel.from === rel.to;
    const styleY = Number.parseFloat(String(rel.styles?.y ?? ''));
    const relationY = Number.isFinite(styleY) ? styleY : currentY;

    relationYCoords.set(rel.id, relationY);

    svg += `  <g data-relation-id="${escapeXml(rel.id)}" data-relation-from="${escapeXml(rel.from)}" data-relation-to="${escapeXml(rel.to)}" data-relation-kind="${escapeXml(rel.kind)}" data-relation-y="${Math.round(relationY)}">\n`;

    if (isSelfMessage) {
      const x = startX;
      const loopRight = x + selfLoopWidth;
      const y1 = relationY;
      const y2 = relationY + selfLoopHeight;

      svg += `    <rect x="${x}" y="${y1 - 5}" width="${selfLoopWidth + 10}" height="${selfLoopHeight + 10}" fill="transparent" style="cursor: pointer" />\n`;
      svg += `    <path d="M${x},${y1} H${loopRight} V${y2} H${x}" stroke="var(--iso-text-muted)" stroke-width="1.5" fill="none"${dash} />\n`;
      svg += `    <polygon points="${x},${y2} ${x + 8},${y2 - 4} ${x + 8},${y2 + 4}" fill="var(--iso-text-muted)" />\n`;
      svg += `    <rect x="${x - activationWidth / 2}" y="${y1 - 4}" width="${activationWidth}" height="${selfLoopHeight + 8}" rx="2" fill="var(--iso-bg-blue, #e0e7ff)" stroke="var(--iso-pkg-border, #6366f1)" stroke-width="1" />\n`;

      if (labelTxt) {
        svg += `    <text x="${loopRight + 6}" y="${y1 + selfLoopHeight / 2 + 4}" font-size="11" fill="var(--iso-text-muted)">${labelTxt}</text>\n`;
      }

      if (!Number.isFinite(styleY)) {
        currentY += rowSpacing + selfLoopHeight;
      } else {
        currentY = Math.max(currentY + rowSpacing, relationY + rowSpacing);
      }
    } else {
      const isRight = endX > startX;
      svg += `    <line x1="${startX}" y1="${relationY}" x2="${endX}" y2="${relationY}" stroke="transparent" stroke-width="15" style="cursor: ns-resize"/>\n`;
      svg += `    <rect x="${startX - activationWidth / 2}" y="${relationY - 10}" width="${activationWidth}" height="20" rx="2" fill="var(--iso-bg-blue, #e0e7ff)" stroke="var(--iso-pkg-border, #6366f1)" stroke-width="1" />\n`;
      svg += `    <line x1="${startX}" y1="${relationY}" x2="${endX}" y2="${relationY}" stroke="var(--iso-text-muted)" stroke-width="1.5"${dash} />\n`;

      if (isDashed) {
        if (isRight) {
          svg += `    <path d="M${endX - 10},${relationY - 4} L${endX},${relationY} L${endX - 10},${relationY + 4}" stroke="var(--iso-text-muted)" stroke-width="1.5" fill="none" />\n`;
        } else {
          svg += `    <path d="M${endX + 10},${relationY - 4} L${endX},${relationY} L${endX + 10},${relationY + 4}" stroke="var(--iso-text-muted)" stroke-width="1.5" fill="none" />\n`;
        }
      } else {
        if (isRight) {
          svg += `    <polygon points="${endX},${relationY} ${endX - 10},${relationY - 5} ${endX - 10},${relationY + 5}" fill="var(--iso-text-muted)" />\n`;
        } else {
          svg += `    <polygon points="${endX},${relationY} ${endX + 10},${relationY - 5} ${endX + 10},${relationY + 5}" fill="var(--iso-text-muted)" />\n`;
        }
      }

      if (labelTxt) {
        const mx = Math.min(startX, endX) + Math.abs(endX - startX) / 2;
        const labelWidth = labelTxt.length * 7 + 10;
        svg += `    <rect x="${mx - labelWidth / 2}" y="${relationY - 18}" width="${labelWidth}" height="16" rx="3" fill="var(--iso-bg-panel)" opacity="0.9" />\n`;
        svg += `    <text x="${mx}" y="${relationY - 6}" text-anchor="middle" font-size="11" fill="var(--iso-text-muted)">${labelTxt}</text>\n`;
      }

      if (!Number.isFinite(styleY)) {
        currentY += rowSpacing;
      } else {
        currentY = Math.max(currentY + rowSpacing, relationY + rowSpacing);
      }
    }
    svg += `  </g>\n`;
  }

  // --- Rendering Fragments ---
  for (const frag of diag.fragments) {
    let minY = Infinity;
    let maxY = -Infinity;
    
    const relsInMain = frag.relationIds;
    const relsInElse = frag.elseBlocks?.flatMap(b => b.relationIds) ?? [];
    const allRelIds = [...relsInMain, ...relsInElse];
    
    for (const rid of allRelIds) {
      const y = relationYCoords.get(rid);
      if (y !== undefined) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    
    if (minY !== Infinity) {
      const fragTop = minY - 30;
      const fragBottom = maxY + 30;
      const fragLeft = 10;
      const fragRight = width - 10;

      svg += `  <g data-fragment-id="${frag.id}" data-fragment-kind="${frag.kind}">\n`;
      svg += `    <rect x="${fragLeft}" y="${fragTop}" width="${fragRight - fragLeft}" height="${fragBottom - fragTop}" fill="rgba(99, 102, 241, 0.05)" stroke="var(--iso-pkg-border, #6366f1)" stroke-width="1" rx="4" />\n`;
      
      const typeLabel = frag.kind.toUpperCase();
      const userLabel = frag.label ? `[${escapeXml(frag.label)}]` : '';
      const tabText = `${typeLabel} ${userLabel}`.trim();
      const tabWidth = Math.max(40, tabText.length * 6 + 12);
      
      svg += `    <path d="M${fragLeft},${fragTop} h${tabWidth} l5,5 v12 h-${tabWidth + 5} z" fill="var(--iso-bg-blue, #eff6ff)" stroke="var(--iso-pkg-border, #6366f1)" stroke-width="1" />\n`;
      svg += `    <text x="${fragLeft + 6}" y="${fragTop + 12}" font-size="9" font-weight="bold" fill="var(--iso-pkg-text, #3730a3)">${tabText}</text>\n`;
      
      if (frag.elseBlocks && frag.elseBlocks.length > 0) {
        let currentBlockMaxY = -Infinity;
        for (const rid of relsInMain) {
           const y = relationYCoords.get(rid);
           if (y !== undefined) currentBlockMaxY = Math.max(currentBlockMaxY, y);
        }
        
        if (currentBlockMaxY !== -Infinity) {
          const sepY = currentBlockMaxY + 25;
          svg += `    <line x1="${fragLeft}" y1="${sepY}" x2="${fragRight}" y2="${sepY}" stroke="var(--iso-pkg-border)" stroke-width="1" stroke-dasharray="8,4" />\n`;
          if (frag.elseBlocks[0].label) {
             svg += `    <text x="${fragLeft + 10}" y="${sepY + 15}" font-size="9" font-style="italic" fill="var(--iso-text-muted)">[${escapeXml(frag.elseBlocks[0].label)}]</text>\n`;
          }
        }
      }
      svg += `  </g>\n`;
    }
  }

  svg += `  </g>\n`;
  svg += caption.svg;
  svg += `</svg>`;
  return svg;
}