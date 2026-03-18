// ============================================================
// Isomorph Icon Components — Inline SVG icon library
// ============================================================
// Extracted from App.tsx for reusability (SRP + DRY).
// ============================================================

interface IconProps {
  size?: number;
}

export function IconCode({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <polyline points="5,4 1,8 5,12"/>
      <polyline points="11,4 15,8 11,12"/>
    </svg>
  );
}

export function IconDiagram({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="1" y="1" width="5" height="4" rx="1"/>
      <rect x="10" y="1" width="5" height="4" rx="1"/>
      <rect x="5" y="11" width="6" height="4" rx="1"/>
      <line x1="3.5" y1="5" x2="3.5" y2="9"/>
      <line x1="12.5" y1="5" x2="12.5" y2="9"/>
      <line x1="3.5" y1="9" x2="8" y2="9"/>
      <line x1="12.5" y1="9" x2="8" y2="9"/>
      <line x1="8" y1="9" x2="8" y2="11"/>
    </svg>
  );
}

export function IconChevron({ size = 12, dir = 'down' }: IconProps & { dir?: 'down' | 'up' }) {
  const r = dir === 'up' ? 'rotate(180)' : undefined;
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" style={{ transform: r }}>
      <polyline points="2,4 6,8 10,4"/>
    </svg>
  );
}

export function IconExport({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M2 10v4h12v-4"/>
      <line x1="8" y1="2" x2="8" y2="10"/>
      <polyline points="5,7 8,10 11,7"/>
    </svg>
  );
}

export function IconNew({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M9 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V7"/>
      <polyline points="9,2 9,7 14,7"/>
      <line x1="13" y1="2" x2="13" y2="7" stroke="none"/>
    </svg>
  );
}

export function IconOpen({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M2 4.5V13a1 1 0 001 1h10a1 1 0 001-1V6.5a1 1 0 00-1-1H8L6.5 4H3a1 1 0 00-1 .5z"/>
    </svg>
  );
}

export function IconKeyboard({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="1" y="3" width="14" height="10" rx="1.5"/>
      <line x1="4" y1="6" x2="5" y2="6"/>
      <line x1="7.5" y1="6" x2="8.5" y2="6"/>
      <line x1="11" y1="6" x2="12" y2="6"/>
      <line x1="4" y1="9" x2="12" y2="9"/>
    </svg>
  );
}

export function IconPointer({ size = 14 }: IconProps) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>; }
export function IconHand({ size = 14 }: IconProps) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 10V5a2 2 0 10-4 0v4"/><path d="M14 10V3a2 2 0 10-4 0v9"/><path d="M18 12V7a2 2 0 10-4 0v8"/><path d="M11 14h2a2 2 0 100-4h-3c-.6 0-1.2.2-1.6.6L4 15.1l7.1 7c.7.7 1.9.9 2.8.5l6.5-2.6c.9-.4 1.6-1.3 1.6-2.3V10a2 2 0 10-4 0v4"/></svg>; }
export function IconEdge({ size = 14 }: IconProps) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="5" cy="14" r="3"/><circle cx="19" cy="8" r="3"/><path d="M7.5 12.5l9-3"/></svg>; }
export function IconSave({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M13 14H3c-.5 0-1-.4-1-1V3c0-.5.4-1 1-1h7l4 4v7c0 .5-.4 1-1 1z"/>
      <path d="M4 2v4h5V2 M4 14v-5h8v5"/>
    </svg>
  );
}
