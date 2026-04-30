const rx = /^(diagram\s+\S+\s*:\s*\S+\s*\{)(\n[\s\S]*?)(\n\s*\}\s*)$/m;

const sample = `diagram NewClassDiagram : class {
  class Entity {
    + id: string
    - newField : string
  }
  @Entity at (110, 63)
}`;

console.log('sample', !!sample.match(rx));

const sample3 = `diagram NewDiagram : class {

  class Entity {
    + id: string
    - newField : string
    + newMethod() : void
    + newField : string
  }

  @Entity at (110, 63)

}`;
console.log('sample3', !!sample3.match(rx));
