// ============================================================
// SplitPane — Accessible resizable horizontal split layout
// ============================================================

import { useState, useRef, useCallback, type ReactNode } from 'react';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  defaultSplit?: number; // 0–1, fraction for left panel
  separatorLabel?: string;
}

export function SplitPane({ left, right, defaultSplit = 0.45, separatorLabel = 'Resize panels - use arrow keys' }: SplitPaneProps) {
  const [split, setSplit]   = useState(defaultSplit);
  const containerRef        = useRef<HTMLDivElement>(null);
  const dragging            = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    e.preventDefault(); // prevent text selection
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newSplit = Math.max(0.2, Math.min(0.8, (e.clientX - rect.left) / rect.width));
    setSplit(newSplit);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
      dragging.current = false;
    }
  }, []);

  // Keyboard-adjustable divider
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft')  setSplit(s => Math.max(0.2, s - 0.05));
    if (e.key === 'ArrowRight') setSplit(s => Math.min(0.8, s + 0.05));
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        userSelect: 'none',
      }}
    >
      {/* Left panel */}
      <div style={{ width: `${split * 100}%`, height: '100%', overflow: 'hidden', flexShrink: 0 }}>
        {left}
      </div>

      {/* Divider */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(split * 100)}
        aria-valuemin={20}
        aria-valuemax={80}
        aria-label={separatorLabel}
        tabIndex={0}
        className="iso-divider-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
      />

      {/* Right panel */}
      <div style={{ flex: 1, height: '100%', overflow: 'hidden', minWidth: 0 }}>
        {right}
      </div>
    </div>
  );
}
