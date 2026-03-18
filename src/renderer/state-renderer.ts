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

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" style="font-family:Segoe UI,Arial,sans-serif;background:#fafafa">\n`;
  svg += svgDefs();

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
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1e293b" stroke-width="1.5" marker-end="url(#arrow)"/>`;
    
    if (rel.label) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - 8;
      svg += `<rect x="${mx - rel.label.length * 3.5 - 4}" y="${my - 12}" width="${rel.label.length * 7 + 8}" height="16" fill="white" opacity="0.9"/>`;
      svg += `<text x="${mx}" y="${my}" text-anchor="middle" font-size="11" fill="#333">${safeLabel}</text>`;
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
    s += `    <circle cx="${CIRCLE_R}" cy="${CIRCLE_R}" r="${CIRCLE_R}" fill="#1e293b"/>\n`;
    s += `    <text x="${CIRCLE_R}" y="${CIRCLE_R * 2 + 15}" text-anchor="middle" font-size="12" fill="#1e293b">${escapeXml(label)}</text>\n`;
  } else if (entity.kind === 'stop') {
    s += `    <circle cx="${CIRCLE_R}" cy="${CIRCLE_R}" r="${CIRCLE_R}" fill="none" stroke="#1e293b" stroke-width="2"/>\n`;
    s += `    <circle cx="${CIRCLE_R}" cy="${CIRCLE_R}" r="${CIRCLE_R - 6}" fill="#1e293b"/>\n`;
    s += `    <text x="${CIRCLE_R}" y="${CIRCLE_R * 2 + 15}" text-anchor="middle" font-size="12" fill="#1e293b">${escapeXml(label)}</text>\n`;
  } else if (entity.kind === 'history') {
    s += `    <circle cx="${CIRCLE_R}" cy="${CIRCLE_R}" r="${CIRCLE_R}" fill="white" stroke="#1e293b" stroke-width="1.5"/>\n`;
    s += `    <text x="${CIRCLE_R}" y="${CIRCLE_R + 5}" text-anchor="middle" font-size="14" font-weight="bold" fill="#1e293b">H</text>\n`;
    s += `    <text x="${CIRCLE_R}" y="${CIRCLE_R * 2 + 15}" text-anchor="middle" font-size="12" fill="#1e293b">${escapeXml(label)}</text>\n`;
  } else if (entity.kind === 'decision' || entity.kind === 'choice' || entity.kind === 'merge') {
    const hw = DIAMOND_S / 2;
    s += `    <polygon points="${hw},0 ${DIAMOND_S},${hw} ${hw},${DIAMOND_S} 0,${hw}" fill="white" stroke="#1e293b" stroke-width="1.5" filter="url(#shadow)"/>\n`;
    s += `    <text x="${hw}" y="${DIAMOND_S + 15}" text-anchor="middle" font-size="12" fill="#1e293b">${escapeXml(label)}</text>\n`;
  } else if (entity.kind === 'fork' || entity.kind === 'join') {
    s += `    <rect width="${BAR_W}" height="${BAR_H}" rx="2" fill="#1e293b"/>\n`;
    s += `    <text x="${BAR_W / 2}" y="${BAR_H + 15}" text-anchor="middle" font-size="12" fill="#1e293b">${escapeXml(label)}</text>\n`;
  } else {
    // Action / State / Composite / Concurrent node
    // Rounded rect
    const r = entity.kind === 'action' ? 16 : 8; // Action is more pill-shaped, State is slightly rounded box
    let fill = 'url(#grad-state)';
    
    // Check if we need to render internal behaviors (entry, exit, do)
    const intActs = entity.methods.filter(m => m.name === 'entry' || m.name === 'exit' || m.name === 'do');
    const h = Math.max(BOX_H, 40 + intActs.length * 15);
    
    s += `    <rect width="${BOX_W}" height="${h}" rx="${r}" fill="${fill}" stroke="#1e293b" stroke-width="1.5" filter="url(#shadow)"/>\n`;
    s += `    <text x="${BOX_W / 2}" y="20" text-anchor="middle" font-size="13" font-weight="bold" fill="#1e293b">${escapeXml(label)}</text>\n`;
    
    if (intActs.length > 0) {
      s += `    <line x1="0" y1="30" x2="${BOX_W}" y2="30" stroke="#1e293b" stroke-width="1"/>\n`;
      let my = 45;
      for (const act of intActs) {
        s += `    <text x="10" y="${my}" font-size="11" fill="#475569"><tspan font-weight="bold">${escapeXml(act.name)}</tspan> / ${escapeXml(act.returnType)}</text>\n`;
        my += 15;
      }
    }
  }

  s += `  </g>\n`;
  return s;
}
