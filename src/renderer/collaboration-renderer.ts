// ============================================================
// Collaboration (Communication) Diagram SVG Renderer
// ============================================================
// Renders objects, multiobjects, active objects, and actors.
// ============================================================

import type { IOMDiagram, IOMEntity } from '../semantics/iom.js';
import { escapeXml, svgDefs, renderConfigHeaders, renderConfigLegend, renderConfigCaption } from './utils.js';

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

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function renderCollaborationDiagram(diag: IOMDiagram): string {
  const entities = [...diag.entities.values()];
  if (entities.length === 0)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>`;

  const placed = placeEntities(entities);
  const blockedAreas = buildEntityCollisionRects(placed);
  const reservedLabelAreas: Rect[] = [];

  let maxX = 400, maxY = 300;
  for (const p of placed) {
    maxX = Math.max(maxX, p.x + BOX_W + 40);
    maxY = Math.max(maxY, p.y + BOX_H + 50); // actors take more height
  }

  const header = renderConfigHeaders(diag, maxX);
  const legend = renderConfigLegend(diag, maxX, header.height);
  const caption = renderConfigCaption(diag, maxX, maxY + header.height + 40);
  const totalH = maxY + header.height + caption.height + 40;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${totalH}" style="font-family:'DM Sans',system-ui,sans-serif;background:transparent">\n`;
  svg += svgDefs();
  svg += header.svg;
  svg += legend.svg;
  svg += `  <g transform="translate(0, ${header.height})">\n`;

  const relationPairCounts = new Map<string, number>();
  const relationPairIndexes = new Map<string, number>();
  for (const rel of diag.relations) {
    const key = [rel.from, rel.to].sort().join('::');
    relationPairCounts.set(key, (relationPairCounts.get(key) ?? 0) + 1);
  }

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
    const pairKey = [rel.from, rel.to].sort().join('::');
    const pairCount = relationPairCounts.get(pairKey) ?? 1;
    const pairIndex = relationPairIndexes.get(pairKey) ?? 0;
    relationPairIndexes.set(pairKey, pairIndex + 1);

    const hasOverlap = pairCount > 1;
    const offsetRank = pairIndex - (pairCount - 1) / 2;
    const curveOffset = hasOverlap ? offsetRank * 22 : 0;

    const vx = x2 - x1;
    const vy = y2 - y1;
    const len = Math.max(1, Math.hypot(vx, vy));
    const nx = -vy / len;
    const ny = vx / len;
    const cx = (x1 + x2) / 2 + nx * curveOffset;
    const cy = (y1 + y2) / 2 + ny * curveOffset;

    const linePath = hasOverlap
      ? `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
      : `M ${x1} ${y1} L ${x2} ${y2}`;
    
    svg += `  <g data-relation-id="${escapeXml(rel.id)}" data-relation-from="${escapeXml(rel.from)}" data-relation-to="${escapeXml(rel.to)}" data-relation-kind="${escapeXml(rel.kind)}" data-relation-label="${safeLabel}">`;
    svg += `<path d="${linePath}" stroke="transparent" stroke-width="15" fill="none" style="cursor: pointer"/>`;
    svg += `<path d="${linePath}" stroke="var(--iso-text-muted)" stroke-width="1.5" stroke-dasharray="0" fill="none"/>`;
    
    if (rel.label) {
      const mx = hasOverlap ? cx : (x1 + x2) / 2;
      const my = (hasOverlap ? cy : (y1 + y2) / 2) - 8;
      // Draw message direction arrow (just arbitrary heuristics)
      const isLeftToRight = x2 > x1;
      const arrow = isLeftToRight ? '→' : '←';
      const displayText = `${rel.label} ${arrow}`;
      const safeText = escapeXml(displayText);
      const labelWidth = displayText.length * 7 + 8;
      const labelHeight = 16;
      const preferredOffsets: Array<{ dx: number; dy: number }> = [
        { dx: 0, dy: 0 },
        { dx: 0, dy: -20 },
        { dx: 0, dy: 20 },
        { dx: nx * 20, dy: ny * 20 },
        { dx: -nx * 20, dy: -ny * 20 },
        { dx: nx * 34, dy: ny * 34 },
        { dx: -nx * 34, dy: -ny * 34 },
        { dx: 0, dy: -36 },
        { dx: 0, dy: 36 },
      ];

      let chosenRect: Rect | null = null;
      let chosenX = mx;
      let chosenY = my;
      for (const offset of preferredOffsets) {
        const cxLabel = mx + offset.dx;
        const cyLabel = my + offset.dy;
        const candidate: Rect = {
          x: cxLabel - labelWidth / 2,
          y: cyLabel - 12,
          w: labelWidth,
          h: labelHeight,
        };
        const collidesWithEntity = blockedAreas.some(rect => intersects(rect, candidate));
        const collidesWithLabel = reservedLabelAreas.some(rect => intersects(rect, candidate));
        if (!collidesWithEntity && !collidesWithLabel) {
          chosenRect = candidate;
          chosenX = cxLabel;
          chosenY = cyLabel;
          break;
        }
      }

      if (!chosenRect) {
        chosenRect = {
          x: mx - labelWidth / 2,
          y: my - 12,
          w: labelWidth,
          h: labelHeight,
        };
      }
      reservedLabelAreas.push(chosenRect);

      svg += `<rect x="${chosenRect.x}" y="${chosenRect.y}" width="${chosenRect.w}" height="${chosenRect.h}" fill="var(--iso-bg-panel)" opacity="0.9"/>`;
      svg += `<text x="${chosenX}" y="${chosenY}" text-anchor="middle" font-size="11" fill="var(--iso-text-body)">${safeText}</text>`;
    }
    svg += `</g>\n`;
  }

  // Entities
  for (const p of placed) {
    svg += renderEntity(p);
  }

  svg += `  </g>\n`;
  svg += caption.svg;
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
  const label = `${entity.name}${entity.stereotype ? ': ' + entity.stereotype : ''}`;
  const nameOnly = entity.name;
  let s = `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(nameOnly)}">\n`;

  if (entity.kind === 'actor') {
     // Center actor in its BOX_W slot
     const cx = BOX_W / 2;
     s += `    <circle cx="${cx}" cy="15" r="10" fill="var(--iso-bg-panel)" stroke="var(--iso-text-muted)" stroke-width="1.5" filter="url(#shadow)"/>\n`;
     s += `    <line x1="${cx}" y1="25" x2="${cx}" y2="50" stroke="var(--iso-text-muted)" stroke-width="1.5"/>\n`;
     s += `    <line x1="${cx - 15}" y1="35" x2="${cx + 15}" y2="35" stroke="var(--iso-text-muted)" stroke-width="1.5"/>\n`;
     s += `    <line x1="${cx}" y1="50" x2="${cx - 10}" y2="70" stroke="var(--iso-text-muted)" stroke-width="1.5"/>\n`;
     s += `    <line x1="${cx}" y1="50" x2="${cx + 10}" y2="70" stroke="var(--iso-text-muted)" stroke-width="1.5"/>\n`;
     s += `    <text x="${cx}" y="85" text-anchor="middle" font-size="12" font-weight="500" fill="var(--iso-text)">${escapeXml(nameOnly)}</text>\n`;
  } else {
    // Object, Active Object, Multiobject
    const textHtml = `<text x="${BOX_W / 2}" y="30" text-anchor="middle" font-size="13" font-weight="600" text-decoration="underline" fill="var(--iso-text)">${escapeXml(label)}</text>`;
    
    if (entity.kind === 'multiobject') {
      s += `    <rect x="5" y="-5" width="${BOX_W}" height="${BOX_H}" fill="var(--iso-bg-panel)" stroke="var(--iso-text-muted)" stroke-width="1.5"/>\n`;
      s += `    <rect x="0" y="0" width="${BOX_W}" height="${BOX_H}" fill="var(--iso-bg-panel)" stroke="var(--iso-text-muted)" stroke-width="1.5" filter="url(#shadow)"/>\n`;
    } else if (entity.kind === 'active_object') {
      s += `    <rect width="${BOX_W}" height="${BOX_H}" fill="var(--iso-bg-panel)" stroke="var(--iso-text-muted)" stroke-width="2" filter="url(#shadow)"/>\n`;
      s += `    <line x1="10" y1="0" x2="10" y2="${BOX_H}" stroke="var(--iso-text-muted)" stroke-width="1"/>\n`;
      s += `    <line x1="${BOX_W - 10}" y1="0" x2="${BOX_W - 10}" y2="${BOX_H}" stroke="var(--iso-text-muted)" stroke-width="1"/>\n`;
    } else {
      // standard object or composite object
      s += `    <rect width="${BOX_W}" height="${BOX_H}" fill="var(--iso-bg-panel)" stroke="var(--iso-text-muted)" stroke-width="1.5" filter="url(#shadow)"/>\n`;
    }
    s += textHtml + '\n';
  }

  s += `  </g>\n`;
  return s;
}

function buildEntityCollisionRects(placed: Placed[]): Rect[] {
  const rects: Rect[] = [];
  for (const p of placed) {
    const bodyHeight = p.entity.kind === 'actor' ? 80 : BOX_H;
    rects.push({ x: p.x - 6, y: p.y - 6, w: BOX_W + 12, h: bodyHeight + 12 });

    const name = p.entity.name;
    if (p.entity.kind === 'actor') {
      const w = Math.max(40, name.length * 7 + 8);
      rects.push({ x: p.x + BOX_W / 2 - w / 2, y: p.y + 73, w, h: 16 });
    } else {
      const label = `${p.entity.name}${p.entity.stereotype ? ': ' + p.entity.stereotype : ''}`;
      const w = Math.max(50, label.length * 7 + 8);
      rects.push({ x: p.x + BOX_W / 2 - w / 2, y: p.y + 20, w, h: 16 });
    }
  }
  return rects;
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
