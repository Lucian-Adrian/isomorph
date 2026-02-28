<div align="center">

# ✦ Isomorph

**A formally specified domain-specific language for software diagramming with bidirectional text–visual synchronisation.**

[![CI](https://github.com/team02-faf241/isomorph/actions/workflows/ci.yml/badge.svg)](https://github.com/team02-faf241/isomorph/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-84%20passing-brightgreen)](#testing)

[**Live Demo**](https://team02-faf241.github.io/isomorph/) · [Grammar Spec](grammar/Isomorph.g4) · [Examples](examples/) · [Contributing](CONTRIBUTING.md)

</div>

---

## What is Isomorph?

**Isomorph** is a DSL where the source code *is* the diagram and the diagram *is* the source code. Write structured text on the left, see a live-rendered UML diagram on the right. Drag an entity on the canvas and the source code updates itself — `@Entity at (x, y)` annotations keep text and layout in perfect sync.

```
┌────────────────┐  lex   ┌──────────┐ parse  ┌─────┐ analyze ┌─────┐ render ┌─────┐
│  .isx source   │──────▸ │ Token[]  │──────▸ │ AST │──────▸  │ IOM │──────▸ │ SVG │
└────────────────┘        └──────────┘        └─────┘         └─────┘        └─────┘
        ▲                                                                       │
        └───────── @Entity at (x, y) ◂── drag-to-update ◂──────────────────────┘
```

### Why not Mermaid / PlantUML / draw.io?

| Feature | Isomorph | Mermaid | PlantUML | draw.io |
|---|:---:|:---:|:---:|:---:|
| Formal BNF grammar | ✓ | ~ | ~ | ✗ |
| 10 static semantic rules | ✓ | ✗ | ✗ | ✗ |
| Bidirectional sync (canvas ↔ code) | ✓ | ✗ | ✗ | ~ |
| Layout stored in source text | ✓ | ✗ | ✗ | ✓ |
| Version-control friendly | ✓ | ✓ | ✓ | ✗ |
| Visual drag-and-drop editing | ✓ | ✗ | ✗ | ✓ |
| Zero-dependency compiler | ✓ | ✗ | ✗ | ✗ |
| Circular inheritance detection | ✓ | ✗ | ✗ | ✗ |

---

## Quick Start

```bash
git clone https://github.com/team02-faf241/isomorph.git
cd isomorph
npm install
npm run dev
```

Open **http://localhost:5173** — the editor loads with a sample diagram.

---

## Example: `.isx` Source

```isomorph
diagram Library : class {

  abstract class Book <<Entity>> implements Borrowable {
    + title : string
    + isbn  : string
    - stock : int = 0
    + checkOut(user: string) : bool
  }

  class Library {
    + name : string
    + addBook(book: Book) : void
    + search(query: string) : List<Book>
  }

  interface Borrowable {
    + borrow(user: string) : void
    + return() : void
  }

  enum BookStatus {
    AVAILABLE
    CHECKED_OUT
    RESERVED
  }

  Library --* Book [label="contains", toMult="1..*"]
  Book ..|> Borrowable

  // Bidirectional layout annotations — written by the sync engine
  @Book       at (100, 130)
  @Library    at (400, 130)
  @Borrowable at (100, 360)
  @BookStatus at (400, 360)
}
```

---

## Architecture

```
repo/
├── grammar/
│   └── Isomorph.g4              # ANTLR4 reference grammar (328 lines)
├── src/
│   ├── parser/
│   │   ├── ast.ts               # 22 AST node types with Span tracking
│   │   ├── lexer.ts             # Hand-crafted tokenizer (66 token kinds)
│   │   ├── parser.ts            # Recursive descent LL(1) parser (55 rules)
│   │   └── index.ts             # Public parse() API
│   ├── semantics/
│   │   ├── iom.ts               # Isomorph Object Model type definitions
│   │   └── analyzer.ts          # Static semantic checker (SS-1 – SS-10)
│   ├── renderer/
│   │   ├── class-renderer.ts    # UML class diagram → SVG
│   │   ├── usecase-renderer.ts  # Use-case diagram → SVG
│   │   └── index.ts             # Diagram kind dispatcher
│   ├── editor/
│   │   ├── IsomorphEditor.tsx   # CodeMirror 6 React wrapper
│   │   └── isomorph.lang.ts     # Syntax highlighting definition
│   ├── components/
│   │   ├── DiagramView.tsx      # SVG canvas + zoom + drag handlers
│   │   └── SplitPane.tsx        # Accessible resizable split layout
│   ├── App.tsx                  # Main IDE shell
│   ├── main.tsx                 # React root
│   └── index.css                # Design system (CSS custom properties)
├── tests/
│   ├── lexer.test.ts            # 24 tests
│   ├── parser.test.ts           # 28 tests
│   └── semantics.test.ts        # 32 tests — covers SS-1 through SS-10
├── examples/
│   ├── class-diagram.isx
│   ├── usecase-diagram.isx
│   └── component-diagram.isx
├── .github/workflows/ci.yml     # CI: test + deploy to GitHub Pages
├── package.json
├── tsconfig.json
├── vite.config.ts
├── LICENSE                       # MIT
└── CONTRIBUTING.md
```

---

## Language Design

### Grammar

Isomorph is defined by a **core BNF grammar** with **55 production rules** and **66 token kinds**. EBNF is used as syntactic sugar for documentation and tooling — the language is formally unambiguous.

**Key constructs:**
- `diagram Name : kind { ... }` — six diagram kinds: `class`, `usecase`, `sequence`, `component`, `flow`, `deployment`
- Entity declarations: `class`, `interface`, `enum`, `actor`, `usecase`, `component`, `node`
- Members: fields with typed visibility (`+ name : string`), methods with params, enum values
- Relations: 13 operators (`--|>`, `..|>`, `-->`, `--*`, `--o`, `--x`, `..>`, `--`, and their reverses)
- Layout anchors: `@Entity at (x, y)` — the bidirectional sync mechanism
- Packages, notes, styles, stereotypes, generics, nullable types

### Static Semantics (SS-1 – SS-10)

Every Isomorph program is validated against **10 named semantic rules** before rendering. Each violation produces a structured `SemanticError` with the rule identifier:

| Rule | Constraint | What It Prevents |
|---|---|---|
| **SS-1** | Entity name uniqueness | Two classes with the same name |
| **SS-2** | Member name uniqueness | Duplicate fields/methods in one class |
| **SS-3** | Relation endpoint resolution | Arrows pointing to undefined entities |
| **SS-4** | Enum non-emptiness | `enum Status {}` with no values |
| **SS-5** | Interface field constraints | Default values in interfaces |
| **SS-6** | Acyclic inheritance | `class A extends B {} class B extends A {}` |
| **SS-7** | Style target validity | Styling an entity that doesn't exist |
| **SS-8** | Enum value uniqueness | Duplicate values inside an enum |
| **SS-9** | Diagram kind compatibility | `actor` inside a `class` diagram |
| **SS-10** | Layout reference validity | `@Ghost at (10, 20)` with no entity `Ghost` |

### Translational Semantics

The meaning of an Isomorph program is defined by its translation into the **Isomorph Object Model (IOM)** — a typed intermediate representation that serves as the single interface between the analyser and the renderers.

```
source → lex() → Token[] → parse() → AST → analyze() → IOM → render() → SVG
```

Every function in the pipeline is **total** (never throws) and **pure** (returns errors as values).

---

## Technology Stack

| Concern | Technology | Version |
|---|---|---|
| Language | TypeScript (strict mode) | 5.7 |
| Bundler | Vite | 6.x |
| UI Framework | React | 18.x |
| Code Editor | CodeMirror | 6.x |
| Diagram Renderer | Pure SVG (template-based, zero external deps) | — |
| Grammar Reference | ANTLR4 (`.g4`) | 4.x |
| Test Runner | Vitest + jsdom | 2.x |
| CI/CD | GitHub Actions → GitHub Pages | — |

---

## Testing

**84 tests** across three suites, all passing:

```bash
npm test
```

| Suite | Tests | Coverage |
|---|---|---|
| `lexer.test.ts` | 24 | Keywords, operators, literals, comments, error recovery |
| `parser.test.ts` | 28 | All entity kinds, relations, types, generics, layout |
| `semantics.test.ts` | 32 | SS-1 through SS-10, IOM construction, type normalisation |

---

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build (typecheck + bundle)
npm run test         # Run all 84 tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
npm run typecheck    # tsc --noEmit
```

---

## Design Decisions

1. **Hand-written parser** — demonstrates understanding of parsing theory; zero runtime dependencies; full control over error recovery and diagnostics.
2. **Bidirectional layout** — `@Entity at (x, y)` annotations are first-class grammar citizens, not JSON metadata. This ensures the source text is always the canonical representation.
3. **Strict separation** — Language (grammar + AST + IOM), Editor (CodeMirror + React), and AI (optional LLM translator) are independent layers. The language is fully specified without the UI.
4. **Pure SVG output** — renderers produce SVG via template strings with XML escaping. No external rendering library required.
5. **`.isx` file extension** — avoids collision with `.iso` (disk image); mirrors `.tsx` convention for typed source files.

---

## Team

| Name | Role |
|---|---|
| Lucian-Adrian Gavril | Lead / Technical Writer |
| Aurelian-Mihai Tihon | Language Engineer |
| Iulian Pavlov | Frontend / Canvas |
| Nichita Tcacenco | Backend / QA |

**Mentor:** Fiștic Cristofor  
**Institution:** Technical University of Moldova — FAF-241  
**License:** [MIT](LICENSE)
