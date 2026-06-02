import {
  IconEdge,
  IconHand,
  IconPointer,
  IconLock,
  IconRectangle,
  IconEllipse,
  IconPen,
  IconText,
  IconImage,
  IconEraser,
  IconArrow,
  IconLine,
  IconDotsHorizontal,
} from './Icons.js';
import type { FullCanvasMode } from './FullCanvasShell.js';
import { tText, type Language } from '../i18n.js';

export interface CanvasToolbarProps {
  mode: FullCanvasMode;
  disabled?: boolean;
  language?: Language;
  onModeChange: (mode: FullCanvasMode) => void;
  onMoreTools?: () => void;
}

function ToolGlyph({ tool }: { tool: FullCanvasMode | 'more' }) {
  if (tool === 'move') return <IconPointer size={18} />;
  if (tool === 'hand') return <IconHand size={18} />;
  if (tool === 'add-edge') return <IconEdge size={18} />;
  if (tool === 'locked') return <IconLock size={18} />;
  if (tool === 'rectangle') return <IconRectangle size={18} />;
  if (tool === 'ellipse') return <IconEllipse size={18} />;
  if (tool === 'arrow') return <IconArrow size={18} />;
  if (tool === 'line') return <IconLine size={18} />;
  if (tool === 'pen') return <IconPen size={18} />;
  if (tool === 'text') return <IconText size={18} />;
  if (tool === 'image') return <IconImage size={18} />;
  if (tool === 'eraser') return <IconEraser size={18} />;
  return <IconDotsHorizontal size={18} />;
}

const FLOATING_TOOLS: Array<{ mode: FullCanvasMode; labelKey: string }> = [
  { mode: 'locked', labelKey: 'canvas.tool.lock' },
  { mode: 'move', labelKey: 'canvas.tool.select' },
  { mode: 'hand', labelKey: 'canvas.tool.hand' },
  { mode: 'rectangle', labelKey: 'canvas.tool.rectangle' },
  { mode: 'ellipse', labelKey: 'canvas.tool.ellipse' },
  { mode: 'arrow', labelKey: 'canvas.tool.arrow' },
  { mode: 'line', labelKey: 'canvas.tool.line' },
  { mode: 'pen', labelKey: 'canvas.tool.pen' },
  { mode: 'text', labelKey: 'canvas.tool.text' },
  { mode: 'image', labelKey: 'canvas.tool.image' },
  { mode: 'eraser', labelKey: 'canvas.tool.eraser' },
];

const HOTKEY_HINTS: Record<string, string> = {
  locked: '',
  move: 'V',
  hand: 'H',
  rectangle: 'R',
  ellipse: 'O',
  arrow: 'A',
  line: 'L',
  pen: 'P',
  text: 'T',
  image: 'I',
  eraser: '0',
};

export function CanvasToolbar({ mode, disabled = false, language = 'en', onModeChange, onMoreTools }: CanvasToolbarProps) {
  const t = (key: string) => tText(language, key);

  return (
    <div className="iso-full-canvas-toolbar" role="toolbar" aria-label={t('canvas.tools')}>
      {FLOATING_TOOLS.map(tool => {
        const label = t(tool.labelKey);
        const hint = HOTKEY_HINTS[tool.mode];
        const title = hint ? `${label} (${hint})` : label;
        return (
          <button
            key={tool.mode}
            type="button"
            className={`iso-full-canvas-tool${mode === tool.mode ? ' iso-full-canvas-tool--active' : ''}`}
            aria-label={label}
            title={title}
            disabled={disabled}
            onClick={() => onModeChange(tool.mode)}
          >
            <ToolGlyph tool={tool.mode} />
          </button>
        );
      })}
      <button type="button" className="iso-full-canvas-tool" aria-label={t('canvas.more_tools')} title={t('canvas.more')} onClick={onMoreTools}>
        <ToolGlyph tool="more" />
      </button>
    </div>
  );
}
