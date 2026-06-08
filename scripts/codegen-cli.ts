import fs from 'node:fs';
import path from 'node:path';
import { parse } from '../src/parser/index.js';
import { analyze } from '../src/semantics/analyzer.js';
import { generateCodeBundle } from '../src/codegen/index.js';

function printUsage() {
  console.log(`
Usage:
  npx tsx scripts/codegen-cli.ts <path-to-isx-file> [--lang python|java] [--out <output-dir>] [--diagram <diagram-name>]

Options:
  --lang      Language for code generation: 'python' or 'java' (default: 'python')
  --out       Directory where output files will be written. If not provided, prints to stdout.
  --diagram   Specify diagram name when multiple diagrams exist in the source file.
`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  let isxPath: string | null = null;
  let lang: 'python' | 'java' = 'python';
  let outDir: string | null = null;
  let diagramNameOpt: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--lang') {
      const next = args[++i];
      if (next === 'python' || next === 'java') {
        lang = next;
      } else {
        console.error(`Error: Invalid language: ${next}. Supported: python, java`);
        process.exit(1);
      }
    } else if (arg === '--out') {
      outDir = args[++i];
    } else if (arg === '--diagram') {
      diagramNameOpt = args[++i];
    } else if (arg.startsWith('--')) {
      console.error(`Error: Unknown option: ${arg}`);
      printUsage();
      process.exit(1);
    } else {
      isxPath = arg;
    }
  }

  if (!isxPath) {
    console.error('Error: Missing input .isx file path.');
    printUsage();
    process.exit(1);
  }

  if (!fs.existsSync(isxPath)) {
    console.error(`Error: File not found: ${isxPath}`);
    process.exit(1);
  }

  const source = fs.readFileSync(isxPath, 'utf8');

  // Parse
  const { program, errors: parseErrors } = parse(source);
  if (parseErrors.length > 0) {
    console.error('Parsing errors:');
    for (const err of parseErrors) {
      console.error(`  Line ${err.line}, col ${err.column}: ${err.message}`);
    }
    process.exit(1);
  }

  // Analyze
  const { iom, errors: analyzeErrors } = analyze(program);
  if (analyzeErrors.length > 0) {
    console.error('Semantic analysis errors:');
    for (const err of analyzeErrors) {
      console.error(`  ${err.message}`);
    }
    process.exit(1);
  }

  if (iom.diagrams.length === 0) {
    console.error('Error: No diagram found in .isx file.');
    process.exit(1);
  }

  let diagram = iom.diagrams[0];
  if (diagramNameOpt) {
    const found = iom.diagrams.find(d => d.name === diagramNameOpt);
    if (!found) {
      console.error(`Error: Diagram named "${diagramNameOpt}" not found in the input file.`);
      process.exit(1);
    }
    diagram = found;
  } else if (iom.diagrams.length > 1) {
    console.warn(`Warning: Multiple diagrams found in file. Using the first one: "${diagram.name}". Use --diagram <name> to select a different one.`);
  }

  const bundle = generateCodeBundle(diagram, { language: lang });

  if (outDir) {
    const resolvedOut = path.resolve(outDir);
    fs.mkdirSync(resolvedOut, { recursive: true });
    for (const file of bundle.files) {
      const filePath = path.join(resolvedOut, file.path);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, file.contents, 'utf8');
      console.log(`Generated: ${filePath}`);
    }
  } else {
    // Print to stdout
    for (const file of bundle.files) {
      console.log(`\n--- File: ${file.path} ---`);
      console.log(file.contents);
    }
  }
}

main();
