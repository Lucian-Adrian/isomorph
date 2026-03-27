// ============================================================
// Use-Case Diagram SVG Renderer
// ============================================================

import type { IOMDiagram } from '../semantics/iom.js';
import { escapeXml, wrapText, svgDefs, renderConfigHeaders, renderConfigLegend, renderConfigCaption, edgePointOnRect } from './utils.js';

function pickDefaultBoundaryName(diag: IOMDiagram): string {
  const used = new Set([...diag.entities.keys()]);
  if (!used.has('System')) return 'System';
  if (!used.has('SystemBoundary')) return 'SystemBoundary';
  let idx = 1;
  let candidate = `SystemBoundary${idx}`;
  while (used.has(candidate)) {
    idx++;
    candidate = `SystemBoundary${idx}`;
  }
  return candidate;
}

export function renderUseCaseDiagram(diag: IOMDiagram): string {
  const entities = [...diag.entities.values()];
  if (entities.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>';

  // Separate into actors, use-cases, and boundaries
  const actors   = entities.filter(e => e.kind === 'actor');
  const usecases = entities.filter(e => e.kind === 'usecase');
  const bounds   = entities.filter(e => e.kind === 'system' || e.kind === 'boundary');

  const UC_RX = 80, UC_RY = 40;

  let canvasW = 900;
  let canvasH = 600;

  const maxTotal = Math.max(actors.filter(a=>!a.position).length, usecases.filter(u=>!u.position).length);
  canvasH = Math.max(canvasH, maxTotal * 140 + 100);

  for (const ent of entities) {
    if (ent.position) {
      canvasW = Math.max(canvasW, ent.position.x + 200);
      canvasH = Math.max(canvasH, ent.position.y + 200);
    }
  }

  // Auto-assign positions if missing
  function pos(e: typeof entities[0], i: number, total: number, xBase: number) {
    if (e.position) return { x: e.position.x, y: e.position.y };
    const rowH = canvasH / (total + 1);
    return { x: xBase, y: rowH * (i + 1) };
  }

  const actorPositions   = actors.map((a, i) => ({ e: a, p: pos(a, i, actors.length, 80) }));
  const ucPositions      = usecases.map((u, i) => ({ e: u, p: pos(u, i, usecases.length, 350) }));
  
  const header = renderConfigHeaders(diag, canvasW);
  const legend = renderConfigLegend(diag, canvasW, header.height);
  const caption = renderConfigCaption(diag, canvasW, canvasH + header.height + 40);
  const totalH = canvasH + header.height + caption.height + 40;
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${totalH}" style="font-family:'DM Sans',system-ui,sans-serif;background:transparent">\n`;
  svg += svgDefs();
  svg += header.svg;
  svg += legend.svg;
  svg += `  <g transform="translate(0, ${header.height})">\n`;

  // Draw system boundaries (backgrounds)
  if (bounds.length > 0) {
    for (const b of bounds) {
      const bx = b.position ? b.position.x : 280;
      const by = b.position ? b.position.y : 30;
      const bw = Number.isFinite(b.position?.w) ? Math.max(180, Number(b.position!.w)) : 500;
      const bh = Number.isFinite(b.position?.h) ? Math.max(140, Number(b.position!.h)) : 400;
      svg += `  <g transform="translate(${bx},${by})" data-entity-name="${escapeXml(b.name)}" data-boundary-entity="true" data-entity-width="${Math.round(bw)}" data-entity-height="${Math.round(bh)}">\n`;
      svg += `    <rect data-boundary-body="true" x="0" y="0" width="${bw}" height="${bh}" fill="var(--iso-bg-panel, #fafafa)" stroke="var(--iso-border, #cbd5e1)" stroke-width="1.5" stroke-dasharray="8,4"/>\n`;
      svg += `    <text data-boundary-title="true" x="10" y="20" font-size="13" font-weight="600" fill="var(--iso-text-muted)">${escapeXml(b.name)}</text>\n`;
      svg += `    <rect data-resize-handle="e" x="${bw - 4}" y="${bh / 2 - 10}" width="8" height="20" rx="2" fill="#3b82f6" opacity="0.55" style="cursor: ew-resize"/>\n`;
      svg += `    <rect data-resize-handle="s" x="${bw / 2 - 10}" y="${bh - 4}" width="20" height="8" rx="2" fill="#3b82f6" opacity="0.55" style="cursor: ns-resize"/>\n`;
      svg += `    <rect data-resize-handle="se" x="${bw - 6}" y="${bh - 6}" width="12" height="12" rx="3" fill="#2563eb" opacity="0.75" style="cursor: nwse-resize"/>\n`;
      svg += `  </g>\n`;
    }
  } else {
    // Default boundary is exposed as a pseudo-system entity so it can be edited/moved and then promoted to source.
    const defaultBoundaryName = pickDefaultBoundaryName(diag);
    const defaultX = 280;
    const defaultY = 30;
    const defaultW = 580;
    const defaultH = Math.max(220, canvasH - 60);
    svg += `  <g transform="translate(${defaultX},${defaultY})" data-entity-name="${escapeXml(defaultBoundaryName)}" data-boundary-entity="true" data-default-usecase-boundary="true" data-entity-width="${defaultW}" data-entity-height="${defaultH}">\n`;
    svg += `    <rect data-boundary-body="true" x="0" y="0" width="${defaultW}" height="${defaultH}" rx="8" fill="var(--iso-bg-panel, #fafafa)" stroke="var(--iso-border, #cbd5e1)" stroke-width="1.5" stroke-dasharray="8,4"/>\n`;
    svg += `    <text data-boundary-title="true" x="10" y="22" font-size="13" fill="var(--iso-text-muted)" font-style="italic">${escapeXml(defaultBoundaryName)}</text>\n`;
    svg += `    <rect data-resize-handle="e" x="${defaultW - 4}" y="${defaultH / 2 - 10}" width="8" height="20" rx="2" fill="#3b82f6" opacity="0.55" style="cursor: ew-resize"/>\n`;
    svg += `    <rect data-resize-handle="s" x="${defaultW / 2 - 10}" y="${defaultH - 4}" width="20" height="8" rx="2" fill="#3b82f6" opacity="0.55" style="cursor: ns-resize"/>\n`;
    svg += `    <rect data-resize-handle="se" x="${defaultW - 6}" y="${defaultH - 6}" width="12" height="12" rx="3" fill="#2563eb" opacity="0.75" style="cursor: nwse-resize"/>\n`;
    svg += `  </g>\n`;
  }

  // Draw relations
  for (const rel of diag.relations) {
    const f = [...actorPositions, ...ucPositions].find(p => p.e.name === rel.from);
    const t = [...actorPositions, ...ucPositions].find(p => p.e.name === rel.to);
    if (!f || !t) continue;
    const fIsActor = f.e.kind === 'actor';
    const tIsActor = t.e.kind === 'actor';
    const fBox = fIsActor
      ? { x: f.p.x - 18, y: f.p.y - 57, w: 36, h: 72 }
      : { x: f.p.x - UC_RX, y: f.p.y - UC_RY, w: UC_RX * 2, h: UC_RY * 2 };
    const tBox = tIsActor
      ? { x: t.p.x - 18, y: t.p.y - 57, w: 36, h: 72 }
      : { x: t.p.x - UC_RX, y: t.p.y - UC_RY, w: UC_RX * 2, h: UC_RY * 2 };
    const fromEdge = edgePointOnRect(fBox.x, fBox.y, fBox.w, fBox.h, t.p.x, t.p.y);
    const toEdge = edgePointOnRect(tBox.x, tBox.y, tBox.w, tBox.h, f.p.x, f.p.y);
    const strokeDash = rel.kind === 'dependency' ? '6,3' : '';
    const dashAttr = strokeDash ? ` stroke-dasharray="${strokeDash}"` : '';
    const safeLabel = rel.label ? escapeXml(rel.label) : '';
    svg += `  <g data-relation-id="${escapeXml(rel.id)}" data-relation-from="${escapeXml(rel.from)}" data-relation-to="${escapeXml(rel.to)}" data-relation-kind="${escapeXml(rel.kind)}" data-relation-label="${safeLabel}">\n`;      svg += `    <line x1="${fromEdge.x}" y1="${fromEdge.y}" x2="${toEdge.x}" y2="${toEdge.y}" stroke="transparent" stroke-width="15" style="cursor: pointer"/>\n`;    svg += `    <line x1="${fromEdge.x}" y1="${fromEdge.y}" x2="${toEdge.x}" y2="${toEdge.y}" stroke="var(--iso-text-muted, #94a3b8)" stroke-width="1.5"${dashAttr}/>\n`;
    if (rel.label) {
      const mx = (fromEdge.x + toEdge.x) / 2, my = (fromEdge.y + toEdge.y) / 2 - 6;
      const labelW = safeLabel.length * 6 + 10;
      svg += `    <rect x="${mx - labelW/2}" y="${my - 12}" width="${labelW}" height="14" rx="2" fill="var(--iso-bg-panel)" opacity="0.9"/>\n`;
      svg += `    <text x="${mx}" y="${my}" text-anchor="middle" font-size="11" fill="var(--iso-text-muted)">«${safeLabel}»</text>\n`;
    }
    svg += `  </g>\n`;
  }

  // Draw actors (stick figures) — data-entity-name enables drag-to-reposition
  for (const { e, p } of actorPositions) {
    const x = p.x, y = p.y;
    svg += `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(e.name)}">\n`;
    svg += `    <circle cx="0" cy="-45" r="12" fill="var(--iso-bg-panel)" stroke="var(--iso-text-muted)" stroke-width="1.5" filter="url(#shadow)"/>\n`;
    svg += `    <line x1="0" y1="-33" x2="0" y2="-8" stroke="var(--iso-text-muted)" stroke-width="1.5"/>\n`;
    svg += `    <line x1="-18" y1="-22" x2="18" y2="-22" stroke="var(--iso-text-muted)" stroke-width="1.5"/>\n`;
    svg += `    <line x1="0" y1="-8" x2="-12" y2="15" stroke="var(--iso-text-muted)" stroke-width="1.5"/>\n`;
    svg += `    <line x1="0" y1="-8" x2="12" y2="15" stroke="var(--iso-text-muted)" stroke-width="1.5"/>\n`;
    svg += `    <text x="0" y="30" text-anchor="middle" font-size="12" font-weight="500" fill="var(--iso-text)">${escapeXml(e.name)}</text>\n`;
    if (e.stereotype) {
      svg += `    <text x="0" y="44" text-anchor="middle" font-size="10" fill="var(--iso-text-muted)" font-style="italic">«${escapeXml(e.stereotype)}»</text>\n`;
    }
    svg += `  </g>\n`;
  }

  // Draw use cases (ellipses) — wrapped in <g> for drag support
  for (const { e, p } of ucPositions) {
    if (e.kind === 'actor') continue;
    const x = p.x, y = p.y;
    svg += `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(e.name)}">`;
    const exts = [...e.fields, ...e.methods];
    const hasExts = exts.length > 0;
    const ry = hasExts ? UC_RY + exts.length * 8 : UC_RY;
    
    svg += `    <ellipse cx="0" cy="0" rx="${UC_RX}" ry="${ry}" fill="var(--iso-bg-blue, #eff6ff)" stroke="#3b82f6" stroke-width="1.5" filter="url(#shadow)"/>`;
    const lines = wrapText(e.name, 20);
    const textStart = hasExts ? -(ry / 2) : 0;
    lines.forEach((line, i) => {
      const lineY = textStart - (lines.length - 1) * 8 + i * 16;
      svg += `    <text x="0" y="${lineY}" text-anchor="middle" font-size="13" font-weight="500" fill="var(--iso-text)">${escapeXml(line)}</text>`;
    });
    
    if (hasExts) {
      svg += `    <line x1="${-UC_RX + 10}" y1="${5}" x2="${UC_RX - 10}" y2="${5}" stroke="#3b82f6" stroke-width="1" stroke-dasharray="4,2"/>`;
      svg += `    <text x="0" y="18" text-anchor="middle" font-size="10" font-style="italic" fill="var(--iso-text-muted)">extension points</text>`;
      exts.forEach((ext, i) => {
        svg += `    <text x="0" y="${30 + i * 12}" text-anchor="middle" font-size="10" fill="var(--iso-text-body)">${escapeXml(ext.name)}</text>`;
      });
    }
    svg += `  </g>`;
  }

  svg += `  </g>\n`;
  svg += caption.svg;
  svg += `</svg>`;
  return svg;
}
