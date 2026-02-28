# Contributing to Isomorph

Thank you for your interest in contributing to Isomorph!

## Development Setup

```bash
git clone https://github.com/team02-faf241/isomorph.git
cd isomorph
npm install
npm run dev
```

## Project Structure

| Directory | Purpose |
|---|---|
| `src/parser/` | Lexer, parser, AST type definitions |
| `src/semantics/` | Static analyser (SS-1–SS-10) and IOM types |
| `src/renderer/` | SVG renderers (class, usecase, component) |
| `src/editor/` | CodeMirror integration |
| `src/components/` | React UI components |
| `tests/` | Vitest test suites |
| `grammar/` | ANTLR4 reference grammar (`.g4`) |
| `examples/` | Sample `.isx` source files |

## Commands

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run test         # Run all tests
npm run test:watch   # Watch mode
npm run typecheck    # TypeScript type checking
npm run build        # Production build
```

## Guidelines

1. **Tests first** — every new semantic rule must have at least one positive and one negative test.
2. **Type safety** — the project uses `strict: true`. No `any` types, no `@ts-ignore`.
3. **Pure functions** — the language pipeline (`lex → parse → analyze → render`) is stateless. No side effects in language modules.
4. **Commit messages** — use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `test:`, `docs:`.

## Adding a New Semantic Rule

1. Define the rule in `src/semantics/analyzer.ts` following the SS-N pattern.
2. Add tests in `tests/semantics.test.ts` (at least one accept + one reject case).
3. Document the rule in the grammar report (`5-grammar/grammar-report.tex`).
4. Run `npm test` to verify all 84+ tests pass.

## Adding a New Diagram Kind Renderer

1. Create `src/renderer/<kind>-renderer.ts` exporting `render<Kind>Diagram(diag: IOMDiagram): string`.
2. Register it in `src/renderer/index.ts`'s switch statement.
3. Add `data-entity-name` attributes to SVG `<g>` elements for drag support.
4. Add a sample `.isx` file in `examples/`.
