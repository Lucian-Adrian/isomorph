// ============================================================
// DiagramExporter — SVG and PNG export utilities (SRP)
// ============================================================
// Extracted from App.tsx to follow Single Responsibility Principle.
// Each function handles one export format independently.
// ============================================================

import type { CanvasElement, CanvasState } from '../canvas/canvasTypes.js';
import { validateCanvasState } from '../canvas/canvasValidation.js';

interface ExportOptions {
  overlayEl?: Element | null;
  canvasState?: CanvasState | null;
}

type ExportOverlayOrOptions = Element | null | ExportOptions;

const SVG_NS = 'http://www.w3.org/2000/svg';

function isElement(value: ExportOverlayOrOptions | undefined): value is Element | null {
  return value === null || value instanceof Element;
}

function resolveExportOptions(svgEl: Element, overlayOrOptions?: ExportOverlayOrOptions): ExportOptions {
  if (overlayOrOptions === undefined) return { overlayEl: findFreeformOverlay(svgEl) };
  if (isElement(overlayOrOptions)) return { overlayEl: overlayOrOptions };
  return {
    overlayEl: overlayOrOptions.overlayEl,
    canvasState: overlayOrOptions.canvasState,
  };
}

function createFallbackSvgForCanvasState(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const width = Math.max(1, window.innerWidth || 1200);
  const height = Math.max(1, window.innerHeight || 800);
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  return svg;
}

function findExportSvg(selector: string, options?: ExportOptions): Element | null {
  const svgEl = document.querySelector(selector);
  if (svgEl) return svgEl;
  return options?.canvasState ? createFallbackSvgForCanvasState() : null;
}

function copyFreeformOverlayIntoSvg(clone: SVGSVGElement, overlayEl?: Element | null): void {
  if (!overlayEl) return;
  const overlayClone = overlayEl.cloneNode(true) as SVGSVGElement;
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('data-export-layer', 'freeform-canvas');

  for (const child of Array.from(overlayClone.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const element = child as Element;
    if (element.tagName.toLowerCase() === 'defs') {
      clone.insertBefore(element, clone.firstChild);
    } else {
      group.appendChild(element);
    }
  }

  if (group.childNodes.length > 0) {
    clone.appendChild(group);
  }
}

function setAttrs(element: Element, attrs: Record<string, string | number | undefined>): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined) element.setAttribute(key, String(value));
  }
}

function appendFreeformArrowMarker(clone: SVGSVGElement, stroke: string): void {
  const defs = document.createElementNS(SVG_NS, 'defs');
  const marker = document.createElementNS(SVG_NS, 'marker');
  setAttrs(marker, {
    id: 'isx-freeform-arrow',
    markerWidth: 10,
    markerHeight: 10,
    refX: 8,
    refY: 3,
    orient: 'auto',
    markerUnits: 'strokeWidth',
  });
  const path = document.createElementNS(SVG_NS, 'path');
  setAttrs(path, { d: 'M0,0 L0,6 L9,3 z', fill: stroke });
  marker.appendChild(path);
  defs.appendChild(marker);
  clone.insertBefore(defs, clone.firstChild);
}

function commonCanvasAttrs(element: CanvasElement, selected = false) {
  return {
    stroke: selected ? '#3b82f6' : element.style.stroke,
    fill: element.kind === 'line' || element.kind === 'arrow' || element.kind === 'pen' ? 'none' : element.style.fill,
    'stroke-width': selected ? Math.max(3, element.style.strokeWidth) : element.style.strokeWidth,
    opacity: element.style.opacity,
    'data-canvas-element-id': element.id,
  };
}

function appendCanvasText(group: SVGGElement, x: number, y: number, text: string, fill: string, fontSize: number): void {
  const textEl = document.createElementNS(SVG_NS, 'text');
  setAttrs(textEl, { x, y, fill, 'font-size': fontSize });
  textEl.textContent = text;
  group.appendChild(textEl);
}

function appendCanvasStateElement(parent: SVGGElement, element: CanvasElement, selectedElementIds: Set<string>): void {
  const selected = selectedElementIds.has(element.id);
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('data-canvas-element-id', element.id);
  const common = commonCanvasAttrs(element, selected);

  if (element.kind === 'ellipse') {
    const ellipse = document.createElementNS(SVG_NS, 'ellipse');
    setAttrs(ellipse, {
      cx: element.bounds.x + element.bounds.width / 2,
      cy: element.bounds.y + element.bounds.height / 2,
      rx: element.bounds.width / 2,
      ry: element.bounds.height / 2,
      ...common,
    });
    group.appendChild(ellipse);
  } else if (element.kind === 'line' || element.kind === 'arrow') {
    const line = document.createElementNS(SVG_NS, 'line');
    setAttrs(line, {
      x1: element.bounds.x,
      y1: element.bounds.y,
      x2: element.bounds.x + element.bounds.width,
      y2: element.bounds.y + element.bounds.height,
      markerEnd: element.kind === 'arrow' ? 'url(#isx-freeform-arrow)' : undefined,
      ...common,
    });
    group.appendChild(line);
  } else if (element.kind === 'pen' || element.kind === 'eraser' || element.kind === 'laser' || element.kind === 'lasso') {
    const path = document.createElementNS(SVG_NS, 'path');
    const points = 'points' in element ? element.points : [];
    const d = points.length > 0
      ? points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
      : `M ${element.bounds.x} ${element.bounds.y} L ${element.bounds.x + element.bounds.width} ${element.bounds.y + element.bounds.height}`;
    setAttrs(path, { d, ...common, fill: 'none' });
    group.appendChild(path);
  } else if (element.kind === 'text') {
    appendCanvasText(group, element.bounds.x, element.bounds.y + 18, element.text, selected ? '#3b82f6' : element.style.text, element.fontSize);
  } else if (element.kind === 'image') {
    if (element.src) {
      const image = document.createElementNS(SVG_NS, 'image');
      const preserveAspectRatio = element.fit === 'stretch' ? 'none' : element.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
      setAttrs(image, {
        href: element.src,
        x: element.bounds.x,
        y: element.bounds.y,
        width: element.bounds.width,
        height: element.bounds.height,
        preserveAspectRatio,
        'data-canvas-element-id': element.id,
      });
      group.appendChild(image);
    } else {
      const rect = document.createElementNS(SVG_NS, 'rect');
      setAttrs(rect, { ...element.bounds, ...common, 'stroke-dasharray': selected ? '4 2' : '6 4' });
      group.appendChild(rect);
    }
    appendCanvasText(group, element.bounds.x + 12, element.bounds.y + 24, 'Image', selected ? '#3b82f6' : element.style.text, 13);
  } else {
    const dashed = element.kind === 'frame' || element.kind === 'embed' || element.kind === 'uml-package';
    const rect = document.createElementNS(SVG_NS, 'rect');
    setAttrs(rect, {
      ...element.bounds,
      rx: element.kind === 'rectangle' ? 6 : 2,
      ...common,
      'stroke-dasharray': selected ? '4 2' : (dashed ? '8 5' : undefined),
    });
    group.appendChild(rect);
    if ('title' in element && element.title) {
      appendCanvasText(group, element.bounds.x + 10, element.bounds.y + 22, element.title, selected ? '#3b82f6' : element.style.text, 13);
    }
    if (element.kind === 'embed') {
      appendCanvasText(group, element.bounds.x + 10, element.bounds.y + 42, element.url || 'Web embed', selected ? '#3b82f6' : element.style.text, 12);
    }
  }

  parent.appendChild(group);
}

function copyCanvasStateIntoSvg(clone: SVGSVGElement, canvasState: CanvasState): void {
  const { state } = validateCanvasState(canvasState);
  appendFreeformArrowMarker(clone, state.styleDefaults.stroke);
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('data-export-layer', 'freeform-canvas');
  const selectedElementIds = new Set(state.selectedElementIds);
  for (const element of [...state.elements].sort((a, b) => a.layer - b.layer)) {
    appendCanvasStateElement(group, element, selectedElementIds);
  }
  if (group.childNodes.length > 0) clone.appendChild(group);
}

function findFreeformOverlay(svgEl: Element): Element | null {
  const viewport = svgEl.closest('.iso-full-canvas-viewport');
  if (viewport) return viewport.querySelector('.iso-freeform-overlay');
  return document.querySelector('.iso-freeform-overlay');
}

type Bounds = { x: number; y: number; width: number; height: number };
type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number };

const EXPORT_MARGIN = 40;
const IDENTITY_MATRIX: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function finiteNumber(value: string | null | undefined, fallback = 0): number {
  if (value == null || value.trim() === '') return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function multiplyMatrix(left: Matrix, right: Matrix): Matrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

function transformPoint(matrix: Matrix, x: number, y: number) {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

function transformBounds(bounds: Bounds, matrix: Matrix): Bounds {
  const points = [
    transformPoint(matrix, bounds.x, bounds.y),
    transformPoint(matrix, bounds.x + bounds.width, bounds.y),
    transformPoint(matrix, bounds.x, bounds.y + bounds.height),
    transformPoint(matrix, bounds.x + bounds.width, bounds.y + bounds.height),
  ];
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function parseTransform(transform: string | null): Matrix {
  if (!transform) return IDENTITY_MATRIX;
  let matrix = IDENTITY_MATRIX;
  const commands = transform.matchAll(/(matrix|translate|scale)\(([^)]*)\)/g);
  for (const command of commands) {
    const values = command[2]
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(value => Number.parseFloat(value));
    if (values.some(value => !Number.isFinite(value))) continue;
    let next = IDENTITY_MATRIX;
    if (command[1] === 'matrix' && values.length >= 6) {
      next = { a: values[0], b: values[1], c: values[2], d: values[3], e: values[4], f: values[5] };
    } else if (command[1] === 'translate') {
      next = { a: 1, b: 0, c: 0, d: 1, e: values[0] ?? 0, f: values[1] ?? 0 };
    } else if (command[1] === 'scale') {
      const sx = values[0] ?? 1;
      const sy = values[1] ?? sx;
      next = { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
    }
    matrix = multiplyMatrix(matrix, next);
  }
  return matrix;
}

function matrixScaleExtent(matrix: Matrix): number {
  return Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d), 1);
}

function expandBounds(bounds: Bounds, amount: number): Bounds {
  if (amount <= 0) return bounds;
  return {
    x: bounds.x - amount,
    y: bounds.y - amount,
    width: bounds.width + amount * 2,
    height: bounds.height + amount * 2,
  };
}

function pointsBounds(points: Array<{ x: number; y: number }>): Bounds | null {
  if (points.length === 0) return null;
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function parsePoints(value: string | null): Array<{ x: number; y: number }> {
  if (!value) return [];
  const values = value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(item => Number.parseFloat(item))
    .filter(Number.isFinite);
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < values.length; i += 2) {
    points.push({ x: values[i], y: values[i + 1] });
  }
  return points;
}

function parsePathBounds(d: string | null): Bounds | null {
  if (!d) return null;
  const values = d
    .match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)
    ?.map(value => Number.parseFloat(value))
    .filter(Number.isFinite) ?? [];
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < values.length; i += 2) {
    points.push({ x: values[i], y: values[i + 1] });
  }
  return pointsBounds(points);
}

function localElementBounds(element: Element): Bounds | null {
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'rect' || tagName === 'image' || tagName === 'foreignobject' || tagName === 'svg') {
    const width = finiteNumber(element.getAttribute('width'));
    const height = finiteNumber(element.getAttribute('height'));
    if (width <= 0 || height <= 0) return null;
    return {
      x: finiteNumber(element.getAttribute('x')),
      y: finiteNumber(element.getAttribute('y')),
      width,
      height,
    };
  }
  if (tagName === 'circle') {
    const r = finiteNumber(element.getAttribute('r'));
    if (r <= 0) return null;
    const cx = finiteNumber(element.getAttribute('cx'));
    const cy = finiteNumber(element.getAttribute('cy'));
    return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
  }
  if (tagName === 'ellipse') {
    const rx = finiteNumber(element.getAttribute('rx'));
    const ry = finiteNumber(element.getAttribute('ry'));
    if (rx <= 0 || ry <= 0) return null;
    const cx = finiteNumber(element.getAttribute('cx'));
    const cy = finiteNumber(element.getAttribute('cy'));
    return { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 };
  }
  if (tagName === 'line') {
    return pointsBounds([
      { x: finiteNumber(element.getAttribute('x1')), y: finiteNumber(element.getAttribute('y1')) },
      { x: finiteNumber(element.getAttribute('x2')), y: finiteNumber(element.getAttribute('y2')) },
    ]);
  }
  if (tagName === 'polyline' || tagName === 'polygon') {
    return pointsBounds(parsePoints(element.getAttribute('points')));
  }
  if (tagName === 'path') {
    return parsePathBounds(element.getAttribute('d'));
  }
  if (tagName === 'text') {
    const fontSize = finiteNumber(element.getAttribute('font-size') ?? element.getAttribute('fontSize'), 16);
    const textLength = (element.textContent ?? '').trim().length;
    return {
      x: finiteNumber(element.getAttribute('x')),
      y: finiteNumber(element.getAttribute('y')) - fontSize,
      width: Math.max(textLength * fontSize * 0.65, fontSize),
      height: fontSize * 1.25,
    };
  }
  return null;
}

function getStrokePadding(element: Element, matrix: Matrix): number {
  const strokeWidth = finiteNumber(element.getAttribute('stroke-width') ?? element.getAttribute('strokeWidth'));
  return (strokeWidth / 2) * matrixScaleExtent(matrix);
}

function collectStaticBounds(element: Element, parentMatrix = IDENTITY_MATRIX): Bounds | null {
  if (element.tagName.toLowerCase() === 'defs' || element.tagName.toLowerCase() === 'marker') return null;
  const matrix = multiplyMatrix(parentMatrix, parseTransform(element.getAttribute('transform')));
  const local = localElementBounds(element);
  let bounds = local ? expandBounds(transformBounds(local, matrix), getStrokePadding(element, matrix)) : null;

  for (const child of Array.from(element.children)) {
    bounds = unionBounds(bounds, collectStaticBounds(child, matrix));
  }

  return bounds;
}

function readSvgBBox(svgEl: Element): Bounds | null {
  try {
    if (svgEl instanceof SVGSVGElement && typeof svgEl.getBBox === 'function') {
      const bbox = svgEl.getBBox();
      if (bbox && bbox.width > 0 && bbox.height > 0) {
        return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
      }
    }
  } catch {
    // Browser SVG measurement can fail for detached or display:none elements.
  }
  return null;
}

function calculateExportBounds(svgEl: Element, clone: SVGSVGElement): Bounds | null {
  return unionBounds(readSvgBBox(svgEl), collectStaticBounds(clone));
}

export function serializeSVGForExport(svgEl: Element, overlayOrOptions?: ExportOverlayOrOptions): string {
  const options = resolveExportOptions(svgEl, overlayOrOptions);
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (options.canvasState) {
    copyCanvasStateIntoSvg(clone, options.canvasState);
  } else {
    copyFreeformOverlayIntoSvg(clone, options.overlayEl ?? findFreeformOverlay(svgEl));
  }
  
  const bounds = calculateExportBounds(svgEl, clone);
  if (bounds && bounds.width > 0 && bounds.height > 0) {
    const vx = bounds.x - EXPORT_MARGIN;
    const vy = bounds.y - EXPORT_MARGIN;
    const vw = bounds.width + EXPORT_MARGIN * 2;
    const vh = bounds.height + EXPORT_MARGIN * 2;
    clone.setAttribute('viewBox', `${formatNumber(vx)} ${formatNumber(vy)} ${formatNumber(vw)} ${formatNumber(vh)}`);
    clone.setAttribute('width', formatNumber(vw));
    clone.setAttribute('height', formatNumber(vh));
  }

  // Ensure minimum styles usually provided by the viewer are captured
  if (!clone.getAttribute('style')?.includes('font-family')) {
    clone.style.fontFamily = 'Segoe UI, Arial, sans-serif';
  }
  if (!clone.getAttribute('style')?.includes('background')) {
    clone.style.background = '#fafafa';
  }
  if (!clone.getAttribute('width')) clone.setAttribute('width', String((svgEl as SVGSVGElement).clientWidth || 1200));
  if (!clone.getAttribute('height')) clone.setAttribute('height', String((svgEl as SVGSVGElement).clientHeight || 800));

  // Remove any CSS overrides we inject for UI only
  clone.style.minWidth = '';
  clone.style.minHeight = '';

  const serialized = new XMLSerializer().serializeToString(clone);
  return serialized.startsWith('<?xml') ? serialized : `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;
}

/**
 * Serialises the currently visible SVG element and triggers a download.
 * @param diagramName  Base filename (without extension).
 * @param selector     CSS selector for the SVG element (default: `.iso-canvas-wrap svg`).
 */
export function exportSVG(
  diagramName: string,
  selector = '.iso-canvas-wrap svg',
  options?: ExportOptions,
): void {
  const svgEl = findExportSvg(selector, options);
  if (!svgEl) return;

  const svgStr = serializeSVGForExport(svgEl, options);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${diagramName}.svg`;
  anchor.rel = 'noopener';
  anchor.target = '_blank';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

/**
 * Rasterises the SVG to a 2× retina PNG and triggers a download.
 * @param diagramName  Base filename (without extension).
 * @param selector     CSS selector for the SVG element (default: `.iso-canvas-wrap svg`).
 * @param scale        Device-pixel ratio (default: 2).
 */
export function exportPNG(
  diagramName: string,
  selector = '.iso-canvas-wrap svg',
  scale = 2,
  options?: ExportOptions,
): void {
  const svgEl = findExportSvg(selector, options);
  if (!svgEl) return;

  const svgStr = serializeSVGForExport(svgEl, options);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;

  const img = new Image();
  img.onload = () => {
    // Extract actual width/height based on the exported SVG's attributes instead of relying purely on auto Image scaling
    // fallback to img.width if it parses immediately
    const clone = document.createElement('div');
    clone.innerHTML = svgStr;
    const sEl = clone.querySelector('svg');
    const nativeW = sEl ? parseFloat(sEl.getAttribute('width') || String(img.width)) : img.width;
    const nativeH = sEl ? parseFloat(sEl.getAttribute('height') || String(img.height)) : img.height;

    const canvas = document.createElement('canvas');
    canvas.width = nativeW * scale;
    canvas.height = nativeH * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, nativeW, nativeH);
    ctx.drawImage(img, 0, 0, nativeW, nativeH);
    canvas.toBlob(blob => {
      if (blob) {
        const pngUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = pngUrl;
        anchor.download = `${diagramName}.png`;
        anchor.rel = 'noopener';
        anchor.target = '_blank';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(pngUrl);
        return;
      }
      // Fallback path for browsers where toBlob may fail.
      const dataUrl = canvas.toDataURL('image/png');
      const anchor = document.createElement('a');
      anchor.href = dataUrl;
      anchor.download = `${diagramName}.png`;
      anchor.rel = 'noopener';
      anchor.target = '_blank';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }, 'image/png');
  };
  img.src = url;
}
