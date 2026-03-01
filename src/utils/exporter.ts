// ============================================================
// DiagramExporter — SVG and PNG export utilities (SRP)
// ============================================================
// Extracted from App.tsx to follow Single Responsibility Principle.
// Each function handles one export format independently.
// ============================================================

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

  const svgStr = new XMLSerializer().serializeToString(svgEl);
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

  const svgStr = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
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
