const fs = require('fs');
const path = require('path');

const dir = 'src/renderer';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filepath = path.join(dir, file);
  let src = fs.readFileSync(filepath, 'utf8');

  // Interface bg
  src = src.replace(/fill="#dcfce7"/gi, 'fill="var(--iso-bg-green, #dcfce7)"');
  src = src.replace(/fill="#bbf7d0"/gi, 'fill="var(--iso-bg-green, #bbf7d0)"');
  
  // Component / Entity bg
  src = src.replace(/fill="#f0f9ff"/gi, 'fill="var(--iso-bg-blue, #f0f9ff)"');
  
  // Abstract / Node bg
  src = src.replace(/fill="#fdf4ff"/gi, 'fill="var(--iso-bg-purple, #fdf4ff)"');
  
  // Enum / Note bg
  src = src.replace(/fill="#fef3c7"/gi, 'fill="var(--iso-bg-orange, #fef3c7)"');
  src = src.replace(/fill="#fffbed"/gi, 'fill="var(--iso-bg-orange, #fffbed)"');
  
  // Any leftover dark grays
  src = src.replace(/fill="#475569"/gi, 'fill="var(--iso-text-muted)"');
  src = src.replace(/fill="#1e293b"/gi, 'fill="var(--iso-text)"');

  // SVG root backgrounds or rects? We replaced white.
  // ensure we save
  fs.writeFileSync(filepath, src);
}
console.log('Done script 3');
