import { parse } from './src/parser/index.js';
const source = 'diagram D : class { @A at (10, 20, 30, 40) }';
const { errors } = parse(source);
console.log(JSON.stringify(errors, null, 2));
