// ============================================================
// Class Diagram SVG Renderer
// ============================================================
// Produces an SVG string from an IOMDiagram.
// Uses a simple grid auto-layout when positions are absent.
// ============================================================

import type { IOMDiagram, IOMEntity, IOMRelation } from '../semantics/iom.js';
import { escapeXml, visSymbolFor, svgDefs } from './utils.js';

// ─── Render configuration ────────────────────────────────────

const BOX_MIN_WIDTH = 160;
const BOX_PADDING   = 12;
const LINE_HEIGHT   = 20;
const HEADER_HEIGHT = 36;
const FONT_SIZE     = 13;
const GRID_COL_GAP  = 60;
const GRID_ROW_GAP  = 50;
const GRID_COLS     = 4;

// ─── Main entry ──────────────────────────────────────────────

export function renderClassDiagram(diag: IOMDiagram): string {
  const entities = [...diag.entities.values()];
  if (entities.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><text x="20" y="40" font-family="sans-serif" font-size="14">Empty diagram</text></svg>';

  // Auto-layout: assign positions to entities that lack them
  const positioned = assignPositions(entities);

  // Compute canvas size
  const maxX = Math.max(...positioned.map(p => p.pos.x + p.width)) + 40;
  const maxY = Math.max(...positioned.map(p => p.pos.y + p.height)) + 40;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" style="font-family:Segoe UI,Arial,sans-serif;background:#fafafa">\n`;
  svg += svgDefs();

  // Draw package backgrounds
  for (const pkg of diag.packages) {
    const members = pkg.entityNames.map(n => positioned.find(p => p.entity.name === n)).filter((p): p is Positioned => p !== undefined);
    if (members.length === 0) continue;
    const xs  = members.map(p => p.pos.x);
    const ys  = members.map(p => p.pos.y);
    const x2s = members.map(p => p.pos.x + p.width);
    const y2s = members.map(p => p.pos.y + p.height);
    const px = Math.min(...xs) - 20, py = Math.min(...ys) - 30;
    const pw = Math.max(...x2s) - px + 20, ph = Math.max(...y2s) - py + 20;
    svg += `  <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="6" fill="#f0f4ff" stroke="#b0c0e0" stroke-width="1.5" stroke-dasharray="6,3"/>\n`;
    svg += `  <text x="${px + 8}" y="${py + 18}" font-size="11" fill="#5566aa" font-style="italic">«package» ${escapeXml(pkg.name)}</text>\n`;
  }

  // Draw relations
  for (const rel of diag.relations) {
    const from = positioned.find(p => p.entity.name === rel.from);
    const to   = positioned.find(p => p.entity.name === rel.to);
    if (!from || !to) continue;
    svg += renderRelation(from, to, rel);
  }

  // Draw entity boxes
  for (const p of positioned) {
    svg += renderEntityBox(p);
  }

  svg += `</svg>`;
  return svg;
}

// ─── Entity box ──────────────────────────────────────────────

interface Positioned {
  entity: IOMEntity;
  pos: { x: number; y: number };
  width: number;
  height: number;
}

function renderEntityBox(p: Positioned): string {
  const { entity, pos, width, height } = p;
  const { x, y } = pos;
  const isAbstract = entity.isAbstract;
  const isInterface = entity.kind === 'interface';
  const isEnum = entity.kind === 'enum';
  const headerFill = isInterface ? 'url(#grad-interface)' : isEnum ? 'url(#grad-enum)' : entity.isAbstract ? 'url(#grad-abstract)' : 'url(#grad-class)';
  const borderColor = isInterface ? '#3b82f6' : isEnum ? '#d97706' : entity.isAbstract ? '#9333ea' : '#0d9488';
  const borderWidth = 1.5;

  let s = '';
  // Container
  s += `  <g transform="translate(${x},${y})" data-entity-name="${escapeXml(entity.name)}">\n`;
  s += `    <rect width="${width}" height="${height}" rx="6" fill="white" stroke="${borderColor}" stroke-width="${borderWidth}" filter="url(#shadow)"/>\n`;

  // Header background
  s += `    <rect width="${width}" height="${HEADER_HEIGHT}" rx="6" fill="${headerFill}" stroke="${borderColor}" stroke-width="${borderWidth}"/>\n`;
  s += `    <rect y="${HEADER_HEIGHT - 6}" width="${width}" height="6" fill="${headerFill}"/>\n`;

  // Header text
  let nameY = HEADER_HEIGHT / 2 + 4;
  if (entity.stereotype || isInterface || isEnum) {
    const stereoText = entity.stereotype ? `«${entity.stereotype}»` : isInterface ? '«interface»' : '«enum»';
    s += `    <text x="${width / 2}" y="14" text-anchor="middle" font-size="10" fill="${borderColor}" font-style="italic">${escapeXml(stereoText)}</text>\n`;
    nameY = HEADER_HEIGHT - 8;
  }
  const nameStyle = isAbstract ? 'font-style:italic' : '';
  s += `    <text x="${width / 2}" y="${nameY}" text-anchor="middle" font-size="${FONT_SIZE}" font-weight="bold" style="${nameStyle}" fill="#1a1a1a">${escapeXml(entity.name)}</text>\n`;

  // Divider
  let currentY = HEADER_HEIGHT;

  // Fields section (only for class / interface)
  if (entity.fields.length > 0) {
    s += `    <line x1="0" y1="${currentY}" x2="${width}" y2="${currentY}" stroke="${borderColor}" stroke-width="0.75"/>\n`;
    for (const field of entity.fields) {
      currentY += LINE_HEIGHT;
      const visSymbol = visSymbolFor(field.visibility);
      const typeStr = field.type;
      const defStr = field.defaultValue !== undefined ? ` = ${field.defaultValue}` : '';
      const staticMod = field.isStatic ? 'text-decoration:underline;' : '';
      s += `    <text x="${BOX_PADDING}" y="${currentY}" font-size="12" style="${staticMod}" fill="#333">` +
           `<tspan fill="${borderColor}">${escapeXml(visSymbol)} </tspan>` +
           `${escapeXml(field.name)}: <tspan fill="#555" font-style="italic">${escapeXml(typeStr)}${escapeXml(defStr)}</tspan></text>\n`;
    }
    currentY += 4;
  }

  // Methods section
  if (entity.methods.length > 0) {
    s += `    <line x1="0" y1="${currentY}" x2="${width}" y2="${currentY}" stroke="${borderColor}" stroke-width="0.75"/>\n`;
    for (const method of entity.methods) {
      currentY += LINE_HEIGHT;
      const visSymbol = visSymbolFor(method.visibility);
      const params = method.params.map(p => `${p.name}: ${p.type}`).join(', ');
      const staticMod = method.isStatic ? 'text-decoration:underline;' : '';
      const abstractMod = method.isAbstract ? 'font-style:italic;' : '';
      s += `    <text x="${BOX_PADDING}" y="${currentY}" font-size="12" style="${staticMod}${abstractMod}" fill="#333">` +
           `<tspan fill="${borderColor}">${escapeXml(visSymbol)} </tspan>` +
           `${escapeXml(method.name)}(${escapeXml(params)}): <tspan fill="#555" font-style="italic">${escapeXml(method.returnType)}</tspan></text>\n`;
    }
    currentY += 4;
  }

  // Enum values
  if (entity.enumValues.length > 0) {
    s += `    <line x1="0" y1="${currentY}" x2="${width}" y2="${currentY}" stroke="${borderColor}" stroke-width="0.75"/>\n`;
    for (const val of entity.enumValues) {
      currentY += LINE_HEIGHT;
      s += `    <text x="${BOX_PADDING}" y="${currentY}" font-size="12" fill="#92400e">${escapeXml(val.name)}</text>\n`;
    }
    currentY += 4;
  }

  s += `  </g>\n`;
  return s;
}

// ─── Relation line ───────────────────────────────────────────

function renderRelation(from: Positioned, to: Positioned, rel: IOMRelation): string {
  const [x1, y1] = boxCenter(from);
  const [x2, y2] = boxCenter(to);

  // Compute edge connection points
  const [sx, sy] = boxEdge(from, x2, y2);
  const [ex, ey] = boxEdge(to, x1, y1);

  const strokeDash   = rel.kind === 'realization' || rel.kind === 'dependency' ? '6,3' : '';
  const markerEnd    = markerEndFor(rel.kind);
  const markerStart  = markerStartFor(rel.kind);
  const color        = '#555';

  let s = `  <g>\n`;
  const dashAttr = strokeDash ? ` stroke-dasharray="${strokeDash}"` : '';
  const meAttr   = markerEnd ? ` marker-end="url(#${markerEnd})"` : '';
  const msAttr   = markerStart ? ` marker-start="url(#${markerStart})"` : '';
  s += `    <line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${color}" stroke-width="1.5"${dashAttr}${meAttr}${msAttr}/>\n`;

  // Label
  const mx = (sx + ex) / 2, my = (sy + ey) / 2 - 6;
  if (rel.label) {
    s += `    <rect x="${mx - rel.label.length * 3.5 - 4}" y="${my - 12}" width="${rel.label.length * 7 + 8}" height="16" fill="white" opacity="0.8"/>\n`;
    s += `    <text x="${mx}" y="${my}" text-anchor="middle" font-size="11" fill="#333" font-style="italic">${escapeXml(rel.label)}</text>\n`;
  }

  // Multiplicities
  if (rel.fromMult) {
    s += `    <text x="${(sx + 20).toFixed(1)}" y="${(sy - 6).toFixed(1)}" font-size="11" fill="#666">${escapeXml(rel.fromMult)}</text>\n`;
  }
  if (rel.toMult) {
    s += `    <text x="${(ex - 20).toFixed(1)}" y="${(ey - 6).toFixed(1)}" font-size="11" fill="#666">${escapeXml(rel.toMult)}</text>\n`;
  }

  s += `  </g>\n`;
  return s;
}

function markerEndFor(kind: string): string {
  switch (kind) {
    case 'directed-association': return 'arrow';
    case 'inheritance':          return 'hollow-arrow';
    case 'realization':          return 'hollow-arrow';
    case 'dependency':           return 'arrow';
    // composition: filled diamond at source only, no arrowhead
    // aggregation: open diamond at source only, no arrowhead
    default:                     return '';
  }
}

function markerStartFor(kind: string): string {
  switch (kind) {
    case 'aggregation':  return 'diamond';
    case 'composition':  return 'filled-diamond';
    default:             return '';
  }
}

// ─── Layout ──────────────────────────────────────────────────

function assignPositions(entities: IOMEntity[]): Positioned[] {
  const result: Positioned[] = [];
  let col = 0;
  let maxRowHeight = 0;
  let curX = 40, curY = 40;

  for (const entity of entities) {
    const width = computeWidth(entity);
    const height = computeHeight(entity);

    const pos = entity.position
      ? { x: entity.position.x, y: entity.position.y }
      : { x: curX, y: curY };

    result.push({ entity, pos, width, height });

    if (!entity.position) {
      maxRowHeight = Math.max(maxRowHeight, height);
      col++;
      curX += width + GRID_COL_GAP;
      if (col >= GRID_COLS) {
        col = 0;
        curX = 40;
        curY += maxRowHeight + GRID_ROW_GAP;
        maxRowHeight = 0;
      }
    }
  }

  return result;
}

function computeWidth(entity: IOMEntity): number {
  const texts = [
    entity.name,
    ...entity.fields.map(f => `${f.name}: ${f.type}`),
    ...entity.methods.map(m => `${m.name}(${m.params.map(p => `${p.name}: ${p.type}`).join(', ')}): ${m.returnType}`),
    ...entity.enumValues.map(v => v.name),
  ];
  const maxLen = Math.max(...texts.map(t => t.length));
  return Math.max(BOX_MIN_WIDTH, maxLen * 7.5 + BOX_PADDING * 2);
}

function computeHeight(entity: IOMEntity): number {
  const memberCount = entity.fields.length + entity.methods.length + entity.enumValues.length;
  // One divider line before each non-empty section after the header
  const dividers =
    (entity.fields.length > 0 ? 1 : 0) +
    (entity.methods.length > 0 ? 1 : 0) +
    (entity.enumValues.length > 0 ? 1 : 0);
  return HEADER_HEIGHT + memberCount * LINE_HEIGHT + dividers * 1 + 8;
}

function boxCenter(p: Positioned): [number, number] {
  return [p.pos.x + p.width / 2, p.pos.y + p.height / 2];
}

function boxEdge(p: Positioned, tx: number, ty: number): [number, number] {
  const cx = p.pos.x + p.width / 2;
  const cy = p.pos.y + p.height / 2;
  const dx = tx - cx, dy = ty - cy;
  const scaleX = Math.abs(dx) > 0 ? (p.width / 2) / Math.abs(dx) : Infinity;
  const scaleY = Math.abs(dy) > 0 ? (p.height / 2) / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return [cx + dx * scale, cy + dy * scale];
}

// ─── Helpers ─────────────────────────────────────────────────
// escapeXml and visSymbolFor are imported from ./utils.ts
