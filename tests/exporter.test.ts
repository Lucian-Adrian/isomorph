import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportPNG, serializeSVGForExport, parseTransform } from '../src/utils/exporter.js';
import { createEmptyCanvasState } from '../src/canvas/canvasSerialization.js';
import { createCanvasElement } from '../src/canvas/canvasTools.js';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('SVG export serialization', () => {
  it('adds XML metadata, dimensions, background, and font defaults', () => {
    document.body.innerHTML = '<svg></svg>';
    const svg = document.querySelector('svg')!;
    const serialized = serializeSVGForExport(svg);

    expect(serialized).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(serialized).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(serialized).toContain('width="1200"');
    expect(serialized).toContain('height="800"');
    expect(serialized).toContain('font-family');
    expect(serialized).toContain('background');
  });

  it('serializes measured SVG bounds for canvas export readiness', () => {
    document.body.innerHTML = '<svg><g><rect x="20" y="30" width="200" height="100"/></g></svg>';
    const svg = document.querySelector('svg') as SVGSVGElement;
    Object.defineProperty(svg, 'getBBox', {
      configurable: true,
      value: () => ({ x: 20, y: 30, width: 200, height: 100 }),
    });

    const serialized = serializeSVGForExport(svg);

    expect(serialized).toContain('viewBox="-20 -10 280 180"');
    expect(serialized).toContain('width="280"');
    expect(serialized).toContain('height="180"');
    expect(serialized).not.toContain('min-width');
    expect(serialized).not.toContain('min-height');
  });

  it('composes full-canvas freeform overlay elements into exported SVG', () => {
    document.body.innerHTML = `
      <div class="iso-full-canvas-viewport">
        <div class="iso-canvas-wrap">
          <svg class="semantic"><rect x="10" y="10" width="20" height="20"/></svg>
        </div>
        <svg class="iso-freeform-overlay">
          <defs><marker id="arrow"><path d="M0 0 L4 2 L0 4 z"/></marker></defs>
          <rect data-freeform-id="rect-1" x="40" y="50" width="140" height="90"></rect>
        </svg>
      </div>
    `;
    const svg = document.querySelector('.semantic')!;

    const serialized = serializeSVGForExport(svg);

    expect(serialized).toContain('data-export-layer="freeform-canvas"');
    expect(serialized).toContain('data-freeform-id="rect-1"');
    expect(serialized).toContain('marker');
  });

  it('frames freeform overlay content outside the semantic diagram bounds', () => {
    document.body.innerHTML = `
      <div class="iso-full-canvas-viewport">
        <div class="iso-canvas-wrap">
          <svg class="semantic"><rect x="100" y="100" width="40" height="40"/></svg>
        </div>
        <svg class="iso-freeform-overlay">
          <g>
            <image data-freeform-id="image-1" href="data:image/png;base64,abc" x="-220" y="-120" width="80" height="60"></image>
            <rect data-freeform-id="rect-2" x="420" y="300" width="90" height="50"></rect>
          </g>
        </svg>
      </div>
    `;
    const svg = document.querySelector('.semantic') as SVGSVGElement;
    Object.defineProperty(svg, 'getBBox', {
      configurable: true,
      value: () => ({ x: 100, y: 100, width: 40, height: 40 }),
    });

    const serialized = serializeSVGForExport(svg);

    expect(serialized).toContain('data-freeform-id="image-1"');
    expect(serialized).toContain('viewBox="-260 -160 810 550"');
    expect(serialized).toContain('width="810"');
    expect(serialized).toContain('height="550"');
  });

  it('applies exported freeform transform bounds before sizing PNG-ready SVG output', () => {
    document.body.innerHTML = `
      <div class="iso-full-canvas-viewport">
        <div class="iso-canvas-wrap">
          <svg class="semantic"><rect x="0" y="0" width="80" height="80"/></svg>
        </div>
        <svg class="iso-freeform-overlay">
          <g transform="translate(200, 100) scale(2)">
            <line data-freeform-id="line-1" x1="10" y1="20" x2="90" y2="60" stroke-width="12"></line>
          </g>
        </svg>
      </div>
    `;
    const svg = document.querySelector('.semantic') as SVGSVGElement;
    Object.defineProperty(svg, 'getBBox', {
      configurable: true,
      value: () => ({ x: 0, y: 0, width: 80, height: 80 }),
    });

    const serialized = serializeSVGForExport(svg);

    expect(serialized).toContain('data-freeform-id="line-1"');
    expect(serialized).toContain('viewBox="-40 -40 176 160"');
    expect(serialized).toContain('width="176"');
    expect(serialized).toContain('height="160"');
  });

  it('composes full-canvas export from canonical canvas_state when overlay DOM is stale', () => {
    const state = createEmptyCanvasState('2026-06-01T00:00:00.000Z');
    const offscreenImage = createCanvasElement({
      id: 'canonical-offscreen-image',
      kind: 'image',
      bounds: { x: -260, y: -180, width: 96, height: 64 },
      style: state.styleDefaults,
      src: 'data:image/png;base64,abc',
      now: state.updatedAt,
    });
    const farRect = createCanvasElement({
      id: 'canonical-far-rect',
      kind: 'rectangle',
      bounds: { x: 900, y: 620, width: 150, height: 80 },
      style: { ...state.styleDefaults, fill: '#e03131', strokeWidth: 8 },
      now: state.updatedAt,
    });
    const canvasState = { ...state, elements: [offscreenImage, farRect] };
    document.body.innerHTML = `
      <div class="iso-full-canvas-viewport">
        <div class="iso-canvas-wrap">
          <svg class="semantic"><rect x="0" y="0" width="80" height="80"/></svg>
        </div>
        <svg class="iso-freeform-overlay">
          <g><rect data-canvas-element-id="stale-dom-only" x="10" y="20" width="30" height="40"></rect></g>
        </svg>
      </div>
    `;
    const svg = document.querySelector('.semantic') as SVGSVGElement;
    Object.defineProperty(svg, 'getBBox', {
      configurable: true,
      value: () => ({ x: 0, y: 0, width: 80, height: 80 }),
    });

    const serialized = serializeSVGForExport(svg, { canvasState });

    expect(serialized).toContain('canonical-offscreen-image');
    expect(serialized).toContain('canonical-far-rect');
    expect(serialized).not.toContain('stale-dom-only');
    expect(serialized).toContain('viewBox="-300 -220 1394 964"');
  });

  it('prepares PNG export with serialized SVG dimensions and a download anchor', async () => {
    document.body.innerHTML = '<svg class="ready"><rect width="10" height="10"/></svg>';
    const svg = document.querySelector('svg') as SVGSVGElement;
    Object.defineProperty(svg, 'clientWidth', { configurable: true, value: 320 });
    Object.defineProperty(svg, 'clientHeight', { configurable: true, value: 180 });

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: () => 'blob:unmocked',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: () => undefined,
    });
    const objectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:png-ready');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            scale: vi.fn(),
            fillRect: vi.fn(),
            drawImage: vi.fn(),
            fillStyle: '',
          }),
          toBlob: (callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })),
        } as unknown as HTMLCanvasElement;
      }
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { configurable: true, value: clickSpy });
      }
      return element;
    });

    class ReadyImage {
      onload: (() => void) | null = null;
      width = 320;
      height = 180;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', ReadyImage);

    exportPNG('diagram-ready', '.ready', 2);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(objectUrlSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'image/png' }));
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('includes xmlns:xlink attribute on the serialized root SVG', () => {
    document.body.innerHTML = '<svg></svg>';
    const svg = document.querySelector('svg')!;
    const serialized = serializeSVGForExport(svg);
    expect(serialized).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
  });

  it('exports rotated elements from canvas state with transform="rotate(angle cx cy)"', () => {
    const state = createEmptyCanvasState('2026-06-01T00:00:00.000Z');
    const rotatedRect = createCanvasElement({
      id: 'rotated-rect',
      kind: 'rectangle',
      bounds: { x: 100, y: 100, width: 80, height: 60 },
      style: state.styleDefaults,
      now: state.updatedAt,
    });
    rotatedRect.rotation = 45;

    const canvasState = { ...state, elements: [rotatedRect] };
    document.body.innerHTML = `
      <div class="iso-full-canvas-viewport">
        <div class="iso-canvas-wrap">
          <svg class="semantic"><rect x="0" y="0" width="80" height="80"/></svg>
        </div>
        <svg class="iso-freeform-overlay"></svg>
      </div>
    `;
    const svg = document.querySelector('.semantic') as SVGSVGElement;

    const serialized = serializeSVGForExport(svg, { canvasState });
    expect(serialized).toContain('transform="rotate(45 140 130)"');
  });

  it('parses rotate transform matrix correctly in parseTransform', () => {
    const matrix = parseTransform('rotate(90 100 200)');
    expect(matrix.a).toBeCloseTo(0);
    expect(matrix.b).toBeCloseTo(1);
    expect(matrix.c).toBeCloseTo(-1);
    expect(matrix.d).toBeCloseTo(0);
    expect(matrix.e).toBeCloseTo(300);
    expect(matrix.f).toBeCloseTo(100);
  });
});
