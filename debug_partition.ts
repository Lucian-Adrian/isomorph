import { parse } from './src/parser/index.js';
const source = 'diagram D : activity { partition Lane @Lane at (10, 20, 300, 500) }';
const { errors } = parse(source);
console.log(JSON.stringify(errors, null, 2));
