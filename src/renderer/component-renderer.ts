// ============================================================
// Component / Deployment / Node Diagram SVG Renderer
// ============================================================
// Renders component and deployment diagrams.
// Components appear as rectangles with the «component» tag.
// Nodes appear as 3D-box (oblique-projection) shapes.
// ============================================================

import type { IOMDiagram, IOMEntity } from '../semantics/iom.js';
import { escapeXml, svgDefs } from './utils.js';

const BOX_W        = 160;
const COMP_H       = 48;
const NODE_H       = 54;
const GAP_X        = 80;
const GAP_Y        = 60;
const DEPTH        = 14;  // 3-D extrusion depth for nodes
const GRID_COLS    = 4;

interface Placed {
  entity: IOMEntity;
  x: number;
  y: number;
}

export function renderComponentDiagram(diag: IOMDiagram): string {
  const entities = [...diag.entities.values()];
  if (entities.length === 0)
    return emptyDiagram(diag.name);

  const placed = placeEntities(entities);

  const maxX = Math.max(...placed.map(p => p.x + BOX_W)) + 40;
  const maxY = Math.max(...placed.map(p => p.y + NODE_H + DEPTH)) + 40;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" style="font-family:Segoe UI,Arial,sans-serif;background:#f0f4f8">\n`;
  svg += svgDefs();

  // Relations
  for (const rel of diag.relations) {
    const f = placed.find(p => p.entity.name === rel.from);
    const t = placed.find(p => p.entity.name === rel.to);
    if (!f || !t) continue;
    const x1 = f.x + BOX_W / 2, y1 = f.y + COMP_H / 2;
    const x2 = t.x + BOX_W / 2, y2 = t.y + COMP_H / 2;
    const dash = rel.kind === 'dependency' ? ' stroke-dasharray="6,3"' : '';
    svg += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#64748b" stroke-width="1.5"${dash}/>\n`;
  }

  // Entities
  for (const p of placed) {
    svg += p.entity.kind === 'node'
      ? renderNode(p)
      : renderComponent(p);
  }

  svg += `</svg>`;
  return svg;
}

function renderComponent(p: Placed): string {
  const { entity, x, y } = p;
  const label = entity.stereotype ? `«${entity.stereotype}»` : '«component»';
  let s = `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(entity.name)}">\n`;
  s += `    <rect width="${BOX_W}" height="${COMP_H}" rx="4" fill="white" stroke="#64748b" stroke-width="1.5" filter="url(#shadow)"/>\n`;
  // Component icon (small nested-rect symbol in top-right)
  const ix = BOX_W - 22, iy = 8;
  s += `    <rect x="${ix}" y="${iy}" width="12" height="9" rx="1" fill="none" stroke="#94a3b8" stroke-width="1"/>\n`;
  s += `    <rect x="${ix - 4}" y="${iy + 2}" width="5" height="2" rx="0.5" fill="#94a3b8"/>\n`;
  s += `    <rect x="${ix - 4}" y="${iy + 5}" width="5" height="2" rx="0.5" fill="#94a3b8"/>\n`;
  s += `    <text x="${BOX_W / 2}" y="14" text-anchor="middle" font-size="10" fill="#64748b" font-style="italic">${escapeXml(label)}</text>\n`;
  s += `    <text x="${BOX_W / 2}" y="33" text-anchor="middle" font-size="13" font-weight="600" fill="#1e293b">${escapeXml(entity.name)}</text>\n`;
  s += `  </g>\n`;
  return s;
}

function renderNode(p: Placed): string {
  const { entity, x, y } = p;
  const w = BOX_W, h = NODE_H, d = DEPTH;
  let s = `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(entity.name)}">\n`;
  // 3-D box top face
  s += `    <polygon points="0,${d} ${d},0 ${w + d},0 ${w},${d}" fill="#cbd5e1" stroke="#475569" stroke-width="1.2"/>\n`;
  // Right face
  s += `    <polygon points="${w},${d} ${w + d},0 ${w + d},${h} ${w},${h + d}" fill="#e2e8f0" stroke="#475569" stroke-width="1.2"/>\n`;
  // Front face
  s += `    <rect x="0" y="${d}" width="${w}" height="${h}" rx="0" fill="white" stroke="#475569" stroke-width="1.2" filter="url(#shadow)"/>\n`;
  s += `    <text x="${w / 2}" y="${d + 16}" text-anchor="middle" font-size="10" fill="#64748b" font-style="italic">«node»</text>\n`;
  s += `    <text x="${w / 2}" y="${d + 35}" text-anchor="middle" font-size="13" font-weight="600" fill="#1e293b">${escapeXml(entity.name)}</text>\n`;
  s += `  </g>\n`;
  return s;
}

/** Styled "not yet implemented" placeholder for sequence and flow diagrams */
export function renderPlaceholderDiagram(diag: IOMDiagram): string {
  const entities = [...diag.entities.values()];
  const canvasW = 640, canvasH = 200 + entities.length * 22;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" style="font-family:Segoe UI,Arial,sans-serif;background:#fafafa">\n`;
  svg += `  <rect width="${canvasW}" height="${canvasH}" fill="#fafafa"/>\n`;

  // Header band
  svg += `  <rect x="0" y="0" width="${canvasW}" height="60" fill="#f1f5f9"/>\n`;
  svg += `  <text x="24" y="26" font-size="14" font-weight="600" fill="#334155">${escapeXml(diag.name)}</text>\n`;
  svg += `  <text x="24" y="46" font-size="11" fill="#64748b" font-style="italic">«${diag.kind} diagram» — renderer not yet implemented</text>\n`;

  // Entity list
  let rowY = 80;
  for (const e of entities) {
    svg += `  <text x="32" y="${rowY}" font-size="12" fill="#475569">`;
    svg += `<tspan fill="#94a3b8">${escapeXml(e.kind)} </tspan>`;
    svg += `<tspan font-weight="600" fill="#1e293b">${escapeXml(e.name)}</tspan>`;
    svg += `</text>\n`;
    rowY += 22;
  }

  svg += `</svg>`;
  return svg;
}

// ─── Helpers ─────────────────────────────────────────────────

function placeEntities(entities: IOMEntity[]): Placed[] {
  const result: Placed[] = [];
  let col = 0;
  let curX = 40, curY = 40;
  let maxRowH = 0;

  for (const entity of entities) {
    const h = entity.kind === 'node' ? NODE_H + DEPTH : COMP_H;
    const pos = entity.position
      ? { x: entity.position.x, y: entity.position.y }
      : { x: curX, y: curY };

    result.push({ entity, x: pos.x, y: pos.y });

    if (!entity.position) {
      maxRowH = Math.max(maxRowH, h);
      col++;
      curX += BOX_W + GAP_X;
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

function emptyDiagram(name: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><text x="20" y="40" font-family="sans-serif" font-size="14">${escapeXml(name)}: empty diagram</text></svg>`;
}
