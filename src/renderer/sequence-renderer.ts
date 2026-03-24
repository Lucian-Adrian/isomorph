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

  // Track relation and activation positions
  const relationYCoords = new Map<string, number>();
  const activationYCoords = new Map<string, number>();
  let currentY = paddingY + 80;

  // 1. Position relations and activations sequentially
  for (let i = 0; i <= diag.relations.length; i++) {
    // Process activations at this slot
    for (const act of diag.activations) {
      if (act.afterRelationIdx === i) {
        activationYCoords.set(act.id, currentY);
        // activations don't consume space usually, just markers
      }
    }
    
    if (i < diag.relations.length) {
      const rel = diag.relations[i];
      const styleY = Number.parseFloat(String(rel.styles?.y ?? ''));
      const relY = Number.isFinite(styleY) ? styleY : currentY;
      relationYCoords.set(rel.id, relY);
      
      const isSelf = rel.from === rel.to;
      const step = isSelf ? rowSpacing + selfLoopHeight : rowSpacing;
      
      if (!Number.isFinite(styleY)) {
        currentY += step;
      } else {
        currentY = Math.max(currentY, relY + step);
      }
    }
  }

  const useAutonumber = diag.config.autonumber === true;
  const diagramHeight = currentY + 40;
  const computedWidth = paddingX * 2 + Math.max(0, entities.length - 1) * colSpacing;
  
  // Account for custom positioning
  let width = computedWidth;
  for (const ent of entities) {
    if (ent.position && ent.position.x !== undefined) {
      width = Math.max(width, ent.position.x + 160);
    }
  }

  const header = renderConfigHeaders(diag, width);
  const legend = renderConfigLegend(diag, width, header.height);
  const caption = renderConfigCaption(diag, width, diagramHeight + header.height + 40);
  const totalH = diagramHeight + header.height + caption.height + 40;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}" style="font-family:'DM Sans',system-ui,sans-serif;background:transparent">\n`;
  svg += svgDefs();
  svg += header.svg;
  svg += legend.svg;
  svg += `  <g transform="translate(0, ${header.height})">\n`;

  // --- Lifelines ---
  const entityX = new Map<string, number>();
  let currentXArr = paddingX;

  for (const ent of entities) {
    let xPos = currentXArr;
    if (ent.position && ent.position.x !== undefined) {
      xPos = ent.position.x;
      currentXArr = Math.max(currentXArr, xPos) + colSpacing;
    } else {
      currentXArr += colSpacing;
    }
    entityX.set(ent.name, xPos);

    const isActor = ent.kind === 'actor' || ent.stereotype === 'actor';
    const label = escapeXml(ent.name);

    svg += `    <g transform="translate(${xPos},${paddingY})">\n`;
    if (isActor) {
      svg += `      <circle cx="0" cy="-4" r="10" fill="var(--iso-bg-blue, #eff6ff)" stroke="#3b82f6" stroke-width="1.5" />\n`;
      svg += `      <path d="M0,6 v14 M-10,12 h20 M-6,30 l6,-10 l6,10" stroke="#3b82f6" stroke-width="1.5" fill="none" />\n`;
      svg += `      <text x="0" y="48" text-anchor="middle" font-size="13" font-weight="600" fill="var(--iso-text)">${label}</text>\n`;
    } else {
      svg += `      <rect x="-60" y="-20" width="120" height="36" rx="6" fill="var(--iso-bg-blue, #eff6ff)" stroke="#3b82f6" stroke-width="1.5" filter="url(#shadow)" />\n`;
      svg += `      <text x="0" y="4" text-anchor="middle" font-size="13" font-weight="600" fill="var(--iso-text)">${label}</text>\n`;
    }

    const lifelineStart = isActor ? 52 : 20;
    svg += `      <line x1="0" y1="${lifelineStart}" x2="0" y2="${diagramHeight - paddingY - 30}" stroke="var(--iso-text-muted, #94a3b8)" stroke-width="1" stroke-dasharray="6,4" />\n`;

    if (!isActor) {
      const bottomY = diagramHeight - paddingY - 30;
      svg += `      <rect x="-60" y="${bottomY}" width="120" height="30" rx="6" fill="var(--iso-bg-blue, #eff6ff)" stroke="#3b82f6" stroke-width="1.5" />\n`;
      svg += `      <text x="0" y="${bottomY + 19}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--iso-text)">${label}</text>\n`;
    }
    svg += `    </g>\n`;
  }

  // --- Activation Bars ---
  const activeRanges = new Map<string, number>(); // entity -> startY
  for (const act of diag.activations) {
    const x = entityX.get(act.entity);
    if (x === undefined) continue;
    const y = activationYCoords.get(act.id) || 0;
    
    if (act.kind === 'activate') {
        activeRanges.set(act.entity, y);
    } else {
        const startY = activeRanges.get(act.entity);
        if (startY !== undefined) {
             svg += `    <rect x="${x - activationWidth/2}" y="${startY - 5}" width="${activationWidth}" height="${y - startY + 10}" rx="2" fill="var(--iso-bg-blue, #e0e7ff)" stroke="var(--iso-pkg-border, #6366f1)" stroke-width="1" />\n`;
             activeRanges.delete(act.entity);
        }
    }
  }
  // Close unclosed activations
  for (const [entity, startY] of activeRanges.entries()) {
     const x = entityX.get(entity);
     if (x !== undefined) {
        svg += `    <rect x="${x - activationWidth/2}" y="${startY - 5}" width="${activationWidth}" height="${diagramHeight - startY - 20}" rx="2" fill="var(--iso-bg-blue, #e0e7ff)" stroke="var(--iso-pkg-border, #6366f1)" stroke-width="1" />\n`;
     }
  }

  // --- Messages (Relations) ---
  let msgIndex = 1;
  for (const rel of diag.relations) {
    const startX = entityX.get(rel.from);
    const endX = entityX.get(rel.to);
    const relationY = relationYCoords.get(rel.id);
    if (startX === undefined || endX === undefined || relationY === undefined) continue;

    const isDashed = rel.kind === 'dependency' || rel.kind === 'realization';
    const dash = isDashed ? ' stroke-dasharray="6,3"' : '';
    const labelTxt = useAutonumber ? `${msgIndex++}. ${rel.label || ''}` : (rel.label || '');
    const isSelf = rel.from === rel.to;

    svg += `    <g data-relation-id="${escapeXml(rel.id)}" data-relation-from="${escapeXml(rel.from)}" data-relation-to="${escapeXml(rel.to)}" data-relation-kind="${escapeXml(rel.kind)}" data-relation-y="${Math.round(relationY)}">\n`;

    if (isSelf) {
      const y1 = relationY;
      const y2 = relationY + selfLoopHeight;
      const loopRight = startX + selfLoopWidth;
      svg += `      <path d="M${startX},${y1} H${loopRight} V${y2} H${startX}" stroke="var(--iso-text-muted)" stroke-width="1.5" fill="none"${dash} />\n`;
      svg += `      <polygon points="${startX},${y2} ${startX + 8},${y2 - 4} ${startX + 8},${y2 + 4}" fill="var(--iso-text-muted)" />\n`;
      if (labelTxt) svg += `      <text x="${loopRight + 6}" y="${y1 + selfLoopHeight / 2 + 4}" font-size="11" fill="var(--iso-text-muted)">${labelTxt}</text>\n`;
    } else {
      svg += `      <line x1="${startX}" y1="${relationY}" x2="${endX}" y2="${relationY}" stroke="var(--iso-text-muted)" stroke-width="1.5"${dash} />\n`;
      const isRight = endX > startX;
      if (isDashed) {
        if (isRight) svg += `      <path d="M${endX - 10},${relationY - 4} L${endX},${relationY} L${endX - 10},${relationY + 4}" stroke="var(--iso-text-muted)" stroke-width="1.5" fill="none" />\n`;
        else svg += `      <path d="M${endX + 10},${relationY - 4} L${endX},${relationY} L${endX + 10},${relationY + 4}" stroke="var(--iso-text-muted)" stroke-width="1.5" fill="none" />\n`;
      } else {
        if (isRight) svg += `      <polygon points="${endX},${relationY} ${endX - 10},${relationY - 5} ${endX - 10},${relationY + 5}" fill="var(--iso-text-muted)" />\n`;
        else svg += `      <polygon points="${endX},${relationY} ${endX + 10},${relationY - 5} ${endX + 10},${relationY + 5}" fill="var(--iso-text-muted)" />\n`;
      }
      if (labelTxt) {
        const mx = Math.min(startX, endX) + Math.abs(endX - startX) / 2;
        svg += `      <text x="${mx}" y="${relationY - 6}" text-anchor="middle" font-size="11" fill="var(--iso-text-muted)">${labelTxt}</text>\n`;
      }
    }
    svg += `    </g>\n`;
  }

  // --- Fragments ---
  for (const frag of diag.fragments) {
    let minY = Infinity;
    let maxY = -Infinity;
    const allRelIds = [...frag.relationIds, ...(frag.elseBlocks?.flatMap(b => b.relationIds) ?? [])];
    for (const rid of allRelIds) {
      const y = relationYCoords.get(rid);
      if (y !== undefined) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    if (minY !== Infinity) {
      const fragTop = minY - 35;
      const fragBottom = maxY + 35;
      const fragLeft = 15;
      const fragRight = width - 15;
      svg += `    <rect x="${fragLeft}" y="${fragTop}" width="${fragRight - fragLeft}" height="${fragBottom - fragTop}" fill="rgba(99, 102, 241, 0.03)" stroke="var(--iso-pkg-border, #6366f1)" stroke-width="1" rx="4" />\n`;
      const tabText = `${frag.kind.toUpperCase()} ${frag.label ? `[${frag.label}]` : ''}`.trim();
      const tabW = Math.max(40, tabText.length * 6 + 12);
      svg += `    <path d="M${fragLeft},${fragTop} h${tabW} l5,5 v12 h-${tabW + 5} z" fill="var(--iso-bg-blue, #eff6ff)" stroke="var(--iso-pkg-border, #6366f1)" stroke-width="1" />\n`;
      svg += `    <text x="${fragLeft + 6}" y="${fragTop + 12}" font-size="9" font-weight="bold" fill="var(--iso-pkg-text, #3730a3)">${escapeXml(tabText)}</text>\n`;
      
      if (frag.elseBlocks && frag.elseBlocks.length > 0) {
        let lastY = -Infinity;
        for (const rid of frag.relationIds) {
           const y = relationYCoords.get(rid);
           if (y !== undefined) lastY = Math.max(lastY, y);
        }
        if (lastY !== -Infinity) {
          const sepY = lastY + 28;
          svg += `    <line x1="${fragLeft}" y1="${sepY}" x2="${fragRight}" y2="${sepY}" stroke="var(--iso-pkg-border)" stroke-width="1" stroke-dasharray="8,4" />\n`;
          if (frag.elseBlocks[0].label) svg += `    <text x="${fragLeft + 10}" y="${sepY + 15}" font-size="9" font-style="italic" fill="var(--iso-text-muted)">[${escapeXml(frag.elseBlocks[0].label)}]</text>\n`;
        }
      }
    }
  }

  svg += `  </g>\n`;
  svg += caption.svg;
  svg += `</svg>`;
  return svg;
}