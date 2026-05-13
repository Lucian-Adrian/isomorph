import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportPNG, serializeSVGForExport } from '../src/utils/exporter.js';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('SVG export serialization', () => {
  it('adds XML metadata, dimensions, background, and font defaults', () => {
    document.body.innerHTML = '<svg><rect width="10" height="10"/></svg>';
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
});
