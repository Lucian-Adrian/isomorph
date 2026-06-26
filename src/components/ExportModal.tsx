// ============================================================
// Isomorph — Export Dropdown Menu Component
// ============================================================
// Renders the export option list (PNG, SVG, GIF, MP4).
// Reused in both Toolbar (desktop) and mobile action sheets.
// ============================================================

import React from 'react';
import {
  IconImage,
  IconFileImage,
  IconGif,
  IconVideo
} from './Icons.js';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: 'top' | 'bottom';
  handleExportPNG: () => void;
  handleExportSVG: () => void;
  handleExportGIF: () => void;
  handleExportMP4: () => void;
  isAnimationsEnabled: boolean;
  t: (key: string, vars?: any) => string;
}

export function ExportModal({
  isOpen,
  onClose,
  position,
  handleExportPNG,
  handleExportSVG,
  handleExportGIF,
  handleExportMP4,
  isAnimationsEnabled,
  t
}: ExportModalProps) {
  if (!isOpen) return null;

  const style: React.CSSProperties = position === 'bottom'
    ? {
        position: 'absolute',
        bottom: '100%',
        right: 0,
        marginBottom: '4px',
        background: 'var(--iso-bg-panel)',
        border: '1px solid var(--iso-border)',
        borderRadius: '4px',
        padding: '4px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        minWidth: '160px',
        boxShadow: '0 -4px 12px var(--iso-glass-shadow)',
      }
    : {
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: '4px',
        background: 'var(--iso-bg-panel)',
        border: '1px solid var(--iso-border)',
        borderRadius: '4px',
        padding: '4px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        minWidth: '160px',
        boxShadow: '0 4px 12px var(--iso-glass-shadow)',
      };

  return (
    <div style={style} onClick={(e) => e.stopPropagation()}>
      <button
        className="iso-dropdown-item"
        style={{
          border: 'none',
          textAlign: 'left',
          padding: '6px 12px',
          cursor: 'pointer',
          color: 'var(--iso-text)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
        onClick={() => {
          onClose();
          handleExportPNG();
        }}
      >
        <IconImage /> {t('ui.export_png')}
      </button>
      <button
        className="iso-dropdown-item"
        style={{
          border: 'none',
          textAlign: 'left',
          padding: '6px 12px',
          cursor: 'pointer',
          color: 'var(--iso-text)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
        onClick={() => {
          onClose();
          handleExportSVG();
        }}
      >
        <IconFileImage /> {t('ui.export_svg')}
      </button>
      {isAnimationsEnabled && (
        <>
          <button
            className="iso-dropdown-item"
            style={{
              border: 'none',
              textAlign: 'left',
              padding: '6px 12px',
              cursor: 'pointer',
              color: 'var(--iso-text)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={() => {
              onClose();
              handleExportGIF();
            }}
          >
            <IconGif /> {t('ui.export_gif')}
          </button>
          <button
            className="iso-dropdown-item"
            style={{
              border: 'none',
              textAlign: 'left',
              padding: '6px 12px',
              cursor: 'pointer',
              color: 'var(--iso-text)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={() => {
              onClose();
              handleExportMP4();
            }}
          >
            <IconVideo /> {t('ui.export_mp4')}
          </button>
        </>
      )}
    </div>
  );
}
