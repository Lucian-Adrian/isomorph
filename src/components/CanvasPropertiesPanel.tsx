import { useState, useRef, useEffect, useCallback } from 'react';
import type { CanvasDraftSemanticLink, CanvasElement, CanvasStyle } from '../canvas/canvasTypes.js';
import { tText, type Language } from '../i18n.js';
import { IconTrash } from './Icons.js';

const PALETTE_COLORS = [
  '#ffffff', '#f1f3f5', '#ced4da', '#868e96', '#343a40', '#1e1e1e', '#000000',
  '#e03131', '#fa5252', '#fd7e14', '#fcc419', '#40c057', '#228be6', '#7950f2', '#be4bdb',
  '#ff8787', '#ffd43b', '#63e6be', '#4da5f7', '#b197fc', '#e64980'
];

const STROKE_WIDTHS = [1, 2, 3, 4, 6, 8, 10];

export interface CanvasPropertiesPanelProps {
  visible: boolean;
  uiLanguage?: Language;
  style: CanvasStyle;
  selectedElements?: CanvasElement[];
  draftLink?: CanvasDraftSemanticLink;
  onStyleChange: (patch: Partial<CanvasStyle>) => void;
  onElementChange?: (patch: Partial<CanvasElement>) => void;
  onDraftSemanticLink?: (targetKind: CanvasDraftSemanticLink['targetKind']) => void;
  onReplaceImage?: () => void;
  onDelete?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onDuplicate?: () => void;
  onAlign?: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistribute?: (axis: 'horizontal' | 'vertical') => void;
  onPromoteToDSL?: (elementId: string, targetKind: string) => void;
}

function ColorSwatch({ color, active, onClick, label }: { color: string; active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={`iso-color-swatch${active ? ' iso-color-swatch--active' : ''}`}
      style={{ background: color }}
      onClick={onClick}
      title={label}
      aria-label={label}
    />
  );
}

function ColorPickerButton({
  icon,
  title,
  value = '',
  pickerLabel,
  transparentLabel,
  onChange
}: {
  icon: React.ReactNode;
  title: string;
  value?: string;
  pickerLabel: string;
  transparentLabel: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(value);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustom(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const handleCustomSubmit = useCallback(() => {
    const hex = custom && custom.startsWith('#') ? custom : `#${custom || ''}`;
    if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) {
      onChange(hex);
      setOpen(false);
    }
  }, [custom, onChange]);

  const isTransparent = value === 'transparent' || value === 'none' || !value;

  return (
    <div className="iso-color-picker-wrapper" ref={popRef}>
      <button
        type="button"
        className={`iso-color-btn-trigger${open ? ' iso-color-btn-trigger--active' : ''}`}
        onClick={() => setOpen(!open)}
        title={title}
        aria-label={pickerLabel}
      >
        <span className="iso-color-btn-icon">{icon}</span>
        <span
          className="iso-color-btn-swatch"
          style={{ background: isTransparent ? 'transparent' : value }}
          data-transparent={isTransparent ? 'true' : 'false'}
        />
      </button>
      {open && (
        <div className="iso-color-popover">
          <div className="iso-color-grid">
            {PALETTE_COLORS.map(c => (
              <ColorSwatch key={c} color={c} active={c === value} onClick={() => { onChange(c); setOpen(false); }} label={c} />
            ))}
            <ColorSwatch color="transparent" active={value === 'transparent' || value === 'none'} onClick={() => { onChange('transparent'); setOpen(false); }} label={transparentLabel} />
          </div>
          <div className="iso-color-custom">
            <input
              type="text"
              value={custom || ''}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCustomSubmit(); }}
              placeholder="#hex"
              spellCheck={false}
            />
            <input
              type="color"
              value={value && value.startsWith('#') ? value : '#000000'}
              onChange={e => { onChange(e.target.value); setCustom(e.target.value); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function CanvasPropertiesPanel({
  visible,
  uiLanguage = 'en',
  style,
  selectedElements,
  draftLink,
  onStyleChange,
  onElementChange,
  onDraftSemanticLink,
  onReplaceImage,
  onDelete,
  onBringForward,
  onSendBackward,
  onDuplicate,
  onAlign,
  onDistribute,
  onPromoteToDSL,
}: CanvasPropertiesPanelProps) {
  const [draftTargetKind, setDraftTargetKind] = useState<CanvasDraftSemanticLink['targetKind']>('entity');
  if (!visible) return null;
  const t = (key: string) => tText(uiLanguage, key);

  const hasSelection = selectedElements && selectedElements.length > 0;
  const selectedElement = selectedElements?.length === 1 ? selectedElements[0] : null;
  const selectionLabel = hasSelection
    ? selectedElements.length === 1
      ? selectedElements[0].kind
      : `${selectedElements.length} elements`
    : t('canvas.props.defaults');
  const selectionMeta = hasSelection
    ? selectedElements.length === 1
      ? t('canvas.props.single_selection')
      : t('canvas.props.multi_selection')
    : t('canvas.props.default_style_hint');
  const activeDraftTarget = draftLink?.targetKind ?? draftTargetKind;
  const semanticDisabled = !selectedElement || !onDraftSemanticLink;
  const imageFit = selectedElement?.kind === 'image' ? selectedElement.fit ?? 'contain' : 'contain';

  return (
    <div className="iso-canvas-props" aria-label={t('canvas.props.element_properties')}>
      <div className="iso-props-header">
        <div>
          <span className="iso-props-eyebrow">{t('canvas.props.inspector')}</span>
          <span className="iso-props-title">{selectionLabel}</span>
        </div>
        <span className="iso-props-subtitle">{selectionMeta}</span>
      </div>

      <section className="iso-prop-section" aria-label={t('canvas.props.appearance')}>
        <span className="iso-prop-section-title">{t('canvas.props.appearance')}</span>

        <div className="iso-prop-row">
          <span className="iso-prop-label">{t('canvas.props.colors') ?? 'Colors'}</span>
          <div className="iso-color-pickers-group">
            <ColorPickerButton
              icon={<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="8" cy="8" r="6" /></svg>}
              title={t('canvas.props.stroke')}
              pickerLabel={t('canvas.props.pick_stroke')}
              transparentLabel={t('canvas.props.transparent')}
              value={style.stroke}
              onChange={v => onStyleChange({ stroke: v })}
            />
            <ColorPickerButton
              icon={<svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7" /></svg>}
              title={t('canvas.props.fill')}
              pickerLabel={t('canvas.props.pick_fill')}
              transparentLabel={t('canvas.props.transparent')}
              value={style.fill}
              onChange={v => onStyleChange({ fill: v })}
            />
            <ColorPickerButton
              icon={<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13l5-10 5 10 M4.5 10h7"/></svg>}
              title={t('canvas.props.text_color')}
              pickerLabel={t('canvas.props.pick_text')}
              transparentLabel={t('canvas.props.transparent')}
              value={style.text}
              onChange={v => onStyleChange({ text: v })}
            />
          </div>
        </div>

        <div className="iso-prop-row">
          <span className="iso-prop-label">{t('canvas.props.width')}</span>
          <div className="iso-prop-button-group">
            {STROKE_WIDTHS.map(w => (
              <button
                key={w}
                type="button"
                className={`iso-prop-chip${style.strokeWidth === w ? ' iso-prop-chip--active' : ''}`}
                onClick={() => onStyleChange({ strokeWidth: w })}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div className="iso-prop-row">
          <span className="iso-prop-label">{t('canvas.props.opacity')}</span>
          <input
            type="range"
            className="iso-prop-slider"
            min={0}
            max={100}
            step={5}
            value={Math.round(style.opacity * 100)}
            onChange={e => onStyleChange({ opacity: Number(e.target.value) / 100 })}
          />
          <span className="iso-prop-value">{Math.round(style.opacity * 100)}%</span>
        </div>
      </section>

      {(selectedElement?.kind === 'text' || selectedElement?.kind === 'rectangle' || selectedElement?.kind === 'ellipse') && (
        <section className="iso-prop-section" aria-label={t('canvas.props.content')}>
          <span className="iso-prop-section-title">{t('canvas.props.content')}</span>
          <label className="iso-prop-field">
            <span className="iso-prop-label">{t('canvas.props.text')}</span>
            <textarea
              aria-label={t('canvas.props.text_content')}
              value={selectedElement.text ?? ''}
              onChange={event => onElementChange?.({ text: event.target.value } as Partial<CanvasElement>)}
            />
          </label>
          {selectedElement?.kind === 'text' && (
            <label className="iso-prop-field">
              <span className="iso-prop-label">{t('canvas.props.font')}</span>
              <input
                aria-label={t('canvas.props.font_size')}
                type="number"
                min={8}
                max={120}
                value={selectedElement.fontSize}
                onChange={event => onElementChange?.({ fontSize: Number(event.target.value) } as Partial<CanvasElement>)}
              />
            </label>
          )}
        </section>
      )}

      {selectedElement?.kind === 'embed' && (
        <section className="iso-prop-section" aria-label={t('canvas.props.content')}>
          <span className="iso-prop-section-title">{t('canvas.props.content')}</span>
          <label className="iso-prop-field">
            <span className="iso-prop-label">URL</span>
            <input
              aria-label={t('canvas.props.embed_url')}
              type="url"
              value={selectedElement.url}
              onChange={event => onElementChange?.({ url: event.target.value } as Partial<CanvasElement>)}
              placeholder="https://"
            />
          </label>
          <label className="iso-prop-field">
            <span className="iso-prop-label">{t('canvas.props.title')}</span>
            <input
              aria-label={t('canvas.props.embed_title')}
              value={selectedElement.title ?? ''}
              onChange={event => onElementChange?.({ title: event.target.value } as Partial<CanvasElement>)}
            />
          </label>
        </section>
      )}

      {selectedElement?.kind === 'image' && (
        <section className="iso-prop-section" aria-label={t('canvas.props.media')}>
          <span className="iso-prop-section-title">{t('canvas.props.media')}</span>
          <label className="iso-prop-field">
            <span className="iso-prop-label">{t('canvas.props.alt')}</span>
            <input
              aria-label={t('canvas.props.image_alt')}
              value={selectedElement.alt}
              onChange={event => onElementChange?.({ alt: event.target.value } as Partial<CanvasElement>)}
            />
          </label>
          <label className="iso-prop-field">
            <span className="iso-prop-label">{t('canvas.props.fit')}</span>
            <select
              aria-label={t('canvas.props.image_fit')}
              value={imageFit}
              onChange={event => onElementChange?.({ fit: event.target.value } as Partial<CanvasElement>)}
            >
              <option value="contain">{t('canvas.props.fit_contain')}</option>
              <option value="cover">{t('canvas.props.fit_cover')}</option>
              <option value="stretch">{t('canvas.props.fit_stretch')}</option>
            </select>
          </label>
          {onReplaceImage && (
            <button type="button" className="iso-prop-action" onClick={onReplaceImage} aria-label={t('canvas.props.replace_image')}>
              {t('canvas.props.replace_image')}
            </button>
          )}
        </section>
      )}

      {hasSelection && (
        <section className="iso-prop-section iso-prop-semantic" aria-label={t('canvas.props.semantic')}>
          <span className="iso-prop-section-title">{t('canvas.props.semantic')}</span>
          <label className="iso-prop-field">
            <span className="iso-prop-label">{t('canvas.props.semantic')}</span>
            <select
              aria-label={t('canvas.props.draft_target_kind')}
              value={activeDraftTarget}
              disabled={semanticDisabled}
              onChange={event => setDraftTargetKind(event.target.value as CanvasDraftSemanticLink['targetKind'])}
            >
              <option value="entity">{t('canvas.props.entity')}</option>
              <option value="relation">{t('canvas.props.relation')}</option>
              <option value="package">{t('canvas.props.package')}</option>
            </select>
          </label>
          <button
            type="button"
            className="iso-prop-action"
            disabled={semanticDisabled}
            onClick={() => onDraftSemanticLink?.(activeDraftTarget)}
            aria-label={t('canvas.props.link_draft_aria')}
          >
            {t('canvas.props.link_draft')}
          </button>
        </section>
      )}

      {selectedElement && onPromoteToDSL && (
        <section className="iso-prop-section iso-prop-promote" aria-label={t('canvas.props.promote_to_dsl')}>
          <span className="iso-prop-section-title">{t('canvas.props.promote_to_dsl')}</span>
          <div className="iso-prop-actions-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {selectedElement.kind === 'rectangle' && (
              <>
                <button type="button" className="iso-prop-action" onClick={() => onPromoteToDSL(selectedElement.id, 'class')}>
                  {t('canvas.props.promote.class')}
                </button>
                <button type="button" className="iso-prop-action" onClick={() => onPromoteToDSL(selectedElement.id, 'interface')}>
                  {t('canvas.props.promote.interface')}
                </button>
                <button type="button" className="iso-prop-action" onClick={() => onPromoteToDSL(selectedElement.id, 'usecase')}>
                  {t('canvas.props.promote.usecase')}
                </button>
                <button type="button" className="iso-prop-action" onClick={() => onPromoteToDSL(selectedElement.id, 'state')}>
                  {t('canvas.props.promote.state')}
                </button>
                <button type="button" className="iso-prop-action" onClick={() => onPromoteToDSL(selectedElement.id, 'package')}>
                  {t('canvas.props.promote.package')}
                </button>
              </>
            )}
            {selectedElement.kind === 'ellipse' && (
              <>
                <button type="button" className="iso-prop-action" onClick={() => onPromoteToDSL(selectedElement.id, 'actor')}>
                  {t('canvas.props.promote.actor')}
                </button>
                <button type="button" className="iso-prop-action" onClick={() => onPromoteToDSL(selectedElement.id, 'usecase')}>
                  {t('canvas.props.promote.usecase')}
                </button>
                <button type="button" className="iso-prop-action" onClick={() => onPromoteToDSL(selectedElement.id, 'state')}>
                  {t('canvas.props.promote.state')}
                </button>
              </>
            )}
            {(selectedElement.kind === 'line' || selectedElement.kind === 'arrow') && (
              <button type="button" className="iso-prop-action" onClick={() => onPromoteToDSL(selectedElement.id, 'relation')}>
                {t('canvas.props.promote.relation')}
              </button>
            )}
          </div>
        </section>
      )}

      {hasSelection && (
        <section className="iso-prop-section" aria-label={t('canvas.props.arrange')}>
          <span className="iso-prop-section-title">{t('canvas.props.arrange')}</span>
          <div className="iso-prop-actions-group">
            <div className="iso-prop-button-group">
              {onBringForward && <button type="button" className="iso-prop-action" onClick={onBringForward} title={t('canvas.props.bring_forward')} aria-label={t('canvas.props.bring_forward')}>{t('canvas.props.forward')}</button>}
              {onSendBackward && <button type="button" className="iso-prop-action" onClick={onSendBackward} title={t('canvas.props.send_backward')} aria-label={t('canvas.props.send_backward')}>{t('canvas.props.backward')}</button>}
            </div>
            <div className="iso-prop-button-group">
              {onDuplicate && <button type="button" className="iso-prop-action" onClick={onDuplicate} title={t('canvas.props.duplicate')} aria-label={t('canvas.props.duplicate')}>{t('canvas.props.duplicate')}</button>}
              {selectedElement && onElementChange && (
                <button
                  type="button"
                  className={`iso-prop-action${selectedElement.locked ? ' iso-prop-action--active' : ''}`}
                  onClick={() => onElementChange({ locked: !selectedElement.locked })}
                  title={selectedElement.locked ? t('canvas.props.unlock') : t('canvas.props.lock')}
                  aria-label={selectedElement.locked ? t('canvas.props.unlock') : t('canvas.props.lock')}
                >
                  {selectedElement.locked ? t('canvas.props.unlock_label') : t('canvas.props.lock_label')}
                </button>
              )}
            </div>
            {selectedElements.length > 1 && onAlign && (
              <div className="iso-prop-button-group" aria-label={t('canvas.props.align')}>
                <button type="button" className="iso-prop-action" onClick={() => onAlign('left')} title={t('canvas.props.align_left')} aria-label={t('canvas.props.align_left')}>{t('canvas.props.align_left_short')}</button>
                <button type="button" className="iso-prop-action" onClick={() => onAlign('center')} title={t('canvas.props.align_center')} aria-label={t('canvas.props.align_center')}>{t('canvas.props.align_center_short')}</button>
                <button type="button" className="iso-prop-action" onClick={() => onAlign('right')} title={t('canvas.props.align_right')} aria-label={t('canvas.props.align_right')}>{t('canvas.props.align_right_short')}</button>
                <button type="button" className="iso-prop-action" onClick={() => onAlign('top')} title={t('canvas.props.align_top')} aria-label={t('canvas.props.align_top')}>{t('canvas.props.align_top_short')}</button>
                <button type="button" className="iso-prop-action" onClick={() => onAlign('middle')} title={t('canvas.props.align_middle')} aria-label={t('canvas.props.align_middle')}>{t('canvas.props.align_middle_short')}</button>
                <button type="button" className="iso-prop-action" onClick={() => onAlign('bottom')} title={t('canvas.props.align_bottom')} aria-label={t('canvas.props.align_bottom')}>{t('canvas.props.align_bottom_short')}</button>
              </div>
            )}
            {selectedElements.length > 2 && onDistribute && (
              <div className="iso-prop-button-group" aria-label={t('canvas.props.distribute')}>
                <button type="button" className="iso-prop-action" onClick={() => onDistribute('horizontal')} title={t('canvas.props.distribute_horizontal')} aria-label={t('canvas.props.distribute_horizontal')}>{t('canvas.props.distribute_horizontal_short')}</button>
                <button type="button" className="iso-prop-action" onClick={() => onDistribute('vertical')} title={t('canvas.props.distribute_vertical')} aria-label={t('canvas.props.distribute_vertical')}>{t('canvas.props.distribute_vertical_short')}</button>
              </div>
            )}
            {onDelete && (
              <button type="button" className="iso-prop-action iso-prop-action--danger" onClick={onDelete} title={t('canvas.props.delete_selected')}>
                <IconTrash size={12} /> {t('canvas.props.delete')}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
