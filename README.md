# Isomorph DSL — Bidirectional Text-Visual Diagramming

> **Team 02 — FAF-241** | Academic project, UTM Moldova

Isomorph is a domain-specific language for software architecture diagramming where the **text and the visual are always in sync**. Edit the code, the diagram updates. Drag a node, the code updates. Think PlantUML, but with a live bidirectional canvas.

---

## The Problem Isomorph Solves

Tools like PlantUML and Mermaid are code-first: the diagram is rendered from text, but you can never go the other way. Tools like draw.io are visual-first: you drag and drop, but the "source" is XML nobody reads. Isomorph collapses the gap — one source of truth, two editing surfaces.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.7 |
| Parser | Hand-crafted recursive descent (LL(1)) |
| Frontend | React 18 + Vite |
| Editor | CodeMirror 6 (syntax highlight, error squiggles) |
| Diagram canvas | D3.js v7 (SVG layout + drag-to-update) |
| Tests | Vitest |
| Grammar reference | ANTLR4 `.g4` in `grammar/` |

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Example

```isomorph
diagram LibrarySystem : class {

  package domain {

    abstract class Book <<Entity>> implements Borrowable {
      + title: string
      + isbn: string
      - stock: int = 0
      + checkOut(user: string): bool
      + getTitle(): string
    }

    class Library {
      + name: string
      + addBook(book: Book): void
      + search(query: string): List<Book>
    }

    interface Borrowable {
      + borrow(user: string): void
      + return(): void
    }

  }

  Library --* Book [label="contains", toMult="1..*"]
  Book ..|> Borrowable

  @Book at (100, 120)
  @Library at (380, 120)
  @Borrowable at (100, 380)

}
```

---

## Project Structure

```
repo/
├── grammar/
│   └── Isomorph.g4          # Formal ANTLR4 grammar (reference)
├── src/
│   ├── parser/
│   │   ├── ast.ts           # AST node types
│   │   ├── lexer.ts         # Tokenizer (66 token types)
│   │   ├── parser.ts        # Recursive descent parser (55 rules)
│   │   └── index.ts         # Public parse() API
│   ├── semantics/
│   │   ├── iom.ts           # Isomorph Object Model
│   │   └── analyzer.ts      # Static semantic checker
│   ├── renderer/
│   │   ├── class-renderer.ts
│   │   ├── usecase-renderer.ts
│   │   └── index.ts
│   ├── editor/
│   │   ├── IsomorphEditor.tsx
│   │   └── isomorph.lang.ts # CodeMirror language support
│   ├── components/
│   │   ├── DiagramView.tsx
│   │   └── SplitPane.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── tests/
│   ├── lexer.test.ts
│   ├── parser.test.ts
│   └── semantics.test.ts
├── examples/
│   ├── class-diagram.iso
│   ├── usecase-diagram.iso
│   └── component-diagram.iso
└── package.json
```

---

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run test         # Run all tests
npm run test:watch   # Watch mode
npm run typecheck    # Type-check without emitting
```

---

## Grammar Highlights

- **66 token types**: 22 keywords, 13 relation operators, 7 built-in types, literals
- **55 BNF production rules**: class/interface/enum/actor/usecase/component entities, full type expressions with generics, visibility modifiers
- **Layout persistence**: `@EntityName at (x, y)` annotations survive round-trips
- **LL(1) grammar**: no backtracking, O(n) parse time

---

## Team

| Name | Role |
|---|---|
| Lucian-Adrian Gavril | Lead / Technical Writer |
| Aurelian-Mihai Tihon | Language Engineer |
| Iulian Pavlov | Frontend / Canvas |
| Nichita Tcacenco | Backend / QA |

Mentor: **Fiștic Cristofor**
