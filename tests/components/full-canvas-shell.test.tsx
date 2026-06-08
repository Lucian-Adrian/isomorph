import { describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FullCanvasShell } from '../../src/components/FullCanvasShell.js';
import type { IOMDiagram } from '../../src/semantics/iom.js';
import type { CanvasElement } from '../../src/canvas/canvasTypes.js';

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

function diagram(): IOMDiagram {
  return {
    name: 'CanvasDiagram',
    kind: 'class',
    entities: new Map(),
    relations: [],
    packages: [],
    notes: [],
    config: {},
    styles: {},
    fragments: [],
    activations: [],
    partitions: [],
  };
}

const baseStyle = { stroke: '#1e1e1e', fill: '#ffffff', text: '#1e1e1e', strokeWidth: 2, opacity: 1, roughness: 0 };

function storedCanvasState(elements: CanvasElement[], selectedElementIds: string[] = []) {
  return JSON.stringify({
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    activeTool: 'select',
    locked: false,
    selectedElementIds,
    styleDefaults: baseStyle,
    draftSemanticLinks: [],
    updatedAt: '2026-05-23T00:00:00.000Z',
    elements,
  });
}

function rectElement(id: string, bounds = { x: 10, y: 20, width: 100, height: 80 }, layer = 0): CanvasElement {
  return {
    id,
    kind: 'rectangle',
    bounds,
    rotation: 0,
    locked: false,
    layer,
    style: baseStyle,
    createdAt: '2026-05-23T00:00:00.000Z',
    updatedAt: '2026-05-23T00:00:00.000Z',
  };
}

function installStorage(storage: Map<string, string>) {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
}

function setOverlayBox(host: HTMLElement) {
  const overlay = host.querySelector('.iso-freeform-overlay') as SVGSVGElement;
  Object.defineProperty(overlay, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: 1000, height: 700, right: 1000, bottom: 700 }),
  });
  return overlay;
}

function setControlValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string, eventName = 'input') {
  if (!control) return;
  const tagName = control.tagName.toUpperCase();
  const prototype = tagName === 'TEXTAREA'
    ? HTMLTextAreaElement.prototype
    : tagName === 'SELECT'
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event(eventName, { bubbles: true }));
}

describe('full canvas shell', () => {
  it('renders edge-to-edge canvas chrome and exposes the primary toolbar', () => {
    const onModeChange = vi.fn();
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={null}
        mode="move"
        onModeChange={onModeChange}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(host.querySelector('.iso-full-canvas-shell')).not.toBeNull();
    for (const label of ['Lock tool', 'Select', 'Hand', 'Rectangle', 'Ellipse', 'Arrow', 'Line', 'Pen', 'Text', 'Image', 'Eraser', 'More tools']) {
      expect(host.querySelector(`[aria-label="${label}"]`)).not.toBeNull();
    }

    act(() => host.querySelector('[aria-label="More tools"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(host.textContent).toContain('Frame');
    expect(host.textContent).toContain('Web embed');
    expect(host.textContent).toContain('Laser pointer');
    expect(host.textContent).toContain('Lasso');

    act(() => host.querySelector('[aria-label="Rectangle"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onModeChange).toHaveBeenCalledWith('rectangle');
    cleanup();
  });

  it('localizes canvas tool labels for the active language', () => {
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        language="ru"
        mode="move"
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(host.querySelector('[aria-label="Инструменты холста"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Прямоугольник"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Дополнительные инструменты"]')).not.toBeNull();
    cleanup();
  });

  it('draws and persists freeform rectangle elements with pointer drag', () => {
    const storageKey = 'isomorph-test-canvas-state';
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    const onCanvasStateChange = vi.fn();
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="rectangle"
        canvasStorageKey={storageKey}
        onCanvasStateChange={onCanvasStateChange}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const overlay = host.querySelector('.iso-freeform-overlay') as SVGSVGElement;
    Object.defineProperty(overlay, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 1000, height: 700, right: 1000, bottom: 700 }),
    });
    act(() => overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40, clientY: 50 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 180, clientY: 130 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 180, clientY: 130 })));

    expect(host.querySelector('.iso-freeform-overlay rect')).not.toBeNull();
    const saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.elements).toHaveLength(1);
    expect(saved.elements[0]).toMatchObject({ kind: 'rectangle', bounds: { x: 40, y: 50, width: 140, height: 80 } });
    expect(onCanvasStateChange).toHaveBeenCalled();
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps pure freeform canvas tools active when no parsed diagram exists', () => {
    const storageKey = 'isomorph-test-pure-canvas-state';
    const storage = new Map<string, string>();
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={null}
        mode="rectangle"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(host.querySelector<HTMLButtonElement>('[aria-label="Rectangle"]')?.disabled).toBe(false);
    const overlay = setOverlayBox(host);
    act(() => overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 11, clientX: 70, clientY: 80 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 11, clientX: 210, clientY: 160 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 11, clientX: 210, clientY: 160 })));

    const saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.elements).toHaveLength(1);
    expect(saved.elements[0]).toMatchObject({ kind: 'rectangle', bounds: { x: 70, y: 80, width: 140, height: 80 } });
    cleanup();
    vi.unstubAllGlobals();
  });

  it('constrains rectangles and ellipses to square bounds when shift-dragging', () => {
    const storageKey = 'isomorph-test-canvas-shift-rectangle-state';
    const storage = new Map<string, string>();
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="rectangle"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const overlay = setOverlayBox(host);
    act(() => overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 12, clientX: 40, clientY: 50, shiftKey: true })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 12, clientX: 180, clientY: 130, shiftKey: true })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 12, clientX: 180, clientY: 130, shiftKey: true })));

    const saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.elements[0]).toMatchObject({ kind: 'rectangle', bounds: { x: 40, y: 50, width: 140, height: 140 } });
    cleanup();
    vi.unstubAllGlobals();
  });

  it('snaps line and arrow endpoints to 45 degree increments when shift-dragging', () => {
    const storageKey = 'isomorph-test-canvas-shift-line-state';
    const storage = new Map<string, string>();
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="line"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const overlay = setOverlayBox(host);
    act(() => overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 13, clientX: 100, clientY: 100, shiftKey: true })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 13, clientX: 180, clientY: 130, shiftKey: true })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 13, clientX: 180, clientY: 130, shiftKey: true })));

    const saved = JSON.parse(storage.get(storageKey) || '{}');
    const line = saved.elements[0];
    expect(line.kind).toBe('line');
    expect(line.points[1].x).toBeCloseTo(185.44, 1);
    expect(line.points[1].y).toBeCloseTo(100, 1);
    expect(line.bounds).toMatchObject({ x: 100, y: 100, width: expect.closeTo(85.44, 1), height: 1 });
    cleanup();
    vi.unstubAllGlobals();
  });

  it('draws freeform pen paths from pointer movement', () => {
    const storageKey = 'isomorph-test-canvas-pen-state';
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="pen"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const overlay = host.querySelector('.iso-freeform-overlay') as SVGSVGElement;
    Object.defineProperty(overlay, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 1000, height: 700, right: 1000, bottom: 700 }),
    });
    act(() => overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, clientX: 10, clientY: 20 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 2, clientX: 30, clientY: 45 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 2, clientX: 70, clientY: 80 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2, clientX: 70, clientY: 80 })));

    const saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.elements[0]).toMatchObject({ kind: 'pen' });
    expect(saved.elements[0].points).toHaveLength(3);
    expect(host.querySelector('.iso-freeform-overlay path')).not.toBeNull();
    cleanup();
    vi.unstubAllGlobals();
  });

  it('persists selected element style and layer actions through the properties panel', () => {
    const storageKey = 'isomorph-test-canvas-properties-state';
    const storage = new Map<string, string>();
    storage.set(storageKey, storedCanvasState([rectElement('rect-1'), rectElement('rect-2', { x: 140, y: 20, width: 100, height: 80 }, 1)], ['rect-1']));
    installStorage(storage);

    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="move"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(host.querySelector('.iso-canvas-props')).not.toBeNull();
    act(() => host.querySelector('[aria-label="Pick fill color"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => host.querySelector('[aria-label="#e03131"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Forward')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const saved = JSON.parse(storage.get(storageKey) || '{}');
    const rect = saved.elements.find((element: { id: string }) => element.id === 'rect-1');
    expect(rect.style.fill).toBe('#e03131');
    expect(rect.layer).toBe(1);
    cleanup();
    vi.unstubAllGlobals();
  });

  it('supports Excalidraw-style keyboard shortcuts without stealing form input', () => {
    const storageKey = 'isomorph-test-canvas-hotkeys-state';
    const storage = new Map<string, string>();
    storage.set(storageKey, storedCanvasState([rectElement('rect-1')], ['rect-1']));
    installStorage(storage);
    const onModeChange = vi.fn();
    const { cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="move"
        canvasStorageKey={storageKey}
        onModeChange={onModeChange}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true })));
    expect(onModeChange).toHaveBeenCalledWith('rectangle');

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })));
    let saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.elements).toEqual([]);

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true })));
    expect(onModeChange).toHaveBeenCalledWith('ellipse');

    cleanup();
    vi.unstubAllGlobals();

    const textStorageKey = 'isomorph-test-canvas-hotkeys-input-state';
    const textStorage = new Map<string, string>();
    const textElement: CanvasElement = { ...rectElement('text-1'), kind: 'text', text: 'Old', fontSize: 16 };
    textStorage.set(textStorageKey, storedCanvasState([textElement], ['text-1']));
    installStorage(textStorage);
    const inputModeChange = vi.fn();
    const inputRender = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="move"
        canvasStorageKey={textStorageKey}
        onModeChange={inputModeChange}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const textInput = inputRender.host.querySelector('[aria-label="Text content"]') as HTMLTextAreaElement;
    textInput.focus();
    act(() => textInput.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true })));
    expect(inputModeChange).not.toHaveBeenCalledWith('rectangle');
    inputRender.cleanup();
    vi.unstubAllGlobals();
  });

  it('drags and resizes selected freeform objects after creation', () => {
    const storageKey = 'isomorph-test-canvas-move-resize-state';
    const storage = new Map<string, string>();
    storage.set(storageKey, storedCanvasState([rectElement('rect-1')], ['rect-1']));
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="move"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const overlay = setOverlayBox(host);
    const rect = host.querySelector('[data-canvas-element-id="rect-1"] rect') as SVGRectElement;
    act(() => rect.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 3, clientX: 20, clientY: 30 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 3, clientX: 70, clientY: 65 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 3, clientX: 70, clientY: 65 })));

    let saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.elements[0].bounds).toMatchObject({ x: 60, y: 55, width: 100, height: 80 });

    const handle = host.querySelector('[aria-label="Resize rect-1"]') as SVGRectElement;
    act(() => handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 4, clientX: 160, clientY: 135 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 4, clientX: 210, clientY: 165 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 4, clientX: 210, clientY: 165 })));

    saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.elements[0].bounds).toMatchObject({ x: 60, y: 55, width: 150, height: 110 });
    cleanup();
    vi.unstubAllGlobals();
  });

  it('moves a multi-selection when dragging any selected object', () => {
    const storageKey = 'isomorph-test-canvas-multi-drag-state';
    const storage = new Map<string, string>();
    storage.set(storageKey, storedCanvasState([
      rectElement('rect-1', { x: 10, y: 20, width: 100, height: 80 }),
      rectElement('rect-2', { x: 180, y: 50, width: 100, height: 80 }, 1),
    ], ['rect-1', 'rect-2']));
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="move"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const overlay = setOverlayBox(host);
    const rect = host.querySelector('[data-canvas-element-id="rect-1"] rect') as SVGRectElement;
    act(() => {
      rect.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 33, clientX: 20, clientY: 30 }));
      overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 33, clientX: 60, clientY: 70 }));
      overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 33, clientX: 60, clientY: 70 }));
    });

    const saved = JSON.parse(storage.get(storageKey) || '{}');
    const first = saved.elements.find((element: CanvasElement) => element.id === 'rect-1');
    const second = saved.elements.find((element: CanvasElement) => element.id === 'rect-2');
    expect(first.bounds).toMatchObject({ x: 50, y: 60, width: 100, height: 80 });
    expect(second.bounds).toMatchObject({ x: 220, y: 90, width: 100, height: 80 });
    expect(saved.selectedElementIds).toEqual(['rect-1', 'rect-2']);
    cleanup();
    vi.unstubAllGlobals();
  });

  it('lasso-selects existing freeform objects without persisting the lasso stroke', () => {
    const storageKey = 'isomorph-test-canvas-lasso-state';
    const storage = new Map<string, string>();
    storage.set(storageKey, storedCanvasState([
      rectElement('rect-1', { x: 40, y: 40, width: 50, height: 50 }),
      rectElement('rect-2', { x: 240, y: 240, width: 50, height: 50 }, 1),
    ]));
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="lasso"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const overlay = setOverlayBox(host);
    act(() => overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 5, clientX: 20, clientY: 20 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 5, clientX: 140, clientY: 140 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 5, clientX: 140, clientY: 140 })));

    const saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.selectedElementIds).toEqual(['rect-1']);
    expect(saved.elements.map((element: CanvasElement) => element.kind)).toEqual(['rectangle', 'rectangle']);
    cleanup();
    vi.unstubAllGlobals();
  });

  it('clears selection when clicking blank canvas in select mode', () => {
    const storageKey = 'isomorph-test-canvas-clear-selection-state';
    const storage = new Map<string, string>();
    storage.set(storageKey, storedCanvasState([rectElement('rect-1')], ['rect-1']));
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="move"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const overlay = setOverlayBox(host);
    act(() => overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, clientX: 500, clientY: 500 })));

    const saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.selectedElementIds).toEqual([]);
    cleanup();
    vi.unstubAllGlobals();
  });

  it('uses a drag zone in select mode without panning or selecting everything', () => {
    const storageKey = 'isomorph-test-canvas-select-zone-state';
    const storage = new Map<string, string>();
    storage.set(storageKey, storedCanvasState([
      rectElement('rect-1', { x: 40, y: 40, width: 50, height: 50 }),
      rectElement('rect-2', { x: 260, y: 260, width: 50, height: 50 }, 1),
    ]));
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="move"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const overlay = setOverlayBox(host);
    act(() => overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 22, clientX: 20, clientY: 20 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 22, clientX: 130, clientY: 130 })));
    expect(host.querySelector('.iso-freeform-selection-zone')).not.toBeNull();
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 22, clientX: 130, clientY: 130 })));

    const saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.selectedElementIds).toEqual(['rect-1']);
    expect(saved.viewport).toMatchObject({ x: 0, y: 0, zoom: 1 });
    cleanup();
    vi.unstubAllGlobals();
  });

  it('pans the freeform canvas in hand mode', () => {
    const storageKey = 'isomorph-test-canvas-hand-pan-state';
    const storage = new Map<string, string>();
    storage.set(storageKey, storedCanvasState([rectElement('rect-1')]));
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={null}
        mode="hand"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const overlay = setOverlayBox(host);
    act(() => overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 23, clientX: 100, clientY: 100 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 23, clientX: 160, clientY: 145 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 23, clientX: 160, clientY: 145 })));

    const saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.viewport).toMatchObject({ x: 60, y: 45, zoom: 1 });
    expect(host.querySelector('.iso-freeform-overlay g')?.getAttribute('style')).toContain('translate(60px, 45px)');
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps line and arrow endpoints in the exact dragged direction', () => {
    const storageKey = 'isomorph-test-canvas-line-direction-state';
    const storage = new Map<string, string>();
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="arrow"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const overlay = setOverlayBox(host);
    act(() => overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 24, clientX: 220, clientY: 180 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 24, clientX: 90, clientY: 120 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 24, clientX: 90, clientY: 120 })));

    const saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.elements[0].points).toEqual([{ x: 220, y: 180 }, { x: 90, y: 120 }]);
    const line = host.querySelector('[data-canvas-element-id] line') as SVGLineElement;
    expect(line.getAttribute('x1')).toBe('220');
    expect(line.getAttribute('y1')).toBe('180');
    expect(line.getAttribute('x2')).toBe('90');
    expect(line.getAttribute('y2')).toBe('120');
    cleanup();
    vi.unstubAllGlobals();
  });

  it('erases touched freeform objects without persisting eraser strokes', () => {
    const storageKey = 'isomorph-test-canvas-eraser-state';
    const storage = new Map<string, string>();
    storage.set(storageKey, storedCanvasState([
      rectElement('rect-1', { x: 40, y: 40, width: 80, height: 60 }),
      rectElement('rect-2', { x: 240, y: 240, width: 80, height: 60 }, 1),
    ]));
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="eraser"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const overlay = setOverlayBox(host);
    act(() => overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 10, clientX: 55, clientY: 55 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 10, clientX: 110, clientY: 85 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 10, clientX: 110, clientY: 85 })));

    const saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.elements.map((element: CanvasElement) => element.id)).toEqual(['rect-2']);
    expect(saved.elements.some((element: CanvasElement) => element.kind === 'eraser')).toBe(false);
    cleanup();
    vi.unstubAllGlobals();
  });

  it('edits text, embed, image metadata, and draft semantic links from the properties panel', () => {
    const storageKey = 'isomorph-test-canvas-rich-props-state';
    const storage = new Map<string, string>();
    const textElement: CanvasElement = { ...rectElement('text-1'), kind: 'text', text: 'Old', fontSize: 16 };
    storage.set(storageKey, storedCanvasState([textElement], ['text-1']));
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="move"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const textInput = host.querySelector('[aria-label="Text content"]') as HTMLTextAreaElement;
    act(() => setControlValue(textInput, 'Edited label'));
    const fontInput = host.querySelector('[aria-label="Font size"]') as HTMLInputElement;
    act(() => setControlValue(fontInput, '24'));
    const targetSelect = host.querySelector('[aria-label="Draft semantic target kind"]') as HTMLSelectElement;
    act(() => setControlValue(targetSelect, 'entity', 'change'));
    act(() => host.querySelector('[aria-label="Link draft semantic target"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    let saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.elements[0]).toMatchObject({ text: 'Edited label', fontSize: 24 });
    expect(saved.draftSemanticLinks[0]).toMatchObject({ canvasElementId: 'text-1', targetKind: 'entity', status: 'draft' });

    act(() => host.querySelector('[aria-label="Duplicate"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.draftSemanticLinks).toHaveLength(1);

    cleanup();
    vi.unstubAllGlobals();

    const embedStorageKey = 'isomorph-test-canvas-embed-props-state';
    const embedStorage = new Map<string, string>();
    const embedElement: CanvasElement = { ...rectElement('embed-1'), kind: 'embed', url: '', title: 'Embed' };
    embedStorage.set(embedStorageKey, storedCanvasState([embedElement], ['embed-1']));
    installStorage(embedStorage);
    const embedRender = render(
      <FullCanvasShell diagram={diagram()} mode="move" canvasStorageKey={embedStorageKey} onModeChange={vi.fn()} onExportSVG={vi.fn()} onExportPNG={vi.fn()} onBack={vi.fn()} />,
    );
    const embedUrl = embedRender.host.querySelector('[aria-label="Embed URL"]') as HTMLInputElement;
    act(() => setControlValue(embedUrl, 'https://example.com/spec'));
    expect(JSON.parse(embedStorage.get(embedStorageKey) || '{}').elements[0]).toMatchObject({ url: 'https://example.com/spec' });
    embedRender.cleanup();
    vi.unstubAllGlobals();

    const imageStorageKey = 'isomorph-test-canvas-image-props-state';
    const imageStorage = new Map<string, string>();
    const imageElement: CanvasElement = { ...rectElement('image-1'), kind: 'image', src: 'data:image/png;base64,abc123', alt: 'Before' };
    imageStorage.set(imageStorageKey, storedCanvasState([imageElement], ['image-1']));
    installStorage(imageStorage);
    const imageRender = render(
      <FullCanvasShell diagram={diagram()} mode="move" canvasStorageKey={imageStorageKey} onModeChange={vi.fn()} onExportSVG={vi.fn()} onExportPNG={vi.fn()} onBack={vi.fn()} />,
    );
    const imageAlt = imageRender.host.querySelector('[aria-label="Image alt text"]') as HTMLInputElement;
    act(() => setControlValue(imageAlt, 'Architecture screenshot'));
    expect(JSON.parse(imageStorage.get(imageStorageKey) || '{}').elements[0]).toMatchObject({ alt: 'Architecture screenshot' });
    imageRender.cleanup();
    vi.unstubAllGlobals();
  });

  it('persists uploaded image elements into canvas state', () => {
    const storageKey = 'isomorph-test-canvas-image-state';
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      readAsDataURL() {
        this.result = 'data:image/png;base64,abc123';
        this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="image"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['image'], 'image.png', { type: 'image/png' })],
    });
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })));

    const saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.elements).toHaveLength(1);
    expect(saved.elements[0]).toMatchObject({ kind: 'image', src: 'data:image/png;base64,abc123' });
    cleanup();
    vi.unstubAllGlobals();
  });

  it('enables export actions for pure freeform canvases without a parsed diagram', () => {
    const storageKey = 'isomorph-test-canvas-freeform-export-state';
    const storage = new Map<string, string>();
    storage.set(storageKey, storedCanvasState([rectElement('rect-1')]));
    installStorage(storage);
    const onExportSVG = vi.fn();
    const onExportPNG = vi.fn();

    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={null}
        mode="move"
        canExport={false}
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={onExportSVG}
        onExportPNG={onExportPNG}
        onBack={vi.fn()}
      />,
    );

    const moreActionsButton = host.querySelector('[aria-label="More actions"]');
    act(() => {
      moreActionsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const svgButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Export SVG') as HTMLButtonElement;
    const pngButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Export PNG') as HTMLButtonElement;
    expect(svgButton).not.toBeNull();
    expect(pngButton).not.toBeNull();
    expect(svgButton.disabled).toBe(false);
    expect(pngButton.disabled).toBe(false);
    act(() => {
      svgButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      pngButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onExportSVG).toHaveBeenCalledTimes(1);
    expect(onExportPNG).toHaveBeenCalledTimes(1);
    cleanup();
    vi.unstubAllGlobals();
  });

  it('exposes strict UML as a canvas route menu toggle', () => {
    const storageKey = 'isomorph-test-canvas-strict-uml-toggle';
    const storage = new Map<string, string>();
    storage.set(storageKey, storedCanvasState([]));
    installStorage(storage);
    const onStrictUmlChange = vi.fn();

    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="move"
        strictUmlEnabled={true}
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
        onStrictUmlChange={onStrictUmlChange}
      />,
    );

    act(() => host.querySelector('[aria-label="More actions"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const toggle = host.querySelector('.iso-full-canvas-menu input[type="checkbox"]') as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    act(() => toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onStrictUmlChange).toHaveBeenCalledWith(false);
    cleanup();
    vi.unstubAllGlobals();
  });

  it('resizes line and arrow elements by dragging their vertex handles', () => {
    const storageKey = 'isomorph-test-canvas-line-vertex-resize-state';
    const storage = new Map<string, string>();
    const lineElement: CanvasElement = {
      id: 'line-1',
      kind: 'line',
      bounds: { x: 100, y: 100, width: 100, height: 100 },
      rotation: 0,
      locked: false,
      layer: 0,
      style: baseStyle,
      points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
      createdAt: '2026-05-23T00:00:00.000Z',
      updatedAt: '2026-05-23T00:00:00.000Z',
    };
    storage.set(storageKey, storedCanvasState([lineElement], ['line-1']));
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="move"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const overlay = setOverlayBox(host);
    const endHandle = host.querySelector('[aria-label="Move end of line-1"]') as SVGCircleElement;
    expect(endHandle).not.toBeNull();

    act(() => endHandle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 5, clientX: 200, clientY: 200 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 5, clientX: 250, clientY: 220 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 5, clientX: 250, clientY: 220 })));

    const saved = JSON.parse(storage.get(storageKey) || '{}');
    const updatedLine = saved.elements[0];
    expect(updatedLine.points[1]).toEqual({ x: 250, y: 220 });
    expect(updatedLine.bounds).toMatchObject({ x: 100, y: 100, width: 150, height: 120 });
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows full transform controls only for selected editable freeform elements', () => {
    const storageKey = 'isomorph-test-canvas-transform-controls-state';
    const storage = new Map<string, string>();
    const textElement: CanvasElement = {
      ...rectElement('text-1', { x: 120, y: 90, width: 160, height: 44 }),
      kind: 'text',
      text: 'Resizable text',
      fontSize: 18,
    };
    storage.set(storageKey, storedCanvasState([textElement], []));
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="move"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(host.querySelector('.iso-canvas-props')).toBeNull();
    expect(host.querySelectorAll('[data-resize-element-id="text-1"]')).toHaveLength(0);

    const text = host.querySelector('[data-canvas-element-id="text-1"] text') as SVGTextElement;
    act(() => text.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 6, clientX: 130, clientY: 110 })));

    expect(host.querySelector('.iso-canvas-props')).not.toBeNull();
    expect(host.querySelectorAll('[data-resize-element-id="text-1"]')).toHaveLength(8);
    expect(host.querySelector('[data-rotate-element-id="text-1"]')).not.toBeNull();

    cleanup();
    vi.unstubAllGlobals();
  });

  it('resizes from northwest handles and rotates selected freeform elements', () => {
    const storageKey = 'isomorph-test-canvas-resize-rotate-state';
    const storage = new Map<string, string>();
    storage.set(storageKey, storedCanvasState([rectElement('rect-1', { x: 100, y: 100, width: 100, height: 80 })], ['rect-1']));
    installStorage(storage);
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="move"
        canvasStorageKey={storageKey}
        onModeChange={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const overlay = setOverlayBox(host);
    const nw = host.querySelector('[aria-label="Resize rect-1 from nw"]') as SVGRectElement;
    expect(nw).not.toBeNull();
    act(() => nw.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, clientX: 100, clientY: 100 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: 80, clientY: 70 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: 80, clientY: 70 })));

    let saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(saved.elements[0].bounds).toMatchObject({ x: 80, y: 70, width: 120, height: 110 });

    const rotate = host.querySelector('[aria-label="Rotate rect-1"]') as SVGCircleElement;
    expect(rotate).not.toBeNull();
    act(() => rotate.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8, clientX: 140, clientY: 46 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 8, clientX: 235, clientY: 125 })));
    act(() => overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 8, clientX: 235, clientY: 125 })));

    saved = JSON.parse(storage.get(storageKey) || '{}');
    expect(Math.abs(saved.elements[0].rotation)).toBeGreaterThan(20);
    cleanup();
    vi.unstubAllGlobals();
  });
});
