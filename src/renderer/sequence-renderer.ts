// ============================================================
// Sequence Diagram SVG Renderer (Enhanced)
// ============================================================
import type { IOMDiagram } from '../semantics/iom.js';
import { escapeXml, svgDefs, renderConfigHeaders, renderConfigLegend, renderConfigCaption } from './utils.js';

function getSequenceRelationType(rel: { kind: string; from?: string; to?: string }): 'synchronous' | 'asynchronous' | 'response' | 'self-call' {
  if (rel.from && rel.to && rel.from === rel.to) return 'self-call';
  if (rel.kind === 'dependency') return 'response';
  if (rel.kind === 'inheritance') return 'asynchronous';
  return 'synchronous';
}

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
  const nestedActivationOffset = 4;

  // Track relation and activation positions
  const relationYCoords = new Map<string, number>();
  const activationYCoords = new Map<string, number>();
  let currentY = paddingY + 80;

  // 1. Position relations sequentially
  for (let i = 0; i < diag.relations.length; i++) {
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

  // 2. Anchor activation events to the previous relation Y in their slot.
  for (const act of diag.activations) {
    if (diag.relations.length === 0 || act.afterRelationIdx <= 0) {
      activationYCoords.set(act.id, paddingY + 80);
      continue;
    }

    const relIdx = Math.min(diag.relations.length - 1, act.afterRelationIdx - 1);
    const rel = diag.relations[relIdx];
    const y = relationYCoords.get(rel.id);
    activationYCoords.set(act.id, Number.isFinite(y) ? (y as number) : paddingY + 80);
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

  const createYs = new Map<string, number>();
  const destroyYs = new Map<string, number>();
  for (const act of diag.activations) {
    if (act.kind === 'create') createYs.set(act.entity, activationYCoords.get(act.id) || 0);
    if (act.kind === 'destroy') destroyYs.set(act.entity, activationYCoords.get(act.id) || 0);
  }
  for (const rel of diag.relations) {
    if (rel.styles?.action === 'create') createYs.set(rel.to, relationYCoords.get(rel.id) || 0);
    if (rel.styles?.action === 'destroy') destroyYs.set(rel.to, relationYCoords.get(rel.id) || 0);
  }

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
    const stereotype = (ent.stereotype || '').toLowerCase();
    const isBoundaryIcon = !isActor && stereotype === 'boundary';
    const isControlIcon = !isActor && stereotype === 'control';
    const isEntityIcon = !isActor && stereotype === 'entity';
    const hasStereotypeIcon = isBoundaryIcon || isControlIcon || isEntityIcon;
    const label = escapeXml(ent.name);

    const createY = createYs.get(ent.name);
    const boxAbsoluteY = createY !== undefined ? createY - 18 : paddingY;

    svg += `    <g transform="translate(${xPos},${boxAbsoluteY})" data-entity-name="${label}">\n`;
    if (isActor) {
      svg += `      <circle cx="0" cy="-4" r="10" fill="var(--iso-bg-blue, #eff6ff)" stroke="#3b82f6" stroke-width="1.5" />\n`;
      svg += `      <path d="M0,6 v14 M-10,12 h20 M-6,30 l6,-10 l6,10" stroke="#3b82f6" stroke-width="1.5" fill="none" />\n`;
      svg += `      <text x="0" y="48" text-anchor="middle" font-size="13" font-weight="600" fill="var(--iso-text)">${label}</text>\n`;
    } else if (hasStereotypeIcon) {
      svg += `      <circle cx="0" cy="0" r="16" fill="var(--iso-bg-blue, #eff6ff)" stroke="#3b82f6" stroke-width="1.5" />\n`;
      if (isBoundaryIcon) {
        svg += `      <line x1="-20" y1="-20" x2="-20" y2="20" stroke="var(--iso-text-muted, #94a3b8)" stroke-width="2" />\n`;
        svg += `      <line x1="-20" y1="0" x2="-16" y2="0" stroke="var(--iso-text-muted, #94a3b8)" stroke-width="2" />\n`;
      } else if (isControlIcon) {
        svg += `      <path d="M-1,-17 l9,-7 M-1,-17 l9,7" stroke="var(--iso-text-muted, #94a3b8)" stroke-width="2" fill="none" stroke-linecap="round" />\n`;
      } else if (isEntityIcon) {
        svg += `      <line x1="-16" y1="17" x2="16" y2="17" stroke="var(--iso-text-muted, #94a3b8)" stroke-width="2" />\n`;
      }
      svg += `      <text x="0" y="48" text-anchor="middle" font-size="13" font-weight="600" fill="var(--iso-text)">${label}</text>\n`;
    } else {
      svg += `      <rect x="-60" y="-20" width="120" height="36" rx="6" fill="var(--iso-bg-blue, #eff6ff)" stroke="#3b82f6" stroke-width="1.5" filter="url(#shadow)" />\n`;
      svg += `      <text x="0" y="4" text-anchor="middle" font-size="13" font-weight="600" fill="var(--iso-text)">${label}</text>\n`;
    }

    const lifelineStart = (isActor || hasStereotypeIcon) ? 52 : 20;
    const destY = destroyYs.get(ent.name);
    const hasDestroy = destY !== undefined;
    
    // Map absolute coords back to the translated coordinate space of this group
    const absoluteEnd = hasDestroy ? destY + 40 : diagramHeight - 30;
    const lifelineEnd = absoluteEnd - boxAbsoluteY;

    svg += `      <line x1="0" y1="${lifelineStart}" x2="0" y2="${lifelineEnd}" stroke="transparent" stroke-width="20" style="cursor: pointer" />\n`;
    svg += `      <line x1="0" y1="${lifelineStart}" x2="0" y2="${lifelineEnd}" stroke="var(--iso-text-muted, #94a3b8)" stroke-width="1" stroke-dasharray="6,4" />\n`;

    if (hasDestroy) {
      const crossSize = 10;
      svg += `      <path d="M${-crossSize},${lifelineEnd - crossSize} L${crossSize},${lifelineEnd + crossSize} M${crossSize},${lifelineEnd - crossSize} L${-crossSize},${lifelineEnd + crossSize}" stroke="var(--iso-text-muted, #94a3b8)" stroke-width="2" />\n`;
    }

    if (!isActor && !hasStereotypeIcon && !hasDestroy) {
      const bottomY = diagramHeight - 30 - boxAbsoluteY;
      svg += `      <rect x="-60" y="${bottomY}" width="120" height="30" rx="6" fill="var(--iso-bg-blue, #eff6ff)" stroke="#3b82f6" stroke-width="1.5" />\n`;
      svg += `      <text x="0" y="${bottomY + 19}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--iso-text)">${label}</text>\n`;
    }
    svg += `    </g>\n`;
  }

  // Track the last action Y for each entity to truncate open activations cleanly
  const entityLastY = new Map<string, number>();
  for (const rel of diag.relations) {
      if (rel.styles && typeof rel.styles.y !== 'undefined') {
          const y = Number.parseInt(String(rel.styles.y), 10);
          if (Number.isFinite(y)) {
              if (!entityLastY.has(rel.from) || y > entityLastY.get(rel.from)!) entityLastY.set(rel.from, y);
              if (!entityLastY.has(rel.to) || y > entityLastY.get(rel.to)!) entityLastY.set(rel.to, y);
          }
      }
  }

  // --- Activation Bars ---
  type ActivationBar = { entity: string; startY: number; endY: number; depth: number };
  const bars: ActivationBar[] = [];

  // Auto activation behaves like bracket matching by rendered Y order:
  // synchronous call opens, response closes, nested calls increase depth.
  if (diag.config.autoactivation) {
    const orderedRelations = diag.relations
      .map((rel, index) => ({ rel, index, y: relationYCoords.get(rel.id) ?? 0 }))
      .sort((a, b) => (a.y - b.y) || (a.index - b.index));

    const callStack: Array<{ from: string; to: string; startY: number; depth: number }> = [];
    const depthByEntity = new Map<string, number>();

    for (const entry of orderedRelations) {
      const rel = entry.rel;
      const y = entry.y;
      const seqType = getSequenceRelationType(rel);

      if (rel.label?.toLowerCase() === 'create' || rel.label?.toLowerCase() === 'new') {
        // "create" is treated as an asynchronous call that doesn't push to the call stack.
        // It's handled by drawing the lifeline box lower at `createY`.
        // We do *not* start an activation bar for `rel.to` by default, but we could if we wanted.
      } else if (rel.label?.toLowerCase() === 'destroy' || rel.label?.toLowerCase() === 'delete') {
        // "destroy" is treated as an asynchronous call.
        // It's handled by drawing an X at the `destroyY` location.
      } else if (seqType === 'synchronous' && rel.from !== rel.to) {
        const depth = depthByEntity.get(rel.to) ?? 0;
        callStack.push({ from: rel.from, to: rel.to, startY: y, depth });
        depthByEntity.set(rel.to, depth + 1);
      } else if (seqType === 'response') {
        const top = callStack[callStack.length - 1];
        if (top && top.from === rel.to && top.to === rel.from) {
          callStack.pop();
          depthByEntity.set(top.to, Math.max(0, (depthByEntity.get(top.to) ?? 1) - 1));
          bars.push({ entity: top.to, startY: top.startY, endY: y, depth: top.depth });
        }
      } else if (seqType === 'asynchronous' || seqType === 'self-call') {
        const depth = depthByEntity.get(rel.to) ?? 0;
        bars.push({ entity: rel.to, startY: y, endY: y + 24, depth });
      }
    }

    while (callStack.length > 0) {
      const unclosed = callStack.pop()!;
      const fallback = entityLastY.has(unclosed.to)
        ? Math.max(unclosed.startY + 30, entityLastY.get(unclosed.to)! + 20)
        : diagramHeight - 30;
      bars.push({ entity: unclosed.to, startY: unclosed.startY, endY: fallback, depth: unclosed.depth });
    }
  }

  // Manual activate/deactivate should still work even with autoactivation enabled.
  const manualEvents = diag.activations
    .filter(act => act.kind === 'activate' || act.kind === 'deactivate')
    .filter(act => act.source === 'manual' || !diag.config.autoactivation)
    .map((act, idx) => ({
      act,
      idx,
      y: activationYCoords.get(act.id) ?? 0,
    }))
    .sort((a, b) => (a.y - b.y) || (a.idx - b.idx));

  const manualStacks = new Map<string, number[]>();
  for (const entry of manualEvents) {
    const act = entry.act;
    const y = entry.y;

    if (!entityLastY.has(act.entity) || y > entityLastY.get(act.entity)!) entityLastY.set(act.entity, y);

    if (act.kind === 'activate') {
      let startY = y;
      const createY = createYs.get(act.entity);
      const boxAbsY = createY !== undefined ? createY : paddingY;
      const boxBottom = boxAbsY + 16;
      if (startY < boxBottom) {
        startY = boxBottom + 4;
      }
      const stack = manualStacks.get(act.entity) || [];
      stack.push(startY);
      manualStacks.set(act.entity, stack);
    } else if (act.kind === 'deactivate') {
      const stack = manualStacks.get(act.entity);
      if (stack && stack.length > 0) {
        const startY = stack.pop()!;
        bars.push({ entity: act.entity, startY, endY: y, depth: 0 });
      }
    }
  }

  for (const [entity, stack] of manualStacks.entries()) {
    for (const startY of stack) {
      const endY = entityLastY.has(entity) ? Math.max(startY + 30, entityLastY.get(entity)! + 20) : diagramHeight - 30;
      bars.push({ entity, startY, endY, depth: 0 });
    }
  }

  for (const bar of bars) {
    const x = entityX.get(bar.entity);
    if (x === undefined) continue;
    const shiftedX = x + (bar.depth * nestedActivationOffset);
    svg += `    <rect x="${shiftedX - activationWidth/2}" y="${bar.startY - 5}" width="${activationWidth}" height="${Math.max(10, bar.endY - bar.startY + 10)}" rx="2" fill="var(--iso-bg-blue, #e0e7ff)" stroke="var(--iso-pkg-border, #6366f1)" stroke-width="1" style="pointer-events: none" />\n`;
  }

  // --- Messages (Relations) ---
  let msgIndex = 1;
  for (const rel of diag.relations) {
    const startX = entityX.get(rel.from);
    const endX = entityX.get(rel.to);
    const relationY = relationYCoords.get(rel.id);
    if (startX === undefined || endX === undefined || relationY === undefined) continue;

    const seqType = getSequenceRelationType(rel);
    const isDashed = seqType === 'response';
    const dash = isDashed ? ' stroke-dasharray="6,3"' : '';
    const labelTxt = useAutonumber ? `${msgIndex++}. ${rel.label || ''}` : (rel.label || '');
    const isSelf = rel.from === rel.to;

    const safeLabel = escapeXml(rel.label || '');
    svg += `    <g data-relation-id="${escapeXml(rel.id)}" data-relation-from="${escapeXml(rel.from)}" data-relation-to="${escapeXml(rel.to)}" data-relation-kind="${escapeXml(rel.kind)}" data-seq-rel-type="${seqType}" data-relation-label="${safeLabel}" data-relation-y="${Math.round(relationY)}">\n`;

    if (isSelf) {
      const y1 = relationY;
      const y2 = relationY + selfLoopHeight;
      const loopRight = startX + selfLoopWidth;
      svg += `      <path d="M${startX},${y1} H${loopRight} V${y2} H${startX}" stroke="transparent" stroke-width="15" fill="none" style="cursor: pointer" />\n`;
      svg += `      <path d="M${startX},${y1} H${loopRight} V${y2} H${startX}" stroke="var(--iso-text-muted)" stroke-width="1.5" fill="none"${dash} />\n`;
      if (seqType === 'synchronous' || seqType === 'self-call') {
        svg += `      <polygon points="${startX},${y2} ${startX + 8},${y2 - 4} ${startX + 8},${y2 + 4}" fill="var(--iso-text-muted)" />\n`;
      } else {
        svg += `      <path d="M${startX + 9},${y2 - 5} L${startX},${y2} L${startX + 9},${y2 + 5}" stroke="var(--iso-text-muted)" stroke-width="1.5" fill="none" />\n`;
      }
      if (labelTxt) svg += `      <text x="${loopRight + 6}" y="${y1 + selfLoopHeight / 2 + 4}" font-size="11" fill="var(--iso-text-muted)">${labelTxt}</text>\n`;
    } else {
      svg += `      <line x1="${startX}" y1="${relationY}" x2="${endX}" y2="${relationY}" stroke="transparent" stroke-width="15" style="cursor: pointer" />\n`;
      svg += `      <line x1="${startX}" y1="${relationY}" x2="${endX}" y2="${relationY}" stroke="var(--iso-text-muted)" stroke-width="1.5"${dash} />\n`;
      const isRight = endX > startX;
      if (seqType !== 'synchronous') {
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
  // Pre-calculate subset depths for nicely nested rendering of overlapping fragments
  const fragDepths = new Map<string, number>();
  for (let i = 0; i < diag.fragments.length; i++) {
    let depth = 0;
    const f1 = diag.fragments[i];
    const rels1 = new Set([...f1.relationIds, ...(f1.elseBlocks?.flatMap(b => b.relationIds) ?? [])]);
    for (let j = 0; j < diag.fragments.length; j++) {
      if (i === j) continue;
      const f2 = diag.fragments[j];
      const rels2 = new Set([...f2.relationIds, ...(f2.elseBlocks?.flatMap(b => b.relationIds) ?? [])]);
      
      // If f1's relations are a strict subset of f2's, or if they are identical but j < i (tie breaker)
      let isSubset = f1.relationIds.length > 0 && Array.from(rels1).every(r => rels2.has(r));
      if (isSubset && (rels1.size < rels2.size || (rels1.size === rels2.size && j < i))) {
        depth++;
      }
    }
    fragDepths.set(f1.id, depth);
  }

  for (const frag of diag.fragments) {
    let minY = Infinity;
    let maxY = -Infinity;
    const allRelIds = [...frag.relationIds, ...(frag.elseBlocks?.flatMap(b => b.relationIds) ?? [])];
    for (const rid of allRelIds) {
      const y = relationYCoords.get(rid);
      if (y !== undefined) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    
const depth = fragDepths.get(frag.id) || 0;
      const inset = 15 + (depth * 8);

      let fragTop = minY !== Infinity ? minY - 35 + (depth * 6) : 50;
      let fragBottom = maxY !== -Infinity ? maxY + 35 - (depth * 6) : 150;
      let fragLeft = inset;
      let fragRight = width - inset;
    let fWidth = fragRight - fragLeft;
    let fHeight = fragBottom - fragTop;
    
    if (frag.position) {
      fragLeft = frag.position.x;
      fragTop = frag.position.y;
      if (frag.position.w !== undefined) fWidth = frag.position.w;
      if (frag.position.h !== undefined) fHeight = frag.position.h;
      fragRight = fragLeft + fWidth;
      fragBottom = fragTop + fHeight;
    }
    
    let strokeColor = "#6366f1";
    let fillColor = "rgba(99, 102, 241, 0.05)";
    let textFill = "#3730a3";
    let tabFill = "#eff6ff";
    
    switch (frag.kind) {
      case 'alt':
        strokeColor = "#0ea5e9"; fillColor = "rgba(14, 165, 233, 0.05)"; textFill = "#0369a1"; tabFill = "#e0f2fe"; break;
      case 'loop':
        strokeColor = "#f59e0b"; fillColor = "rgba(245, 158, 11, 0.05)"; textFill = "#b45309"; tabFill = "#fef3c7"; break;
      case 'opt':
        strokeColor = "#22c55e"; fillColor = "rgba(34, 197, 94, 0.05)"; textFill = "#15803d"; tabFill = "#dcfce7"; break;
      case 'break':
      case 'critical':
        strokeColor = "#ef4444"; fillColor = "rgba(239, 68, 68, 0.05)"; textFill = "#b91c1c"; tabFill = "#fee2e2"; break;
      case 'par':
        strokeColor = "#8b5cf6"; fillColor = "rgba(139, 92, 246, 0.05)"; textFill = "#6d28d9"; tabFill = "#f3e8ff"; break;
    }

    svg += `    <g data-entity-name="${frag.id}" transform="translate(${fragLeft},${fragTop})">\n`;
    svg += `      <rect fill="transparent" x="0" y="0" width="${fWidth}" height="${fHeight}" style="cursor: move; pointer-events: all;" />\n`;
    svg += `      <rect x="0" y="0" width="${fWidth}" height="${fHeight}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5" rx="4" style="pointer-events: none;" />\n`;
    const tabText = `${frag.kind.toUpperCase()} ${frag.label ? `[${frag.label}]` : ''}`.trim();
    const tabW = Math.max(40, tabText.length * 6 + 12);
    svg += `      <path d="M0,0 h${tabW} l5,5 v12 h-${tabW + 5} z" fill="${tabFill}" stroke="${strokeColor}" stroke-width="1.5" style="pointer-events: none;" />\n`;
    svg += `      <text x="6" y="12" font-size="9" font-weight="bold" fill="${textFill}" style="pointer-events: none;">${escapeXml(tabText)}</text>\n`;
    
    if (frag.elseBlocks && frag.elseBlocks.length > 0) {
        let currentRels = frag.relationIds;
        let lastValidSepY = 30; // fallback inside the fragment

        for (const block of frag.elseBlocks) {
          let lastY = -Infinity;
          for (const rid of currentRels) {
             const y = relationYCoords.get(rid);
             if (y !== undefined) lastY = Math.max(lastY, y);
          }
          
          let sepY = lastValidSepY;
          if (lastY !== -Infinity && !frag.position) {
            sepY = lastY + 28 - fragTop;
            lastValidSepY = sepY + 30; // advance fallback
          } else if (!frag.position) {
            sepY = lastValidSepY;
            lastValidSepY += 30;
          }

          if (!frag.position) {
            svg += `      <line x1="0" y1="${sepY}" x2="${fWidth}" y2="${sepY}" stroke="${strokeColor}" stroke-width="1" stroke-dasharray="8,4" style="pointer-events: none;" />\n`;
            if (block.label) svg += `      <text x="10" y="${sepY + 15}" font-size="9" font-style="italic" fill="${textFill}" style="pointer-events: none;">[${escapeXml(block.label)}]</text>\n`;
          }
          
          currentRels = block.relationIds;
        }
      }
    
      svg += `    </g>\n`;
    }

  svg += `  </g>\n`;
  svg += caption.svg;
  svg += `</svg>`;
  return svg;
}