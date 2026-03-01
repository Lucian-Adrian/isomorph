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
