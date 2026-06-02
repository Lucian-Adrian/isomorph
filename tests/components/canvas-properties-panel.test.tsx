import { describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasPropertiesPanel } from '../../src/components/CanvasPropertiesPanel.js';
import { DEFAULT_CANVAS_STYLE } from '../../src/canvas/canvasStyle.js';
import { createCanvasElement } from '../../src/canvas/canvasTools.js';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(element: React.ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(element));
  return {
    host,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe('CanvasPropertiesPanel', () => {
  it('localizes canvas property controls and action labels', () => {
    const textElement = createCanvasElement({
      id: 'text-1',
      kind: 'text',
      bounds: { x: 10, y: 20, width: 120, height: 32 },
      style: DEFAULT_CANVAS_STYLE,
      text: 'Note',
    });

    const { host, cleanup } = render(
      <CanvasPropertiesPanel
        visible
        uiLanguage="ru"
        style={DEFAULT_CANVAS_STYLE}
        selectedElements={[textElement]}
        onStyleChange={vi.fn()}
        onElementChange={vi.fn()}
        onDraftSemanticLink={vi.fn()}
        onDelete={vi.fn()}
        onBringForward={vi.fn()}
        onSendBackward={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );

    expect(host.querySelector('[aria-label="Свойства элемента"]')).not.toBeNull();
    expect(host.textContent).toContain('Текст');
    expect(host.textContent).toContain('Шрифт');
    expect(host.textContent).toContain('Семантика');
    expect(host.textContent).toContain('Дублировать');
    expect(host.querySelector('[aria-label="Связать черновую семантику"]')).not.toBeNull();
    cleanup();
  });

  it('localizes image-specific controls and forwards image fit changes', () => {
    const onElementChange = vi.fn();
    const imageElement = createCanvasElement({
      id: 'image-1',
      kind: 'image',
      bounds: { x: 10, y: 20, width: 200, height: 150 },
      style: DEFAULT_CANVAS_STYLE,
      text: 'Preview',
    });

    const { host, cleanup } = render(
      <CanvasPropertiesPanel
        visible
        uiLanguage="ro"
        style={DEFAULT_CANVAS_STYLE}
        selectedElements={[imageElement]}
        onStyleChange={vi.fn()}
        onElementChange={onElementChange}
        onReplaceImage={vi.fn()}
      />,
    );

    expect(host.textContent).toContain('Text alternativ');
    expect(host.textContent).toContain('Potrivire');
    expect(host.textContent).toContain('Înlocuiește imaginea');

    const fitSelect = host.querySelector('[aria-label="Potrivire imagine"]') as HTMLSelectElement;
    act(() => {
      fitSelect.value = 'cover';
      fitSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onElementChange).toHaveBeenCalledWith({ fit: 'cover' });
    cleanup();
  });
});
