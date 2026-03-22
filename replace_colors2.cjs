const fs = require('fs');
const path = require('path');

const dir = 'src/renderer';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filepath = path.join(dir, file);
  let src = fs.readFileSync(filepath, 'utf8');

  src = src.replace(/fill="#f0f4ff"/gi, 'fill="var(--iso-pkg-bg)"');
  src = src.replace(/stroke="#b0c0e0"/gi, 'stroke="var(--iso-pkg-border)"');
  src = src.replace(/fill="#5566aa"/gi, 'fill="var(--iso-pkg-text)"');
  src = src.replace(/fill="#f8fafc"/gi, 'fill="var(--iso-bg-panel)"');
  src = src.replace(/stroke="#475569"/gi, 'stroke="var(--iso-text-muted)"');
  src = src.replace(/stroke="#64748b"/gi, 'stroke="var(--iso-text-muted)"');
  
  // also #8250df -> var(--iso-brand) maybe?
  src = src.replace(/stroke="#e2e8f0"/gi, 'stroke="var(--iso-divider)"');
  src = src.replace(/fill="#e2e8f0"/gi, 'fill="var(--iso-divider)"');
  src = src.replace(/fill="#94a3b8"/gi, 'fill="var(--iso-text-muted)"');

  fs.writeFileSync(filepath, src);
}
console.log('Done script 2');
