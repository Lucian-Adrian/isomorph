const fs = require('fs');
const path = require('path');

const dir = 'src/renderer';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filepath = path.join(dir, file);
  let src = fs.readFileSync(filepath, 'utf8');

  src = src.replace(/fill="white"/g, 'fill="var(--iso-bg-panel)"');
  src = src.replace(/fill="#fff"/gi, 'fill="var(--iso-bg-panel)"');
  src = src.replace(/fill="#ffffff"/gi, 'fill="var(--iso-bg-panel)"');
  src = src.replace(/fill="#000"/gi, 'fill="var(--iso-text)"');
  src = src.replace(/fill="#000000"/gi, 'fill="var(--iso-text)"');
  src = src.replace(/fill="#0f172a"/gi, 'fill="var(--iso-text)"');
  src = src.replace(/fill="#334155"/gi, 'fill="var(--iso-text-body)"');
  src = src.replace(/fill="#333"/gi, 'fill="var(--iso-text)"');
  src = src.replace(/fill="#111"/gi, 'fill="var(--iso-text)"');
  src = src.replace(/fill="#555"/gi, 'fill="var(--iso-text-muted)"');
  src = src.replace(/fill="#666"/gi, 'fill="var(--iso-text-muted)"');
  src = src.replace(/fill="#64748b"/gi, 'fill="var(--iso-text-muted)"');
  src = src.replace(/stroke="#555"/gi, 'stroke="var(--iso-text-muted)"');
  src = src.replace(/stroke="#111"/gi, 'stroke="var(--iso-text)"');
  src = src.replace(/const color        = '#555';/g, "const color        = 'var(--iso-text-muted)';");
  src = src.replace(/const color = '#555';/g, "const color = 'var(--iso-text-muted)';");
  src = src.replace(/const color = '#333';/g, "const color = 'var(--iso-text)';");

  fs.writeFileSync(filepath, src);
}
console.log('Done replacement');
