import { describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FullCanvasShell } from '../../src/components/FullCanvasShell.js';
import type { IOMDiagram } from '../../src/semantics/iom.js';

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

describe('full canvas shell', () => {
  it('renders edge-to-edge canvas chrome and exposes the primary toolbar', () => {
    const onModeChange = vi.fn();
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram()}
        mode="move"
        onModeChange={onModeChange}
        onSave={vi.fn()}
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
        onSave={vi.fn()}
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
        onSave={vi.fn()}
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
});
