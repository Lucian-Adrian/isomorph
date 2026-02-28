// ============================================================
// SplitPane — Resizable horizontal split layout
// ============================================================

import { useState, useRef, useCallback, type ReactNode } from 'react';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  defaultSplit?: number; // 0–1, fraction for left panel
}

export function SplitPane({ left, right, defaultSplit = 0.45 }: SplitPaneProps) {
  const [split, setSplit] = useState(defaultSplit);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onMouseDown = useCallback(() => {
    dragging.current = true;
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newSplit = Math.max(0.2, Math.min(0.8, (e.clientX - rect.left) / rect.width));
    setSplit(newSplit);
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{ display: 'flex', width: '100%', height: '100%', userSelect: dragging.current ? 'none' : undefined }}
    >
      {/* Left panel */}
      <div style={{ width: `${split * 100}%`, height: '100%', overflow: 'hidden' }}>
        {left}
      </div>

      {/* Divider */}
      <div
        onMouseDown={onMouseDown}
        style={{
          width: '6px',
          height: '100%',
          cursor: 'col-resize',
          background: '#d0d7de',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#0550ae')}
        onMouseLeave={e => (e.currentTarget.style.background = '#d0d7de')}
      >
        <div style={{ width: 2, height: 24, background: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
        {right}
      </div>
    </div>
  );
}
