// ============================================================
// Use-Case Diagram SVG Renderer
// ============================================================

import type { IOMDiagram } from '../semantics/iom.js';
import { escapeXml, wrapText, svgDefs } from './utils.js';

export function renderUseCaseDiagram(diag: IOMDiagram): string {
  const entities = [...diag.entities.values()];
  if (entities.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><text x="20" y="40" font-family="sans-serif" font-size="14">Empty diagram</text></svg>';

  // Separate into actors, use-cases, and boundaries
  const actors   = entities.filter(e => e.kind === 'actor');
  const usecases = entities.filter(e => e.kind === 'usecase');
  const bounds   = entities.filter(e => e.kind === 'system' || e.kind === 'boundary');

  const UC_RX = 80, UC_RY = 40;

  let canvasW = 900;
  let canvasH = 600;

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

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" style="font-family:Segoe UI,Arial,sans-serif;background:#f8fafc">\n`;
  svg += svgDefs();

  // Draw system boundaries (backgrounds)
  if (bounds.length > 0) {
    for (const b of bounds) {
      const bx = b.position ? b.position.x : 280;
      const by = b.position ? b.position.y : 30;
      const bw = 500, bh = 400; // default large size
      svg += `  <g transform="translate(${bx},${by})" data-entity-name="${escapeXml(b.name)}">\n`;
      svg += `    <rect x="0" y="0" width="${bw}" height="${bh}" fill="white" stroke="#94a3b8" stroke-width="1.5"/>\n`;
      svg += `    <text x="10" y="20" font-size="13" font-weight="bold" fill="#64748b">${escapeXml(b.name)}</text>\n`;
      svg += `  </g>\n`;
    }
  } else {
    // Default system boundary if none explicitly defined
    svg += `  <rect x="280" y="30" width="580" height="${canvasH - 60}" rx="8" fill="white" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="8,4"/>\n`;
    svg += `  <text x="300" y="52" font-size="13" fill="#64748b" font-style="italic">${escapeXml(diag.name)} : System</text>\n`;
  }

  // Draw relations
  for (const rel of diag.relations) {
    const f = [...actorPositions, ...ucPositions].find(p => p.e.name === rel.from);
    const t = [...actorPositions, ...ucPositions].find(p => p.e.name === rel.to);
    if (!f || !t) continue;
    const strokeDash = rel.kind === 'dependency' ? '6,3' : '';
    const dashAttr = strokeDash ? ` stroke-dasharray="${strokeDash}"` : '';
    const safeLabel = rel.label ? escapeXml(rel.label) : '';
    svg += `  <g data-relation-id="${escapeXml(rel.id)}" data-relation-from="${escapeXml(rel.from)}" data-relation-to="${escapeXml(rel.to)}" data-relation-kind="${escapeXml(rel.kind)}" data-relation-label="${safeLabel}">\n`;      svg += `    <line x1="${f.p.x}" y1="${f.p.y}" x2="${t.p.x}" y2="${t.p.y}" stroke="transparent" stroke-width="15" style="cursor: pointer"/>\n`;    svg += `    <line x1="${f.p.x}" y1="${f.p.y}" x2="${t.p.x}" y2="${t.p.y}" stroke="#64748b" stroke-width="1.5"${dashAttr}/>\n`;
    if (rel.label) {
      const mx = (f.p.x + t.p.x) / 2, my = (f.p.y + t.p.y) / 2 - 6;
      const labelW = safeLabel.length * 6 + 10;
      svg += `    <rect x="${mx - labelW/2}" y="${my - 12}" width="${labelW}" height="14" rx="2" fill="white" opacity="0.9"/>\n`;
      svg += `    <text x="${mx}" y="${my}" text-anchor="middle" font-size="11" fill="#475569">«${safeLabel}»</text>\n`;
    }
    svg += `  </g>\n`;
  }

  // Draw actors (stick figures) — data-entity-name enables drag-to-reposition
  for (const { e, p } of actorPositions) {
    const x = p.x, y = p.y;
    svg += `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(e.name)}">\n`;
    svg += `    <circle cx="0" cy="-45" r="12" fill="white" stroke="#334155" stroke-width="1.5"/>\n`;
    svg += `    <line x1="0" y1="-33" x2="0" y2="-8" stroke="#334155" stroke-width="1.5"/>\n`;
    svg += `    <line x1="-18" y1="-22" x2="18" y2="-22" stroke="#334155" stroke-width="1.5"/>\n`;
    svg += `    <line x1="0" y1="-8" x2="-12" y2="15" stroke="#334155" stroke-width="1.5"/>\n`;
    svg += `    <line x1="0" y1="-8" x2="12" y2="15" stroke="#334155" stroke-width="1.5"/>\n`;
    svg += `    <text x="0" y="30" text-anchor="middle" font-size="12" font-weight="500" fill="#1e293b">${escapeXml(e.name)}</text>\n`;
    if (e.stereotype) {
      svg += `    <text x="0" y="44" text-anchor="middle" font-size="10" fill="#64748b" font-style="italic">«${escapeXml(e.stereotype)}»</text>\n`;
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
    
    svg += `    <ellipse cx="0" cy="0" rx="${UC_RX}" ry="${ry}" fill="#dbeafe" stroke="#3b82f6" stroke-width="1.5"/>`;
    const lines = wrapText(e.name, 20);
    const textStart = hasExts ? -(ry / 2) : 0;
    lines.forEach((line, i) => {
      const lineY = textStart - (lines.length - 1) * 8 + i * 16;
      svg += `    <text x="0" y="${lineY}" text-anchor="middle" font-size="13" font-weight="500" fill="#1e3a5f">${escapeXml(line)}</text>`;
    });
    
    if (hasExts) {
      svg += `    <line x1="${-UC_RX + 10}" y1="${5}" x2="${UC_RX - 10}" y2="${5}" stroke="#3b82f6" stroke-width="1"/>`;
      svg += `    <text x="0" y="18" text-anchor="middle" font-size="10" font-style="italic" fill="#64748b">extension points</text>`;
      exts.forEach((ext, i) => {
        svg += `    <text x="0" y="${30 + i * 12}" text-anchor="middle" font-size="10" fill="#1e3a5f">${escapeXml(ext.name)}</text>`;
      });
    }
    svg += `  </g>`;
  }

  svg += `</svg>`;
  return svg;
}
