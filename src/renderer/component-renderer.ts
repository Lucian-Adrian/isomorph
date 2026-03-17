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
    const safeLabel = rel.label ? escapeXml(rel.label) : '';
    svg += `  <g data-relation-id="${escapeXml(rel.id)}" data-relation-from="${escapeXml(rel.from)}" data-relation-to="${escapeXml(rel.to)}" data-relation-kind="${escapeXml(rel.kind)}" data-relation-label="${safeLabel}">`;      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="15" style="cursor: pointer"/>`;    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#64748b" stroke-width="1.5"${dash}/>`;
    if (rel.label) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - 6;
      svg += `<text x="${mx}" y="${my}" text-anchor="middle" font-size="11" fill="#475569" font-style="italic">${safeLabel}</text>`;
    }
    svg += `</g>\n`;
  }

  // Entities
  for (const p of placed) {
    const k = p.entity.kind;
    if (k === 'node' || k === 'device' || k === 'environment') {
      svg += renderNode(p);
    } else if (k === 'artifact') {
      svg += renderArtifact(p);
    } else {
      svg += renderComponent(p);
    }
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
  // Draw ports
  const provided = entity.fields.filter(f => f.type === 'provided');
  const required = entity.fields.filter(f => f.type === 'required');
  const ports = entity.fields.filter(f => f.type === 'port');
  
  provided.forEach((f, i) => {
    const py = 12 + i * 20;
    s += `    <line x1="${BOX_W}" y1="${py}" x2="${BOX_W + 15}" y2="${py}" stroke="#64748b" stroke-width="1.5"/>\n`;
    s += `    <circle cx="${BOX_W + 20}" cy="${py}" r="5" fill="white" stroke="#64748b" stroke-width="1.5"/>\n`;
    s += `    <text x="${BOX_W + 28}" y="${py + 3}" font-size="10" fill="#475569">${escapeXml(f.name)}</text>\n`;
  });
  
  required.forEach((f, i) => {
    const py = 12 + i * 20;
    s += `    <line x1="0" y1="${py}" x2="-15" y2="${py}" stroke="#64748b" stroke-width="1.5"/>\n`;
    s += `    <path d="M -20 ${py - 5} A 5 5 0 0 0 -20 ${py + 5}" fill="none" stroke="#64748b" stroke-width="1.5"/>\n`;
    s += `    <text x="-24" y="${py + 3}" text-anchor="end" font-size="10" fill="#475569">${escapeXml(f.name)}</text>\n`;
  });
  
  ports.forEach((f, i) => {
    const px = 20 + i * 20;
    s += `    <rect x="${px - 4}" y="${COMP_H - 4}" width="8" height="8" fill="white" stroke="#64748b" stroke-width="1.5"/>\n`;
    s += `    <text x="${px}" y="${COMP_H + 14}" text-anchor="middle" font-size="10" fill="#475569">${escapeXml(f.name)}</text>\n`;
  });

  s += `  </g>\n`;
  return s;
}

function renderArtifact(p: Placed): string {
  const { entity, x, y } = p;
  const label = entity.stereotype ? `«${entity.stereotype}»` : '«artifact»';
  let s = `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(entity.name)}">\n`;
  s += `    <path d="M 0 0 L ${BOX_W - 12} 0 L ${BOX_W} 12 L ${BOX_W} ${COMP_H} L 0 ${COMP_H} Z" fill="white" stroke="#64748b" stroke-width="1.5" filter="url(#shadow)"/>\n`;
  s += `    <polyline points="${BOX_W - 12} 0, ${BOX_W - 12} 12, ${BOX_W} 12" fill="none" stroke="#64748b" stroke-width="1.5"/>\n`;
  // Icon outline
  s += `    <text x="${BOX_W / 2}" y="18" text-anchor="middle" font-size="10" fill="#64748b" font-style="italic">${escapeXml(label)}</text>\n`;
  s += `    <text x="${BOX_W / 2}" y="36" text-anchor="middle" font-size="13" font-weight="600" fill="#1e293b">${escapeXml(entity.name)}</text>\n`;
  s += `  </g>\n`;
  return s;
}

function renderNode(p: Placed): string {
  const { entity, x, y } = p;
  const defaultLabel = entity.kind === 'device' ? '«device»' : entity.kind === 'environment' ? '«execution environment»' : '«node»';
  const label = entity.stereotype ? `«${entity.stereotype}»` : defaultLabel;
  const w = BOX_W, h = NODE_H, d = DEPTH;
  let s = `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(entity.name)}">\n`;
  // 3-D box top face
  s += `    <polygon points="0,${d} ${d},0 ${w + d},0 ${w},${d}" fill="#cbd5e1" stroke="#475569" stroke-width="1.2"/>\n`;
  // Right face
  s += `    <polygon points="${w},${d} ${w + d},0 ${w + d},${h} ${w},${h + d}" fill="#e2e8f0" stroke="#475569" stroke-width="1.2"/>\n`;
  // Front face
  s += `    <rect x="0" y="${d}" width="${w}" height="${h}" rx="0" fill="white" stroke="#475569" stroke-width="1.2" filter="url(#shadow)"/>\n`;
  s += `    <text x="${w / 2}" y="${d + 16}" text-anchor="middle" font-size="10" fill="#64748b" font-style="italic">${escapeXml(label)}</text>\n`;
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
    const k = entity.kind;
    const h = (k === 'node' || k === 'device' || k === 'environment') ? NODE_H + DEPTH : COMP_H;
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
