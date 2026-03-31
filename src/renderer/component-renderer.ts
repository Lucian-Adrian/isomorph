// ============================================================
// Component / Deployment / Node Diagram SVG Renderer
// ============================================================
// Renders component and deployment diagrams.
// Components appear as rectangles with the «component» tag.
// Nodes appear as 3D-box (oblique-projection) shapes.
// ============================================================

import type { IOMDiagram, IOMEntity } from '../semantics/iom.js';
import { escapeXml, svgDefs, renderConfigHeaders, renderConfigLegend, renderConfigCaption, edgePointOnRect, rectCenter, computePortPositions } from './utils.js';

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

function entityHeight(entity: IOMEntity): number {
  const k = entity.kind;
  return (k === 'node' || k === 'device' || k === 'environment') ? NODE_H + DEPTH : COMP_H;
}

export function renderComponentDiagram(diag: IOMDiagram): string {
  const entities = [...diag.entities.values()];
  if (entities.length === 0)
    return emptyDiagram(diag.name);

  const placed = placeEntities(entities);

  const maxX = Math.max(...placed.map(p => p.x + BOX_W)) + 40;
  const maxY = Math.max(...placed.map(p => p.y + NODE_H + DEPTH)) + 40;

  const header = renderConfigHeaders(diag, maxX);
  const legend = renderConfigLegend(diag, maxX, header.height);
  const caption = renderConfigCaption(diag, maxX, maxY + header.height + 40);
  const totalH = maxY + header.height + caption.height + 40;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${totalH}" style="font-family:'DM Sans',system-ui,sans-serif;background:transparent">\n`;
  svg += svgDefs();
  svg += header.svg;
  svg += legend.svg;
  svg += `  <g transform="translate(0, ${header.height})">\n`;
  
  // 1. Draw Package Boundaries
  for (const pkg of diag.packages) {
    const pkgEntities = placed.filter(p => pkg.entityNames.includes(p.entity.name));
    if (pkgEntities.length === 0) continue;
    const minX = Math.min(...pkgEntities.map(p => p.x)) - 30;
    const minY = Math.min(...pkgEntities.map(p => p.y)) - 40;
    const maxX = Math.max(...pkgEntities.map(p => p.x + BOX_W)) + 30;
    const maxY = Math.max(...pkgEntities.map(p => p.y + NODE_H + DEPTH)) + 30;
    svg += `  <g data-package-name="${escapeXml(pkg.name)}">\n`;
    svg += `    <rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" rx="8" fill="rgba(148, 163, 184, 0.05)" stroke="var(--iso-border, #cbd5e1)" stroke-width="1.5" stroke-dasharray="8,4"/>\n`;
    svg += `    <text x="${minX + 8}" y="${minY + 22}" font-size="12" font-weight="600" fill="var(--iso-text-muted)">${escapeXml(pkg.name)}</text>\n`;
    svg += `  </g>\n`;
  }

  // 1.5 Draw Entity Containment (e.g. Node containing Artifacts)
  for (const ent of diag.entities.values()) {
    const nested = placed.filter(p => p.entity.package === ent.name);
    if (nested.length === 0) continue;
    const minX = Math.min(...nested.map(p => p.x)) - 25;
    const minY = Math.min(...nested.map(p => p.y)) - 25;
    const maxX = Math.max(...nested.map(p => p.x + BOX_W)) + 25;
    const maxY = Math.max(...nested.map(p => p.y + NODE_H + DEPTH)) + 25;
    svg += `  <g data-container-name="${escapeXml(ent.name)}">\n`;
    svg += `    <rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" rx="4" fill="rgba(34, 197, 94, 0.03)" stroke="rgba(34, 197, 94, 0.4)" stroke-width="1.5" stroke-dasharray="4,2"/>\n`;
    svg += `    <text x="${minX + 6}" y="${maxY - 8}" font-size="10" font-weight="600" fill="rgba(21, 128, 61, 0.8)">«contains ${nested.length} item(s)»</text>\n`;
    svg += `  </g>\n`;
  }

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

    const isProvides = rel.kind === 'provides';
    const isRequires = rel.kind === 'requires';

    const fIsLollipop = f.entity.kind === 'interface' && f.entity.stereotype === 'lollipop';
    const tIsLollipop = t.entity.kind === 'interface' && t.entity.stereotype === 'lollipop';

    let x1: number, y1: number, x2: number, y2: number;

    const fH = entityHeight(f.entity);
    const tH = entityHeight(t.entity);
    const fCenter = fIsLollipop ? { x: f.x + BOX_W/2, y: f.y + COMP_H/2 - 5 } : rectCenter(f.x, f.y, BOX_W, fH);
    const tCenter = tIsLollipop ? { x: t.x + BOX_W/2, y: t.y + COMP_H/2 - 5 } : rectCenter(t.x, t.y, BOX_W, tH);

    const getEdge = (p: Placed, isLoll: boolean, h: number, targetInfo: {x: number, y: number}, radius: number = 16) => {
        if (!isLoll) return edgePointOnRect(p.x, p.y, BOX_W, h, targetInfo.x, targetInfo.y);
        const cx = p.x + BOX_W / 2;
        const cy = p.y + COMP_H / 2 - 5;
        const dx = targetInfo.x - cx;
        const dy = targetInfo.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return { x: cx, y: cy };
        return { x: cx + (dx / dist) * radius, y: cy + (dy / dist) * radius };
    };

    let fromEdge = getEdge(f, fIsLollipop, fH, tCenter);
    let toEdge   = getEdge(t, tIsLollipop, tH, fCenter);

    if (isProvides || isRequires) {
      const fromPorts = computePortPositions(f.entity.fields, BOX_W, COMP_H);
      const toPorts = computePortPositions(t.entity.fields, BOX_W, COMP_H);

      if (isProvides) {
         if (!fIsLollipop) {
            const provPort = [...fromPorts.entries()].find(([, p]) => p.side === 'right');
            if (provPort) { fromEdge = { x: f.x + provPort[1].x, y: f.y + provPort[1].y }; }
            else { fromEdge = { x: f.x + BOX_W, y: f.y + COMP_H / 2 }; }
            toEdge = getEdge(t, tIsLollipop, tH, fromEdge);
         }
         if (!tIsLollipop) {
            const reqPort = [...toPorts.entries()].find(([, p]) => p.side === 'left');
            if (reqPort) { toEdge = { x: t.x + reqPort[1].x, y: t.y + reqPort[1].y }; }
         }
      } else {
         if (!fIsLollipop) {
            const reqPort = [...fromPorts.entries()].find(([, p]) => p.side === 'left');
            if (reqPort) { fromEdge = { x: f.x + reqPort[1].x, y: f.y + reqPort[1].y }; }
            else { fromEdge = { x: f.x, y: f.y + COMP_H / 2 }; }
            toEdge = getEdge(t, tIsLollipop, tH, fromEdge, tIsLollipop && isRequires ? 22 : 16);
         }
         if (!tIsLollipop) {
            const provPort = [...toPorts.entries()].find(([, p]) => p.side === 'right');
            if (provPort) { toEdge = { x: t.x + provPort[1].x, y: t.y + provPort[1].y }; }
         }
      }
    }

    x1 = fromEdge.x; y1 = fromEdge.y;
    x2 = toEdge.x; y2 = toEdge.y;

    const dash = rel.kind === 'dependency' ? ' stroke-dasharray="6,3"' : '';
    const safeLabel = rel.label ? escapeXml(rel.label) : '';
    
    const pairKey = [rel.from, rel.to].sort().join('::');
    const pairCount = relationPairCounts.get(pairKey) ?? 1;
    const pairIndex = relationPairIndexes.get(pairKey) ?? 0;
    relationPairIndexes.set(pairKey, pairIndex + 1);

    const hasOverlap = pairCount > 1;
    const offsetRank = pairIndex - (pairCount - 1) / 2;
    // ensure consistent bulge direction regardless of edge direction
    const sign = rel.from > rel.to ? -1 : 1;
    const curveOffset = hasOverlap ? offsetRank * 24 * sign : 0;

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
    svg += `<path d="${linePath}" stroke="var(--iso-text-muted)" stroke-width="1.5"${dash} fill="none"/>`;

    // Draw semantic endpoint markers for provides/requires
    if (isProvides) {
      if (!tIsLollipop && !fIsLollipop) {
        // Lollipop circle at source end (normal view)
        svg += `<circle cx="${x1}" cy="${y1}" r="6" fill="var(--iso-bg-panel)" stroke="#3b82f6" stroke-width="1.5"/>`;
      }
    } else if (isRequires) {
      if (tIsLollipop) {
        // Socket arc at TARGET end, cupping the lollipop
        const angle = Math.atan2(fCenter.y - tCenter.y, fCenter.x - tCenter.x);
        const arcStartAngle = angle - Math.PI / 4.5;
        const arcEndAngle = angle + Math.PI / 4.5;
        const sx1 = tCenter.x + 22 * Math.cos(arcStartAngle);
        const sy1 = tCenter.y + 22 * Math.sin(arcStartAngle);
        const sx2 = tCenter.x + 22 * Math.cos(arcEndAngle);
        const sy2 = tCenter.y + 22 * Math.sin(arcEndAngle);
        svg += `<path d="M ${sx1} ${sy1} A 22 22 0 0 1 ${sx2} ${sy2}" fill="none" stroke="#3b82f6" stroke-width="1.5"/>`;
      } else if (!fIsLollipop) {
        // Socket arc at source end based on start tangent
        const angle = hasOverlap ? Math.atan2(cy - y1, cx - x1) : Math.atan2(y2 - y1, x2 - x1);
        const arcX = x1 + Math.cos(angle) * 3;
        const arcY = y1 + Math.sin(angle) * 3;
        svg += `<path d="M ${arcX - 5 * Math.sin(angle)} ${arcY + 5 * Math.cos(angle)} A 5 5 0 0 1 ${arcX + 5 * Math.sin(angle)} ${arcY - 5 * Math.cos(angle)}" fill="none" stroke="#3b82f6" stroke-width="1.5"/>`;
      }
    }

    if (rel.label) {
      const mx = hasOverlap ? cx : (x1 + x2) / 2;
      const my = (hasOverlap ? cy : (y1 + y2) / 2) - 8;
      const labelWidth = safeLabel.length * 7 + 6;
      svg += `<rect x="${mx - labelWidth/2}" y="${my - 10}" width="${labelWidth}" height="14" fill="var(--iso-bg-panel)" opacity="0.9" rx="3"/>`;
      svg += `<text x="${mx}" y="${my}" text-anchor="middle" font-size="11" fill="var(--iso-text-muted)" font-style="italic">${safeLabel}</text>`;
    }
    svg += `</g>\n`;
  }

  // Entities
  for (const p of placed) {
    const k = p.entity.kind;
    if (k === 'interface' && p.entity.stereotype === 'lollipop') {
      svg += renderLollipopInterface(p);
    } else if (k === 'node' || k === 'device' || k === 'environment') {
      svg += renderNode(p);
    } else if (k === 'artifact') {
      svg += renderArtifact(p);
    } else {
      svg += renderComponent(p);
    }
  }

  svg += `  </g>\n`;
  svg += caption.svg;
  svg += `</svg>`;
  return svg;
}

function renderComponent(p: Placed): string {
  const { entity, x, y } = p;
  const label = entity.stereotype ? `«${entity.stereotype}»` : '«component»';
  let s = `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(entity.name)}">\n`;
  s += `    <rect width="${BOX_W}" height="${COMP_H}" rx="6" fill="var(--iso-bg-blue, #f0f9ff)" stroke="#3b82f6" stroke-width="1.5" filter="url(#shadow)"/>\n`;
  // Component icon (small nested-rect symbol in top-right)
  const ix = BOX_W - 22, iy = 8;
  s += `    <rect x="${ix}" y="${iy}" width="12" height="9" rx="1" fill="none" stroke="#3b82f6" stroke-width="1"/>\n`;
  s += `    <rect x="${ix - 4}" y="${iy + 2}" width="5" height="2" rx="0.5" fill="#3b82f6"/>\n`;
  s += `    <rect x="${ix - 4}" y="${iy + 5}" width="5" height="2" rx="0.5" fill="#3b82f6"/>\n`;
  s += `    <text x="${BOX_W / 2}" y="14" text-anchor="middle" font-size="10" fill="var(--iso-text-muted)" font-style="italic">${escapeXml(label)}</text>\n`;
  s += `    <text x="${BOX_W / 2}" y="33" text-anchor="middle" font-size="13" font-weight="600" fill="var(--iso-text)">${escapeXml(entity.name)}</text>\n`;
  // Draw ports
  const provided = entity.fields.filter(f => f.type === 'provided');
  const required = entity.fields.filter(f => f.type === 'required');
  const ports = entity.fields.filter(f => f.type === 'port');
  
  provided.forEach((f, i) => {
    const py = 12 + i * 20;
    s += `    <line x1="${BOX_W}" y1="${py}" x2="${BOX_W + 15}" y2="${py}" stroke="#3b82f6" stroke-width="1.5"/>\n`;
    s += `    <circle cx="${BOX_W + 20}" cy="${py}" r="5" fill="var(--iso-bg-panel)" stroke="#3b82f6" stroke-width="1.5"/>\n`;
    s += `    <text x="${BOX_W + 28}" y="${py + 3}" font-size="10" fill="var(--iso-text-body)">${escapeXml(f.name)}</text>\n`;
  });
  
  required.forEach((f, i) => {
    const py = 12 + i * 20;
    s += `    <line x1="0" y1="${py}" x2="-15" y2="${py}" stroke="#3b82f6" stroke-width="1.5"/>\n`;
    s += `    <path d="M -20 ${py - 5} A 5 5 0 0 0 -20 ${py + 5}" fill="none" stroke="#3b82f6" stroke-width="1.5"/>\n`;
    s += `    <text x="-24" y="${py + 3}" text-anchor="end" font-size="10" fill="var(--iso-text-body)">${escapeXml(f.name)}</text>\n`;
  });
  
  ports.forEach((f, i) => {
    const px = 20 + i * 20;
    s += `    <rect x="${px - 4}" y="${COMP_H - 4}" width="8" height="8" fill="var(--iso-bg-panel)" stroke="#3b82f6" stroke-width="1.5"/>\n`;
    s += `    <text x="${px}" y="${COMP_H + 14}" text-anchor="middle" font-size="10" fill="var(--iso-text-body)">${escapeXml(f.name)}</text>\n`;
  });

  s += `  </g>\n`;
  return s;
}

function renderArtifact(p: Placed): string {
  const { entity, x, y } = p;
  const label = entity.stereotype ? `«${entity.stereotype}»` : '«artifact»';
  let s = `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(entity.name)}">\n`;
  s += `    <path d="M 0 0 L ${BOX_W - 12} 0 L ${BOX_W} 12 L ${BOX_W} ${COMP_H} L 0 ${COMP_H} Z" fill="var(--iso-bg-purple, #fdf4ff)" stroke="#a855f7" stroke-width="1.5" filter="url(#shadow)"/>\n`;
  s += `    <polyline points="${BOX_W - 12} 0, ${BOX_W - 12} 12, ${BOX_W} 12" fill="none" stroke="#a855f7" stroke-width="1.5"/>\n`;
  // Icon outline
  s += `    <text x="${BOX_W / 2}" y="18" text-anchor="middle" font-size="10" fill="var(--iso-text-muted)" font-style="italic">${escapeXml(label)}</text>\n`;
  s += `    <text x="${BOX_W / 2}" y="36" text-anchor="middle" font-size="13" font-weight="600" fill="var(--iso-text)">${escapeXml(entity.name)}</text>\n`;
  s += `  </g>\n`;
  return s;
}

function renderLollipopInterface(p: Placed): string {
  const { entity, x, y } = p;
  const label = entity.name;
  let s = `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(entity.name)}">\n`;
  const cx = BOX_W / 2;
  const cy = COMP_H / 2 - 5;
  const r = 16;
  s += `    <circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--iso-bg-panel)" stroke="#3b82f6" stroke-width="2" filter="url(#shadow)"/>\n`;
  s += `    <text x="${cx}" y="${cy + r + 15}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--iso-text)">${escapeXml(label)}</text>\n`;
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
  s += `    <polygon points="0,${d} ${d},0 ${w + d},0 ${w},${d}" fill="var(--iso-bg-green, #dcfce7)" stroke="var(--iso-text, #22c55e)" stroke-width="1.5"/>\n`;
  // Right face
  s += `    <polygon points="${w},${d} ${w + d},0 ${w + d},${h} ${w},${h + d}" fill="var(--iso-bg-green, #bbf7d0)" stroke="var(--iso-text, #22c55e)" stroke-width="1.5"/>\n`;
  // Front face
  s += `    <rect x="0" y="${d}" width="${w}" height="${h}" rx="0" fill="url(#grad-interface)" stroke="var(--iso-text, #22c55e)" stroke-width="1.5" filter="url(#shadow)"/>\n`;
  s += `    <text x="${w / 2}" y="${d + 16}" text-anchor="middle" font-size="10" fill="var(--iso-text-muted)" font-style="italic">${escapeXml(label)}</text>\n`;
  s += `    <text x="${w / 2}" y="${d + 35}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--iso-text)">${escapeXml(entity.name)}</text>\n`;
  s += `  </g>\n`;
  return s;
}

/** Styled "not yet implemented" placeholder for sequence and flow diagrams */
export function renderPlaceholderDiagram(diag: IOMDiagram): string {
  const entities = [...diag.entities.values()];
  const canvasW = 640, canvasH = 200 + entities.length * 22;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" style="font-family:'DM Sans',system-ui,sans-serif;background:#fafafa">\n`;
  svg += `  <rect width="${canvasW}" height="${canvasH}" fill="var(--iso-bg-panel, #fafafa)"/>\n`;

  // Header band
  svg += `  <rect x="0" y="0" width="${canvasW}" height="60" fill="var(--iso-bg-panel, #f1f5f9)"/>\n`;
  svg += `  <text x="24" y="26" font-size="14" font-weight="600" fill="var(--iso-text-body)">${escapeXml(diag.name)}</text>\n`;
  svg += `  <text x="24" y="46" font-size="11" fill="var(--iso-text-muted)" font-style="italic">«${diag.kind} diagram» — renderer not yet implemented</text>\n`;

  // Entity list
  let rowY = 80;
  for (const e of entities) {
    svg += `  <text x="32" y="${rowY}" font-size="12" fill="var(--iso-text-muted)">`;
    svg += `<tspan fill="var(--iso-text-muted)">${escapeXml(e.kind)} </tspan>`;
    svg += `<tspan font-weight="600" fill="var(--iso-text)">${escapeXml(e.name)}</tspan>`;
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

  return result;
}

function emptyDiagram(_name: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>`;
}
