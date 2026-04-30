const source = `diagram NewClassDiagram : class {
  Entity --> Another
}`;
const relRegex = /^(\s*)([A-Za-z_][\w]*)\s+(--\|>|\.\.\|>|<\|--|<\|\.\.|<\.\.|o--|\*--|-->|\.\.>|--o|--\*|--x|--)\s+([A-Za-z_][\w]*)(\s*\[[^\]]*\])?\s*$/gm;

for (const match of source.matchAll(relRegex)) {
  console.log('MATCH:', JSON.stringify(match[0]));
}