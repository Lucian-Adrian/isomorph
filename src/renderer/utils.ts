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
