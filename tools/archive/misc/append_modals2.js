const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
const replacement = `
<ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
{/* Archived one-off modal injection template */}
`;
code = code.replace('<ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />', replacement);
fs.writeFileSync('src/App.tsx', code);
