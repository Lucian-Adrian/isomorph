// ============================================================
// DiagramExporter — SVG and PNG export utilities (SRP)
// ============================================================
// Extracted from App.tsx to follow Single Responsibility Principle.
// Each function handles one export format independently.
// ============================================================

function getExportSVGString(svgEl: Element, watermark?: boolean): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  
  try {
    if (svgEl instanceof SVGSVGElement && typeof svgEl.getBBox === 'function') {
      const bbox = svgEl.getBBox();
      if (bbox && bbox.width > 0 && bbox.height > 0) {
        const margin = 40;
        const vx = bbox.x - margin;
        const vy = bbox.y - margin;
        const vw = bbox.width + margin * 2;
        const vh = bbox.height + margin * 2;
        clone.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
        clone.setAttribute('width', String(vw));
        clone.setAttribute('height', String(vh));
      }
    }
  } catch (e) {
    // Ignore bounds calculation errors
  }

  const computed = getComputedStyle(document.documentElement);

  // Ensure minimum styles usually provided by the viewer are captured
  if (!clone.getAttribute('style')?.includes('font-family')) {
    clone.style.fontFamily = 'Segoe UI, Arial, sans-serif';
  }
  if (!clone.getAttribute('style')?.includes('background')) {
    const container = svgEl.closest('.iso-canvas-wrap');
    clone.style.background = container ? getComputedStyle(container).backgroundColor : '#fafafa';
  }

  // Remove any CSS overrides we inject for UI only
  clone.style.minWidth = '';
  clone.style.minHeight = '';

  // Inject CSS variables dynamically to make the SVG self-contained
  const vars = [
    '--white', '--off', '--stone', '--ink-light', '--ink-mid', '--ink', '--ink-deep', '--accent',
    '--glass-bg', '--glass-border', '--glass-shadow',
    '--iso-brand', '--iso-brand-dark', '--iso-brand-glow',
    '--iso-bg-app', '--iso-bg-header', '--iso-bg-sidebar', '--iso-bg-editor', '--iso-bg-canvas',
    '--iso-bg-panel', '--iso-bg-hover', '--iso-bg-active',
    '--iso-text-muted', '--iso-text-body', '--iso-text-faint', '--iso-text-canvas', '--iso-bg-blue', '--iso-bg-green',
    '--iso-bg-purple', '--iso-bg-orange', '--iso-bg-yellow', '--iso-border', '--iso-text',
    '--iso-note-bg', '--iso-note-fold', '--iso-note-border', '--iso-note-title', '--iso-note-text', '--iso-note-code',
    '--iso-pkg-bg', '--iso-pkg-border', '--iso-pkg-text'
  ];
  let cssVars = '';
  for (const v of vars) {
    const val = computed.getPropertyValue(v).trim();
    if (val) cssVars += `      ${v}: ${val};\n`;
  }

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    svg {
${cssVars}    }
  `;
  clone.prepend(styleEl);

  if (watermark === true) {
    const texts = Array.from(clone.querySelectorAll('text'));
    const hasWatermark = texts.some(t => t.textContent?.includes('Generated with Isomorph'));
    if (!hasWatermark) {
      const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textEl.setAttribute('x', '100%');
      textEl.setAttribute('y', '100%');
      textEl.setAttribute('dx', '-20');
      textEl.setAttribute('dy', '-20');
      textEl.setAttribute('text-anchor', 'end');
      textEl.setAttribute('font-family', 'Libron, system-ui, sans-serif');
      textEl.setAttribute('font-size', '12');
      textEl.setAttribute('fill', 'var(--iso-text-muted)');
      textEl.setAttribute('opacity', '0.5');
      textEl.setAttribute('pointer-events', 'none');
      textEl.textContent = 'Generated with Isomorph';
      clone.appendChild(textEl);
    }
  } else if (watermark === false) {
    clone.querySelectorAll('text').forEach(t => {
      if (t.textContent?.includes('Generated with Isomorph')) {
        t.remove();
      }
    });
  }

  return new XMLSerializer().serializeToString(clone);
}

/**
 * Serialises the currently visible SVG element and triggers a download.
 * @param diagramName  Base filename (without extension).
 * @param selector     CSS selector for the SVG element (default: `.iso-canvas-wrap svg`).
 * @param watermark    Whether to enforce the watermark watermark.
 */
export function exportSVG(
  diagramName: string,
  selector = '.iso-canvas-wrap svg',
  watermark?: boolean,
): void {
  const svgEl = document.querySelector(selector);
  if (!svgEl) return;

  const svgStr = getExportSVGString(svgEl, watermark);
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
 * @param watermark    Whether to enforce the watermark watermark.
 */
export function exportPNG(
  diagramName: string,
  selector = '.iso-canvas-wrap svg',
  scale = 2,
  watermark?: boolean,
): void {
  const svgEl = document.querySelector(selector);
  if (!svgEl) return;

  const svgStr = getExportSVGString(svgEl, watermark);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

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

    // Get actual canvas background color
    const computed = getComputedStyle(document.documentElement);
    let bg = computed.getPropertyValue('--iso-bg-canvas').trim();
    // If it's a CSS variable reference like var(--white), we can't easily resolve it in canvas.
    // However, the SVG itself has a solid background applied on the clone, but drawing an SVG with transparent parts needs a backfill.
    // Instead of using var(), we'll let the SVG handle its own background and we'll just fill transparent if needed,
    // OR we can read the computed background color of the actual container.
    const container = document.querySelector(selector)?.closest('.iso-canvas-wrap');
    if (container) {
      bg = getComputedStyle(container).backgroundColor || '#fafafa';
    } else {
      bg = '#fafafa'; // fallback
    }

    ctx.scale(scale, scale);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, nativeW, nativeH);
    ctx.drawImage(img, 0, 0, nativeW, nativeH);
    URL.revokeObjectURL(url);

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

// ============================================================
// Animation Exporters
// ============================================================
import type { IOMDiagram } from '../semantics/iom.js';
import { renderDiagram } from '../renderer/index.js';
import { encode } from 'modern-gif';
// @ts-ignore
import workerUrl from 'modern-gif/worker?url';

function getDiagramDuration(diagram: IOMDiagram): number {
  if (diagram.kind === 'sequence') {
    return diagram.relations.length * 800 + 1000;
  }
  return 1700;
}

async function renderFrames(diagram: IOMDiagram, options: any, fps: number): Promise<{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, frames: { data: Uint8ClampedArray, imageData: ImageData, delay: number }[] }> {
  const durationMs = getDiagramDuration(diagram);
  const delayMs = 1000 / fps;
  const numFrames = Math.ceil(durationMs / delayMs);
  
  const testSvg = renderDiagram(diagram, { ...options, isAnimating: false });
  const wMatch = testSvg.match(/width="([^"]+)"/);
  const hMatch = testSvg.match(/height="([^"]+)"/);
  const width = wMatch ? parseFloat(wMatch[1]) : 800;
  const height = hMatch ? parseFloat(hMatch[1]) : 600;

  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No canvas context');
  
  const frames = [];
  const computed = getComputedStyle(document.documentElement);
  const bg = computed.getPropertyValue('--iso-bg-canvas').trim() || '#fafafa';

  for (let i = 0; i < numFrames; i++) {
    const t = i * delayMs * (options.animationSpeed ?? 1);
    const svgStr = renderDiagram(diagram, { ...options, isAnimating: true, animationTimeMs: t });
    
    const clone = document.createElement('div');
    clone.innerHTML = svgStr;
    const svgEl = clone.querySelector('svg');
    if (svgEl) {
      const vars = [
        '--white', '--off', '--stone', '--ink-light', '--ink-mid', '--ink', '--ink-deep', '--accent',
        '--iso-brand', '--iso-brand-dark', '--iso-brand-glow',
        '--iso-bg-app', '--iso-bg-header', '--iso-bg-sidebar', '--iso-bg-editor', '--iso-bg-canvas',
        '--iso-bg-panel', '--iso-bg-hover', '--iso-bg-active',
        '--iso-text-muted', '--iso-text-body', '--iso-text-faint', '--iso-text-canvas', '--iso-bg-blue', '--iso-bg-green',
        '--iso-bg-purple', '--iso-bg-orange', '--iso-bg-yellow', '--iso-border', '--iso-text',
        '--iso-note-bg', '--iso-note-fold', '--iso-note-border', '--iso-note-title', '--iso-note-text', '--iso-note-code',
        '--iso-pkg-bg', '--iso-pkg-border', '--iso-pkg-text'
      ];
      let cssVars = '';
      for (const v of vars) {
        const val = computed.getPropertyValue(v).trim();
        if (val) cssVars += `      ${v}: ${val};\n`;
      }
      const styleEl = document.createElement('style');
      styleEl.textContent = `svg { ${cssVars} font-family: 'Segoe UI', Arial, sans-serif; }`;
      svgEl.prepend(styleEl);
    }
    
    const finalSvgStr = new XMLSerializer().serializeToString(svgEl || clone);
    const img = new Image();
    const svgBlob = new Blob([finalSvgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = width * 2;
    frameCanvas.height = height * 2;
    const fctx = frameCanvas.getContext('2d');
    
    await new Promise<void>((resolve) => {
      img.onload = () => {
        if (fctx) {
          fctx.scale(2, 2);
          fctx.fillStyle = bg;
          fctx.fillRect(0, 0, width, height);
          fctx.drawImage(img, 0, 0, width, height);
        }
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });

    // Also draw to the main canvas for WebM/preview
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(frameCanvas, 0, 0);

    const imageData = fctx ? fctx.getImageData(0, 0, width * 2, height * 2) : ctx.getImageData(0, 0, width * 2, height * 2);
    frames.push({ data: imageData.data, imageData, delay: delayMs });
  }

  return { canvas, ctx, frames };
}

export async function exportGIF(diagram: IOMDiagram, diagramName: string, options: any) {
  try {
    const { canvas, frames } = await renderFrames(diagram, options, 15); // 15 fps is good for GIF
    const gifFrames = frames.map(f => ({
      data: f.data,
      delay: f.delay
    }));

    const gifBlob = await encode({
      workerUrl,
      width: canvas.width,
      height: canvas.height,
      frames: gifFrames as any,
      format: 'blob'
    });
    
    let finalBlob: Blob;
    if (gifBlob instanceof Blob) {
      finalBlob = gifBlob;
    } else {
      finalBlob = new Blob([gifBlob as any], { type: 'image/gif' });
    }
    
    const url = URL.createObjectURL(finalBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${diagramName}.gif`;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    console.error("Failed to export GIF", err);
    throw new Error(err?.message || "Failed to export GIF. Please check your browser canvas support.");
  }
}

export async function exportVideo(diagram: IOMDiagram, diagramName: string, options: any) {
  try {
    const fps = 30;
    const { canvas, frames } = await renderFrames(diagram, options, fps);
    
    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    
    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${diagramName}.webm`;
      anchor.click();
      URL.revokeObjectURL(url);
    };

    recorder.start();
    
    // Play back frames into canvas in real-time
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    for (const frame of frames) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(frame.imageData, 0, 0);
      await new Promise(resolve => setTimeout(resolve, frame.delay));
    }
    
    recorder.stop();
  } catch (err: any) {
    console.error("Failed to export WebM", err);
    throw new Error(err?.message || "Failed to export WebM video. Please check your browser MediaRecorder support.");
  }
}
