import { IconEdge, IconHand, IconPointer } from './Icons.js';
import type { FullCanvasMode } from './FullCanvasShell.js';

export interface CanvasToolbarProps {
  mode: FullCanvasMode;
  disabled?: boolean;
  onModeChange: (mode: FullCanvasMode) => void;
  onMoreTools?: () => void;
}

function ToolGlyph({ tool }: { tool: FullCanvasMode | 'more' }) {
  if (tool === 'move') return <IconPointer size={15} />;
  if (tool === 'hand') return <IconHand size={15} />;
  if (tool === 'add-edge' || tool === 'arrow' || tool === 'line') return <IconEdge size={15} />;
  if (tool === 'locked') return <span aria-hidden="true">L</span>;
  if (tool === 'rectangle') return <span aria-hidden="true">□</span>;
  if (tool === 'ellipse') return <span aria-hidden="true">○</span>;
  if (tool === 'pen') return <span aria-hidden="true">P</span>;
  if (tool === 'text') return <span aria-hidden="true">T</span>;
  if (tool === 'image') return <span aria-hidden="true">I</span>;
  if (tool === 'eraser') return <span aria-hidden="true">E</span>;
  return <span aria-hidden="true">⋯</span>;
}

const FLOATING_TOOLS: Array<{ mode: FullCanvasMode; label: string; title: string }> = [
  { mode: 'locked', label: 'Lock tool', title: 'Lock' },
  { mode: 'move', label: 'Select', title: 'Select' },
  { mode: 'hand', label: 'Hand', title: 'Hand' },
  { mode: 'rectangle', label: 'Rectangle', title: 'Rectangle' },
  { mode: 'ellipse', label: 'Ellipse', title: 'Ellipse' },
  { mode: 'arrow', label: 'Arrow', title: 'Arrow' },
  { mode: 'line', label: 'Line', title: 'Line' },
  { mode: 'pen', label: 'Pen', title: 'Pen' },
  { mode: 'text', label: 'Text', title: 'Text' },
  { mode: 'image', label: 'Image', title: 'Image' },
  { mode: 'eraser', label: 'Eraser', title: 'Eraser' },
];

export function CanvasToolbar({ mode, disabled = false, onModeChange, onMoreTools }: CanvasToolbarProps) {
  return (
    <div className="iso-full-canvas-toolbar" role="toolbar" aria-label="Canvas tools">
      {FLOATING_TOOLS.map(tool => (
        <button
          key={tool.label}
          type="button"
          className={`iso-full-canvas-tool${mode === tool.mode ? ' iso-full-canvas-tool--active' : ''}`}
          aria-label={tool.label}
          title={tool.title}
          disabled={disabled}
          onClick={() => onModeChange(tool.mode)}
        >
          <ToolGlyph tool={tool.mode} />
        </button>
      ))}
      <button type="button" className="iso-full-canvas-tool" aria-label="More tools" title="More" onClick={onMoreTools}>
        <ToolGlyph tool="more" />
      </button>
    </div>
  );
}
