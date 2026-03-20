// ============================================================
// State / Activity Diagram SVG Renderer
// ============================================================
// Renders state and activity diagrams.
// Uses a simple grid placement for nodes.
// ============================================================

import type { IOMDiagram, IOMEntity } from '../semantics/iom.js';
import { escapeXml, svgDefs } from './utils.js';

const BOX_W        = 140;
const BOX_H        = 50;
const CIRCLE_R     = 15;
const DIAMOND_S    = 40;
const BAR_W        = 100;
const BAR_H        = 10;
const GAP_X        = 80;
const GAP_Y        = 60;
const GRID_COLS    = 4;

interface Placed {
  entity: IOMEntity;
  x: number;
  y: number;
}

export function renderStateOrActivityDiagram(diag: IOMDiagram): string {
  const entities = [...diag.entities.values()];
  if (entities.length === 0)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><text x="20" y="40" font-family="sans-serif" font-size="14">${escapeXml(diag.name)}: empty diagram</text></svg>`;

  const placed = placeEntities(entities);

  let maxX = 400, maxY = 300;
  for (const p of placed) {
    const dim = getDimensions(p.entity);
    maxX = Math.max(maxX, p.x + dim.w + 40);
    maxY = Math.max(maxY, p.y + dim.h + 40);
  }

  const partitionEntities = diag.kind === 'activity'
    ? entities.filter(e => e.kind === 'partition')
    : [];
  const shouldRenderSwimlanes = partitionEntities.length > 0;

  if (shouldRenderSwimlanes) {
    partitionEntities.forEach((partition, idx) => {
      const px = partition.position?.x ?? (40 + idx * 260);
      const py = partition.position?.y ?? 16;
      const pw = partition.position?.w ?? 240;
      const ph = partition.position?.h ?? Math.max(200, maxY - py - 16);
      maxX = Math.max(maxX, px + pw + 24);
      maxY = Math.max(maxY, py + ph + 24);
    });
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" style="font-family:'DM Sans',system-ui,sans-serif;background:transparent">\n`;
  svg += svgDefs();

  if (shouldRenderSwimlanes) {
    svg += renderActivitySwimlanes(partitionEntities, placed, maxY);
  }

  // Relations
  for (const rel of diag.relations) {
    const f = placed.find(p => p.entity.name === rel.from);
    const t = placed.find(p => p.entity.name === rel.to);
    if (!f || !t) continue;
    const fDim = getDimensions(f.entity);
    const tDim = getDimensions(t.entity);
    
    const x1 = f.x + fDim.w / 2, y1 = f.y + fDim.h / 2;
    const x2 = t.x + tDim.w / 2, y2 = t.y + tDim.h / 2;
    const safeLabel = rel.label ? escapeXml(rel.label) : '';
    
    svg += `  <g data-relation-id="${escapeXml(rel.id)}" data-relation-from="${escapeXml(rel.from)}" data-relation-to="${escapeXml(rel.to)}" data-relation-kind="${escapeXml(rel.kind)}" data-relation-label="${safeLabel}">`;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="15" style="cursor: pointer"/>`;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>`;
    
    if (rel.label) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - 8;
      svg += `<rect x="${mx - rel.label.length * 3.5 - 4}" y="${my - 12}" width="${rel.label.length * 7 + 8}" height="16" fill="white" opacity="0.9"/>`;
      svg += `<text x="${mx}" y="${my}" text-anchor="middle" font-size="11" fill="#334155">${safeLabel}</text>`;
    }
    svg += `</g>\n`;
  }

  // Entities
  for (const p of placed) {
    if (shouldRenderSwimlanes && p.entity.kind === 'partition') continue;
    svg += renderEntity(p);
  }

  svg += `</svg>`;
  return svg;
}

function renderActivitySwimlanes(partitions: IOMEntity[], placed: Placed[], height: number): string {
  const headerHeight = 34;

  const partitionPlacements = partitions
    .map((partition, idx) => {
      const fallbackPos = placed.find(p => p.entity.name === partition.name);
      const laneX = partition.position?.x ?? fallbackPos?.x ?? (40 + idx * 260);
      const laneY = partition.position?.y ?? 16;
      const laneW = partition.position?.w ?? 240;
      const laneH = partition.position?.h ?? Math.max(200, height - laneY - 16);
      return { partition, laneX, laneY, laneW, laneH };
    })
    .sort((a, b) => a.laneX - b.laneX);

  if (partitionPlacements.length === 0) return '';

  let laneSvg = '';

  for (let i = 0; i < partitionPlacements.length; i++) {
    const lane = partitionPlacements[i];
    const laneW = Math.max(120, lane.laneW);
    const laneH = Math.max(120, lane.laneH);

    laneSvg += `  <g transform="translate(${lane.laneX},${lane.laneY})" data-entity-name="${escapeXml(lane.partition.name)}" data-partition-lane="true" data-entity-width="${Math.round(laneW)}" data-entity-height="${Math.round(laneH)}">`;
    laneSvg += `<rect data-lane-body="true" x="0" y="0" width="${laneW}" height="${laneH}" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>`;
    laneSvg += `<rect data-lane-header="true" x="0" y="0" width="${laneW}" height="${headerHeight}" rx="8" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1"/>`;
    laneSvg += `<line data-lane-divider="true" x1="0" y1="${headerHeight}" x2="${laneW}" y2="${headerHeight}" stroke="#cbd5e1" stroke-width="1"/>`;
    laneSvg += `<text data-lane-title="true" x="${laneW / 2}" y="22" text-anchor="middle" font-size="12" font-weight="600" fill="#334155">${escapeXml(lane.partition.name)}</text>`;
    laneSvg += `<rect data-resize-handle="e" x="${laneW - 4}" y="${laneH / 2 - 10}" width="8" height="20" rx="2" fill="#3b82f6" opacity="0.6" style="cursor: ew-resize"/>`;
    laneSvg += `<rect data-resize-handle="s" x="${laneW / 2 - 10}" y="${laneH - 4}" width="20" height="8" rx="2" fill="#3b82f6" opacity="0.6" style="cursor: ns-resize"/>`;
    laneSvg += `<rect data-resize-handle="se" x="${laneW - 6}" y="${laneH - 6}" width="12" height="12" rx="3" fill="#2563eb" opacity="0.8" style="cursor: nwse-resize"/>`;
    laneSvg += `</g>\n`;
  }

  return laneSvg;
}

function getDimensions(entity: IOMEntity): { w: number, h: number } {
  const sizeW = entity.position?.w;
  const sizeH = entity.position?.h;
  if (Number.isFinite(sizeW) && Number.isFinite(sizeH) && sizeW! > 0 && sizeH! > 0) {
    return { w: sizeW!, h: sizeH! };
  }

  switch (entity.kind) {
    case 'start':
    case 'stop':
    case 'history': return { w: CIRCLE_R * 2, h: CIRCLE_R * 2 };
    case 'decision':
    case 'choice':
    case 'merge':   return { w: DIAMOND_S, h: DIAMOND_S };
    case 'fork':
    case 'join':    return { w: BAR_W, h: BAR_H };
    default:        return { w: BOX_W, h: BOX_H };
  }
}

function placeEntities(entities: IOMEntity[]): Placed[] {
  const result: Placed[] = [];
  let col = 0;
  let curX = 40, curY = 40;
  let maxRowH = 0;

  for (const entity of entities) {
    const dim = getDimensions(entity);
    const pos = entity.position
      ? { x: entity.position.x, y: entity.position.y }
      : { x: curX, y: curY };

    result.push({ entity, x: pos.x, y: pos.y });

    maxRowH = Math.max(maxRowH, dim.h);
    col++;
    curX += dim.w + GAP_X;
    if (col >= GRID_COLS) {
      col = 0;
      curX = 40;
      curY += maxRowH + GAP_Y;
      maxRowH = 0;
    }
  }

  return result;
}

function renderEntity(p: Placed): string {
  const { entity, x, y } = p;
  const label = entity.name;
  let s = `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(label)}">\n`;

  if (entity.kind === 'start') {
    s += `    <circle cx="${CIRCLE_R}" cy="${CIRCLE_R}" r="${CIRCLE_R}" fill="#334155" filter="url(#shadow)"/>\n`;
    s += `    <text x="${CIRCLE_R}" y="${CIRCLE_R * 2 + 15}" text-anchor="middle" font-size="12" fill="#0f172a">${escapeXml(label)}</text>\n`;
  } else if (entity.kind === 'stop') {
    s += `    <circle cx="${CIRCLE_R}" cy="${CIRCLE_R}" r="${CIRCLE_R}" fill="none" stroke="#334155" stroke-width="2" filter="url(#shadow)"/>\n`;
    s += `    <circle cx="${CIRCLE_R}" cy="${CIRCLE_R}" r="${CIRCLE_R - 6}" fill="#334155"/>\n`;
    s += `    <text x="${CIRCLE_R}" y="${CIRCLE_R * 2 + 15}" text-anchor="middle" font-size="12" fill="#0f172a">${escapeXml(label)}</text>\n`;
  } else if (entity.kind === 'history') {
    s += `    <circle cx="${CIRCLE_R}" cy="${CIRCLE_R}" r="${CIRCLE_R}" fill="#f8fafc" stroke="#334155" stroke-width="1.5" filter="url(#shadow)"/>\n`;
    s += `    <text x="${CIRCLE_R}" y="${CIRCLE_R + 5}" text-anchor="middle" font-size="14" font-weight="600" fill="#0f172a">H</text>\n`;
    s += `    <text x="${CIRCLE_R}" y="${CIRCLE_R * 2 + 15}" text-anchor="middle" font-size="12" fill="#0f172a">${escapeXml(label)}</text>\n`;
  } else if (entity.kind === 'decision' || entity.kind === 'choice' || entity.kind === 'merge') {
    const hw = DIAMOND_S / 2;
    s += `    <polygon points="${hw},0 ${DIAMOND_S},${hw} ${hw},${DIAMOND_S} 0,${hw}" fill="#ecfdf5" stroke="#14b8a6" stroke-width="1.5" filter="url(#shadow)"/>\n`;
    s += `    <text x="${hw}" y="${DIAMOND_S + 15}" text-anchor="middle" font-size="12" fill="#0f172a">${escapeXml(label)}</text>\n`;
  } else if (entity.kind === 'fork' || entity.kind === 'join') {
    s += `    <rect width="${BAR_W}" height="${BAR_H}" rx="2" fill="#334155" filter="url(#shadow)"/>\n`;
    s += `    <text x="${BAR_W / 2}" y="${BAR_H + 15}" text-anchor="middle" font-size="12" fill="#0f172a">${escapeXml(label)}</text>\n`;
  } else {
    // Action / State / Composite / Concurrent node
    // Rounded rect
    const r = entity.kind === 'action' ? 16 : 8; // Action is more pill-shaped, State is slightly rounded box
    let fill = '#ecfdf5';
    
    // Check if we need to render internal behaviors (entry, exit, do)
    const intActs = entity.methods.filter(m => m.name === 'entry' || m.name === 'exit' || m.name === 'do');
    const h = Math.max(BOX_H, 40 + intActs.length * 15);
    
    s += `    <rect width="${BOX_W}" height="${h}" rx="${r}" fill="${fill}" stroke="#14b8a6" stroke-width="1.5" filter="url(#shadow)"/>\n`;
    s += `    <text x="${BOX_W / 2}" y="28" text-anchor="middle" font-size="13" font-weight="600" fill="#0f172a">${escapeXml(label)}</text>\n`;
    
    if (intActs.length > 0) {
      s += `    <line x1="0" y1="40" x2="${BOX_W}" y2="40" stroke="#14b8a6" stroke-width="1"/>\n`;
      let my = 55;
      for (const act of intActs) {
        s += `    <text x="10" y="${my}" font-size="11" fill="#334155"><tspan font-weight="600">${escapeXml(act.name)}</tspan> / ${escapeXml(act.returnType)}</text>\n`;
        my += 15;
      }
    }
  }

  s += `  </g>\n`;
  return s;
}
