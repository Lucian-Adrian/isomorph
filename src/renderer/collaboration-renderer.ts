// ============================================================
// Collaboration (Communication) Diagram SVG Renderer
// ============================================================
// Renders objects, multiobjects, active objects, and actors.
// ============================================================

import type { IOMDiagram, IOMEntity } from '../semantics/iom.js';
import { escapeXml, svgDefs } from './utils.js';

const BOX_W        = 140;
const BOX_H        = 50;
const GAP_X        = 80;
const GAP_Y        = 60;
const GRID_COLS    = 4;

interface Placed {
  entity: IOMEntity;
  x: number;
  y: number;
}

export function renderCollaborationDiagram(diag: IOMDiagram): string {
  const entities = [...diag.entities.values()];
  if (entities.length === 0)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><text x="20" y="40" font-family="sans-serif" font-size="14">${escapeXml(diag.name)}: empty diagram</text></svg>`;

  const placed = placeEntities(entities);

  let maxX = 400, maxY = 300;
  for (const p of placed) {
    maxX = Math.max(maxX, p.x + BOX_W + 40);
    maxY = Math.max(maxY, p.y + BOX_H + 50); // actors take more height
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" style="font-family:Segoe UI,Arial,sans-serif;background:#fafafa">\n`;
  svg += svgDefs();

  // Relations
  for (const rel of diag.relations) {
    const f = placed.find(p => p.entity.name === rel.from);
    const t = placed.find(p => p.entity.name === rel.to);
    if (!f || !t) continue;
    
    // For actors, center is lower
    const getCenter = (p: Placed) => {
       if (p.entity.kind === 'actor') return { cx: p.x + BOX_W / 2, cy: p.y + 45 };
       return { cx: p.x + BOX_W / 2, cy: p.y + BOX_H / 2 };
    };
    const { cx: x1, cy: y1 } = getCenter(f);
    const { cx: x2, cy: y2 } = getCenter(t);
    const safeLabel = rel.label ? escapeXml(rel.label) : '';
    
    svg += `  <g data-relation-id="${escapeXml(rel.id)}" data-relation-from="${escapeXml(rel.from)}" data-relation-to="${escapeXml(rel.to)}" data-relation-kind="${escapeXml(rel.kind)}" data-relation-label="${safeLabel}">`;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="15" style="cursor: pointer"/>`;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1e293b" stroke-width="1.5" stroke-dasharray="0" />`;
    
    if (rel.label) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - 8;
      // Draw message direction arrow (just arbitrary heuristics)
      const isLeftToRight = x2 > x1;
      const arrow = isLeftToRight ? '→' : '←';
      const text = `${safeLabel} ${arrow}`;
      svg += `<rect x="${mx - text.length * 3.5 - 4}" y="${my - 12}" width="${text.length * 7 + 8}" height="16" fill="white" opacity="0.9"/>`;
      svg += `<text x="${mx}" y="${my}" text-anchor="middle" font-size="11" fill="#333">${escapeXml(text)}</text>`;
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

function placeEntities(entities: IOMEntity[]): Placed[] {
  const result: Placed[] = [];
  let col = 0;
  let curX = 40, curY = 40;
  let maxRowH = 0;

  for (const entity of entities) {
    const dim = { w: BOX_W, h: entity.kind === 'actor' ? 80 : BOX_H };
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
  const label = `${entity.name}${entity.stereotype ? ': ' + entity.stereotype : ''}`;
  const nameOnly = entity.name;
  let s = `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(nameOnly)}">\n`;

  if (entity.kind === 'actor') {
     // Center actor in its BOX_W slot
     const cx = BOX_W / 2;
     s += `    <circle cx="${cx}" cy="15" r="10" fill="white" stroke="#334155" stroke-width="1.5"/>\n`;
     s += `    <line x1="${cx}" y1="25" x2="${cx}" y2="50" stroke="#334155" stroke-width="1.5"/>\n`;
     s += `    <line x1="${cx - 15}" y1="35" x2="${cx + 15}" y2="35" stroke="#334155" stroke-width="1.5"/>\n`;
     s += `    <line x1="${cx}" y1="50" x2="${cx - 10}" y2="70" stroke="#334155" stroke-width="1.5"/>\n`;
     s += `    <line x1="${cx}" y1="50" x2="${cx + 10}" y2="70" stroke="#334155" stroke-width="1.5"/>\n`;
     s += `    <text x="${cx}" y="85" text-anchor="middle" font-size="12" font-weight="500" fill="#1e293b">${escapeXml(nameOnly)}</text>\n`;
  } else {
    // Object, Active Object, Multiobject
    const textHtml = `<text x="${BOX_W / 2}" y="30" text-anchor="middle" font-size="13" font-weight="bold" text-decoration="underline" fill="#1e293b">${escapeXml(label)}</text>`;
    
    if (entity.kind === 'multiobject') {
      s += `    <rect x="5" y="-5" width="${BOX_W}" height="${BOX_H}" fill="white" stroke="#1e293b" stroke-width="1.5"/>\n`;
      s += `    <rect x="0" y="0" width="${BOX_W}" height="${BOX_H}" fill="white" stroke="#1e293b" stroke-width="1.5" filter="url(#shadow)"/>\n`;
    } else if (entity.kind === 'active_object') {
      s += `    <rect width="${BOX_W}" height="${BOX_H}" fill="white" stroke="#1e293b" stroke-width="3" filter="url(#shadow)"/>\n`;
      s += `    <line x1="10" y1="0" x2="10" y2="${BOX_H}" stroke="#1e293b" stroke-width="1"/>\n`;
      s += `    <line x1="${BOX_W - 10}" y1="0" x2="${BOX_W - 10}" y2="${BOX_H}" stroke="#1e293b" stroke-width="1"/>\n`;
    } else {
      // standard object or composite object
      s += `    <rect width="${BOX_W}" height="${BOX_H}" fill="white" stroke="#1e293b" stroke-width="1.5" filter="url(#shadow)"/>\n`;
    }
    s += textHtml + '\n';
  }

  s += `  </g>\n`;
  return s;
}
