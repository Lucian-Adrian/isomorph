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

/** Shared SVG <defs> block: markers + drop-shadow filter. */
export function svgDefs(): string {
  return `  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="1" dy="2" stdDeviation="2.5" flood-color="#00000018"/>
    </filter>
    <marker id="arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#555"/>
    </marker>
    <marker id="hollow-arrow" markerWidth="13" markerHeight="9" refX="13" refY="4.5" orient="auto">
      <polygon points="0 0, 13 4.5, 0 9" fill="white" stroke="#555" stroke-width="1"/>
    </marker>
    <marker id="diamond" markerWidth="12" markerHeight="10" refX="0" refY="5" orient="auto">
      <polygon points="0 5, 6 0, 12 5, 6 10" fill="white" stroke="#555" stroke-width="1.5"/>
    </marker>
    <marker id="filled-diamond" markerWidth="12" markerHeight="10" refX="0" refY="5" orient="auto">
      <polygon points="0 5, 6 0, 12 5, 6 10" fill="#555"/>
    </marker>
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
