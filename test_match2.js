const s = `diagram NewClassDiagram : class {
  class Entity {
    + id: string
    - newField : string
  }
  @Entity at (110, 63)
}
`;

const rx = /^(diagram\s+\S+\s*:\s*\S+\s*\{)(\n[\s\S]*)(\n\s*\})\s*$/;
const diagramMatch = s.match(rx);
if (diagramMatch) {
  console.log('Match Found!');
  console.log('BODY:', diagramMatch[2]);
} else {
  console.log('No match');
}
