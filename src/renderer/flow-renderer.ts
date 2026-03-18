// ============================================================
// Flow Diagram SVG Renderer
// ============================================================
// Renders flow diagrams with process boxes, decision diamonds,
// start/end nodes, fork/join bars, and connecting arrows.
// ============================================================

import type { IOMDiagram, IOMEntity } from '../semantics/iom.js';
import { escapeXml, svgDefs } from './utils.js';

const BOX_W        = 160;
const BOX_H        = 50;
const CIRCLE_R     = 18;
const DIAMOND_S    = 50;
const BAR_W        = 120;
const BAR_H        = 10;
const GAP_X        = 80;
const GAP_Y        = 60;
const GRID_COLS    = 4;

interface Placed {
  entity: IOMEntity;
  x: number;
  y: number;
}

export function renderFlowDiagram(diag: IOMDiagram): string {
  const entities = [...diag.entities.values()];
  if (entities.length === 0)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><text x="20" y="40" font-family="sans-serif" font-size="14">${escapeXml(diag.name)}: empty flow diagram</text></svg>`;

  const placed = placeEntities(entities);

  let maxX = 400, maxY = 300;
  for (const p of placed) {
    const dim = getDimensions(p.entity);
    maxX = Math.max(maxX, p.x + dim.w + 60);
    maxY = Math.max(maxY, p.y + dim.h + 60);
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" style="font-family:Segoe UI,Arial,sans-serif;background:#fafafa">\n`;
  svg += svgDefs();

  // Relations (draw first so entities render on top)
  for (const rel of diag.relations) {
    const f = placed.find(p => p.entity.name === rel.from);
    const t = placed.find(p => p.entity.name === rel.to);
    if (!f || !t) continue;
    const fDim = getDimensions(f.entity);
    const tDim = getDimensions(t.entity);

    const x1 = f.x + fDim.w / 2, y1 = f.y + fDim.h / 2;
    const x2 = t.x + tDim.w / 2, y2 = t.y + tDim.h / 2;
    const safeLabel = rel.label ? escapeXml(rel.label) : '';
    const dash = rel.kind === 'dependency' ? ' stroke-dasharray="6,3"' : '';

    svg += `  <g data-relation-id="${escapeXml(rel.id)}" data-relation-from="${escapeXml(rel.from)}" data-relation-to="${escapeXml(rel.to)}" data-relation-kind="${escapeXml(rel.kind)}" data-relation-label="${safeLabel}">`;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="15" style="cursor: pointer"/>`;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1e293b" stroke-width="1.5"${dash} marker-end="url(#arrow)"/>`;

    if (rel.label) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - 8;
      const labelWidth = rel.label.length * 7 + 12;
      svg += `<rect x="${mx - labelWidth / 2}" y="${my - 13}" width="${labelWidth}" height="18" rx="3" fill="white" opacity="0.95"/>`;
      svg += `<text x="${mx}" y="${my}" text-anchor="middle" font-size="11" fill="#475569">${safeLabel}</text>`;
    }
    svg += `</g>\n`;
  }

  // Entities
  for (const p of placed) {
    svg += renderEntity(p);
  }

  svg += `</svg>`;
  return svg;
}

function getDimensions(entity: IOMEntity): { w: number, h: number } {
  switch (entity.kind) {
    case 'start':
    case 'stop':    return { w: CIRCLE_R * 2, h: CIRCLE_R * 2 };
    case 'decision':
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

    if (!entity.position) {
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
  }

  return result;
}

function renderEntity(p: Placed): string {
  const { entity, x, y } = p;
  const label = entity.name;
  let s = `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(label)}">\n`;

  if (entity.kind === 'start') {
    // Filled circle
    s += `    <circle cx="${CIRCLE_R}" cy="${CIRCLE_R}" r="${CIRCLE_R}" fill="#1e293b"/>\n`;
    s += `    <text x="${CIRCLE_R}" y="${CIRCLE_R * 2 + 18}" text-anchor="middle" font-size="12" fill="#1e293b">${escapeXml(label)}</text>\n`;
  } else if (entity.kind === 'stop') {
    // Bull's eye (double circle)
    s += `    <circle cx="${CIRCLE_R}" cy="${CIRCLE_R}" r="${CIRCLE_R}" fill="none" stroke="#1e293b" stroke-width="2.5"/>\n`;
    s += `    <circle cx="${CIRCLE_R}" cy="${CIRCLE_R}" r="${CIRCLE_R - 6}" fill="#1e293b"/>\n`;
    s += `    <text x="${CIRCLE_R}" y="${CIRCLE_R * 2 + 18}" text-anchor="middle" font-size="12" fill="#1e293b">${escapeXml(label)}</text>\n`;
  } else if (entity.kind === 'decision' || entity.kind === 'merge') {
    // Diamond
    const hw = DIAMOND_S / 2;
    s += `    <polygon points="${hw},0 ${DIAMOND_S},${hw} ${hw},${DIAMOND_S} 0,${hw}" fill="url(#grad-flow)" stroke="#059669" stroke-width="1.5" filter="url(#shadow)"/>\n`;
    s += `    <text x="${hw}" y="${DIAMOND_S + 18}" text-anchor="middle" font-size="12" fill="#1e293b">${escapeXml(label)}</text>\n`;
  } else if (entity.kind === 'fork' || entity.kind === 'join') {
    // Horizontal bar
    s += `    <rect width="${BAR_W}" height="${BAR_H}" rx="3" fill="#1e293b"/>\n`;
    s += `    <text x="${BAR_W / 2}" y="${BAR_H + 18}" text-anchor="middle" font-size="12" fill="#1e293b">${escapeXml(label)}</text>\n`;
  } else {
    // Process / Action — rounded rectangle
    const stereo = entity.stereotype || entity.kind;
    const showStereo = entity.stereotype || (entity.kind !== 'component' && entity.kind !== 'action');
    s += `    <rect width="${BOX_W}" height="${BOX_H}" rx="10" fill="url(#grad-flow)" stroke="#059669" stroke-width="1.5" filter="url(#shadow)"/>\n`;
    if (showStereo && stereo && stereo !== 'component') {
      s += `    <text x="${BOX_W / 2}" y="16" text-anchor="middle" font-size="10" fill="#059669" font-style="italic">«${escapeXml(stereo)}»</text>\n`;
      s += `    <text x="${BOX_W / 2}" y="36" text-anchor="middle" font-size="13" font-weight="600" fill="#1e293b">${escapeXml(label)}</text>\n`;
    } else {
      s += `    <text x="${BOX_W / 2}" y="${BOX_H / 2 + 5}" text-anchor="middle" font-size="13" font-weight="600" fill="#1e293b">${escapeXml(label)}</text>\n`;
    }
  }

  s += `  </g>\n`;
  return s;
}
