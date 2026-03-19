// ============================================================
// DiagramExporter — SVG and PNG export utilities (SRP)
// ============================================================
// Extracted from App.tsx to follow Single Responsibility Principle.
// Each function handles one export format independently.
// ============================================================

function getExportSVGString(svgEl: Element): string {
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

  // Ensure minimum styles usually provided by the viewer are captured
  if (!clone.getAttribute('style')?.includes('font-family')) {
    clone.style.fontFamily = 'Segoe UI, Arial, sans-serif';
  }
  if (!clone.getAttribute('style')?.includes('background')) {
    clone.style.background = '#fafafa';
  }

  // Remove any CSS overrides we inject for UI only
  clone.style.minWidth = '';
  clone.style.minHeight = '';

  return new XMLSerializer().serializeToString(clone);
}

/**
 * Serialises the currently visible SVG element and triggers a download.
 * @param diagramName  Base filename (without extension).
 * @param selector     CSS selector for the SVG element (default: `.iso-canvas-wrap svg`).
 */
export function exportSVG(
  diagramName: string,
  selector = '.iso-canvas-wrap svg',
): void {
  const svgEl = document.querySelector(selector);
  if (!svgEl) return;

  const svgStr = getExportSVGString(svgEl);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${diagramName}.svg`;
  anchor.click();

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
): void {
  const svgEl = document.querySelector(selector);
  if (!svgEl) return;

  const svgStr = getExportSVGString(svgEl);
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

    ctx.scale(scale, scale);
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, nativeW, nativeH);
    ctx.drawImage(img, 0, 0, nativeW, nativeH);
    URL.revokeObjectURL(url);

    canvas.toBlob(blob => {
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = pngUrl;
      anchor.download = `${diagramName}.png`;
      anchor.click();
      URL.revokeObjectURL(pngUrl);
    }, 'image/png');
  };
  img.src = url;
}
