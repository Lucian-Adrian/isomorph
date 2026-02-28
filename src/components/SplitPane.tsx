// ============================================================
// SplitPane — Accessible resizable horizontal split layout
// ============================================================

import { useState, useRef, useCallback, type ReactNode } from 'react';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  defaultSplit?: number; // 0–1, fraction for left panel
}

export function SplitPane({ left, right, defaultSplit = 0.45 }: SplitPaneProps) {
  const [split, setSplit]   = useState(defaultSplit);
  const containerRef        = useRef<HTMLDivElement>(null);
  const dragging            = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    e.preventDefault(); // prevent text selection
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newSplit = Math.max(0.2, Math.min(0.8, (e.clientX - rect.left) / rect.width));
    setSplit(newSplit);
  }, []);

  const stopDrag = useCallback(() => { dragging.current = false; }, []);

  // Keyboard-adjustable divider
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft')  setSplit(s => Math.max(0.2, s - 0.05));
    if (e.key === 'ArrowRight') setSplit(s => Math.min(0.8, s + 0.05));
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
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
        aria-label="Resize panels — use arrow keys"
        tabIndex={0}
        className="iso-divider-handle"
        onMouseDown={onMouseDown}
        onKeyDown={onKeyDown}
      />

      {/* Right panel */}
      <div style={{ flex: 1, height: '100%', overflow: 'hidden', minWidth: 0 }}>
        {right}
      </div>
    </div>
  );
}
