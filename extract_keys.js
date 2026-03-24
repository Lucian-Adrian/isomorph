const fs = require('fs');
const glob = require('glob');

const tsxFiles = glob.sync('src/**/*.tsx');
const regex = /t\((['"])(.*?)\1/g;
let strings = new Set();

tsxFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = regex.exec(content)) !== null) {
    strings.add(match[2]);
  }
});
console.log(JSON.stringify(Array.from(strings), null, 2));