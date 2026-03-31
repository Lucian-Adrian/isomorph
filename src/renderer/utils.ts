// ============================================================
// Isomorph Renderer — Shared Utilities
// ============================================================
// All renderer modules import from here to avoid duplication.
// ============================================================

/** XML-safe escaping for SVG text content and attribute values. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

/** Map IOM visibility string to UML symbol character. */
export function visSymbolFor(vis: string): string {
  if (vis === 'public')    return '+';
  if (vis === 'private')   return '−';  // U+2212 MINUS SIGN (wider than hyphen)
  if (vis === 'protected') return '#';
  if (vis === 'package')   return '~';
  return '+';
}

/** Shared SVG <defs> block: markers, drop-shadow, gradients. */
export function svgDefs(): string {
  return `  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.04)"/>
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.02)"/>
    </filter>
    <marker id="arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="var(--iso-text-muted)"/>
    </marker>
    <marker id="hollow-arrow" markerWidth="13" markerHeight="9" refX="13" refY="4.5" orient="auto">
      <polygon points="0 0, 13 4.5, 0 9" fill="var(--iso-bg-panel)" stroke="var(--iso-text-muted)" stroke-width="1.5"/>
    </marker>
    <marker id="diamond" markerWidth="12" markerHeight="10" refX="0" refY="5" orient="auto">
      <polygon points="0 5, 6 0, 12 5, 6 10" fill="var(--iso-bg-panel)" stroke="var(--iso-text-muted)" stroke-width="1.5"/>
    </marker>
    <marker id="filled-diamond" markerWidth="12" markerHeight="10" refX="0" refY="5" orient="auto">
      <polygon points="0 5, 6 0, 12 5, 6 10" fill="var(--iso-text-muted)"/>
    </marker>
    <linearGradient id="grad-class" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--iso-bg-panel, #ffffff)"/>
      <stop offset="100%" stop-color="var(--iso-bg-blue, #f0f9ff)"/>
    </linearGradient>
    <linearGradient id="grad-interface" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--iso-bg-panel, #ffffff)"/>
      <stop offset="100%" stop-color="var(--iso-bg-green, #f0fdf4)"/>
    </linearGradient>
    <linearGradient id="grad-abstract" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--iso-bg-panel, #ffffff)"/>
      <stop offset="100%" stop-color="var(--iso-bg-purple, #fdf4ff)"/>
    </linearGradient>
    <linearGradient id="grad-enum" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--iso-bg-panel, #ffffff)"/>
      <stop offset="100%" stop-color="var(--iso-bg-orange, #fffbeb)"/>
    </linearGradient>
    <linearGradient id="grad-state" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--iso-bg-panel, #ffffff)"/>
      <stop offset="100%" stop-color="var(--iso-bg-blue, #f0f9ff)"/>
    </linearGradient>
    <linearGradient id="grad-flow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--iso-bg-panel, #ffffff)"/>
      <stop offset="100%" stop-color="var(--iso-bg-blue, #eff6ff)"/>
    </linearGradient>
  </defs>
`;
}

/** Wrap text at a max character width, splitting on the nearest space. */
export function wrapText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const mid = Math.floor(text.length / 2);
  const spaceNear = text.lastIndexOf(' ', mid);
  if (spaceNear < 0) return [text];
  return [text.slice(0, spaceNear), text.slice(spaceNear + 1)];
}

/** Render title and subtitle for a diagram. Returns { svg: string, height: number } */
export function renderConfigHeaders(diag: import('../semantics/iom.js').IOMDiagram, width: number): { svg: string, height: number } {
  let svg = '';
  let y = 35;
  if (diag.config?.title) {
    svg += `  <text x="${width / 2}" y="${y}" text-anchor="middle" font-size="20" font-weight="800" fill="var(--iso-text)" font-family="DM Sans, system-ui, -apple-system, sans-serif">${escapeXml(diag.config.title)}</text>\n`;
    y += 30;
  }
  if (diag.config?.subtitle) {
    svg += `  <text x="${width / 2}" y="${y}" text-anchor="middle" font-size="14" fill="var(--iso-text-muted)" font-family="DM Sans, system-ui, -apple-system, sans-serif">${escapeXml(diag.config.subtitle)}</text>\n`;
    y += 25;
  }
  return { svg, height: y > 35 ? y : 0 };
}

/** Render caption for a diagram. Returns { svg: string, height: number } */
export function renderConfigCaption(diag: import('../semantics/iom.js').IOMDiagram, width: number, totalHeight: number): { svg: string, height: number } {
  if (!diag.config?.caption) return { svg: '', height: 0 };
  const y = totalHeight + 25;
  const svg = `  <text x="${width / 2}" y="${y}" text-anchor="middle" font-size="12" font-style="italic" fill="var(--iso-text-muted)" font-family="DM Sans, system-ui, -apple-system, sans-serif">${escapeXml(diag.config.caption)}</text>\n`;
  return { svg, height: 40 };
}

/** Render legend for a diagram. Returns { svg: string } */
export function renderConfigLegend(diag: import('../semantics/iom.js').IOMDiagram, width: number, yOffset: number): { svg: string } {
  if (!diag.config?.legend) return { svg: '' };
  const lines = diag.config.legend.split('\\n'); // Handle literal \n as well
  const maxChars = Math.max(...lines.map(l => l.length));
  const frameW = Math.max(120, maxChars * 8 + 20), frameH = lines.length * 20 + 10;
  const x = width - frameW - 20, y = yOffset + 20;
  let svg = `  <g transform="translate(${x},${y})">\n`;
  svg += `    <rect width="${frameW}" height="${frameH}" fill="var(--iso-bg-panel)" stroke="var(--iso-border)" stroke-width="1.5" rx="4" filter="url(#shadow)" />\n`;
  lines.forEach((l, i) => {
    svg += `    <text x="10" y="${20 + i * 20}" font-size="12" fill="var(--iso-text)" font-family="DM Sans, system-ui, sans-serif">${escapeXml(l)}</text>\n`;
  });
  svg += `  </g>\n`;
  return { svg };
}

/** Returns the center point of a rectangle. */
export function rectCenter(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return { x: x + w / 2, y: y + h / 2 };
}

/**
 * Projects a point from the rectangle center to its border in the direction of a target point.
 * This gives cleaner edge-anchored relation lines than center-to-center drawing.
 */
export function edgePointOnRect(x: number, y: number, w: number, h: number, targetX: number, targetY: number): { x: number; y: number } {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;

  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const sx = dx !== 0 ? (w / 2) / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const sy = dy !== 0 ? (h / 2) / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const t = Math.min(sx, sy);

  return { x: cx + dx * t, y: cy + dy * t };
}

/**
 * Compute the absolute positions of provided/required/port interface points on a component entity.
 * Returns a map from port field name to { x, y } in entity-local coordinates (add entity x/y for absolute).
 */
export function computePortPositions(
  fields: { name: string; type: string }[], 
  boxW: number, 
  compH: number
): Map<string, { x: number; y: number; side: 'right' | 'left' | 'bottom' }> {
  const ports = new Map<string, { x: number; y: number; side: 'right' | 'left' | 'bottom' }>();

  let provIdx = 0, reqIdx = 0, portIdx = 0;
  for (const f of fields) {
    if (f.type === 'provided') {
      const py = 12 + provIdx * 20;
      ports.set(f.name, { x: boxW + 20, y: py, side: 'right' });
      provIdx++;
    } else if (f.type === 'required') {
      const py = 12 + reqIdx * 20;
      ports.set(f.name, { x: -20, y: py, side: 'left' });
      reqIdx++;
    } else if (f.type === 'port') {
      const px = 20 + portIdx * 20;
      ports.set(f.name, { x: px, y: compH + 4, side: 'bottom' });
      portIdx++;
    }
  }

  return ports;
}
