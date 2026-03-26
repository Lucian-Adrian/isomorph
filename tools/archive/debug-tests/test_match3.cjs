const fs = require('fs');
const code = fs.readFileSync('isomorph/website/index.html', 'utf8');

const matches = [];
const regex = /data-i18n="([^"]+)"/g;
let m;
while ((m = regex.exec(code)) !== null) {
  matches.push(m[1]);
}
console.log(matches.join('\n'));
