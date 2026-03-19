# ✦ Isomorph

**A formally specified domain-specific language for software diagramming with bidirectional text–visual synchronisation and strict pedagogical validation.**

[](https://github.com/team02-faf241/isomorph/actions/workflows/ci.yml)
[](https://www.google.com/search?q=LICENSE)
[](https://www.typescriptlang.org/)
[](https://www.google.com/search?q=https://reactjs.org/)
[](https://www.google.com/search?q=%23testing)

[**Live Demo**](https://lucian-adrian.github.io/isomorph/) · [Grammar Spec](grammar/Isomorph.g4) · [Examples](examples/) · [Contributing](CONTRIBUTING.md)

-----

## What is Isomorph?

**Isomorph** is a robust DSL where the source code *is* the diagram and the diagram *is* the source code. Write structured text on the left, and see a live-rendered UML diagram on the right. If you drag an entity on the canvas, the source code updates itself via `@Entity at (x, y)` annotations that keep text and layout in perfect sync.

Unlike general-purpose tools, Isomorph acts as a **strict pedagogical compiler**. It is specifically engineered to bridge a constrained educational subset of UML (the "Teacher's Core") with the robust industrial standards of OMG UML 2.5.1. If an architectural design violates core academic rules, Isomorph will throw a compile-time error—ensuring models are "Correct by Construction".

```text
┌────────────────┐  lex   ┌──────────┐ parse  ┌─────┐ analyze ┌─────┐ render ┌─────┐
│  .isx source   │──────▸ │ Token[]  │──────▸ │ AST │──────▸  │ IOM │──────▸ │ SVG │
└────────────────┘        └──────────┘        └─────┘         └─────┘        └─────┘
        ▲                                                                       │
        └───────── @Entity at (x, y) ◂── drag-to-update ◂──────────────────────┘
```

### Why Isomorph? (Feature Comparison)

| Feature | Isomorph | Mermaid | PlantUML | draw.io |
|---|:---:|:---:|:---:|:---:|
| **Bidirectional sync (canvas ↔ code)** | ✓ | ✗ | ✗ | \~ |
| **Pedagogical Rule Linting** | ✓ | ✗ | ✗ | ✗ |
| **Formal BNF grammar** | ✓ | \~ | \~ | ✗ |
| **Strict Topological Validation** | ✓ | ✗ | ✗ | ✗ |
| **Layout stored directly in source text** | ✓ | ✗ | ✗ | ✓ |
| **Zero-dependency React/Vite compiler** | ✓ | ✗ | ✗ | ✗ |

-----

## The "Teacher's Core" Compiler Specifications

Isomorph implements a "Core + Extension" architecture. The Core module enforces strict educational constraints as hard validation errors, while the Extension module fills semantic gaps with UML 2.5.1 standards.

### ClassModel Validation Rules

  * **Noun Constraint:** The name of a class must always be a noun.
  * **Interface Prefix:** The name of an interface must always begin with the letter 'I' (e.g., `IBancomat`). Failing to do so triggers a Critical Error.
  * **3-Class Generalization:** Generalization hierarchies should involve at least 3 classes to properly demonstrate polymorphism; otherwise, a warning is emitted.
  * **Implicit Multiplicity:** When multiplicity is 1 to 1, it is implicitly understood and will automatically be hidden by the renderer to keep diagrams clean.

### Component Modeling (UCML) Rules

  * **Strict Realization Topology:** Realization is always used exclusively to connect a Component to an Interface. Connecting two components with a Realization link will cause a hard Compile Error.
  * **Mandatory Stereotypes:** Natively supports standard structural components like `<<library>>` (.dll), `<table>` (.db), `<<file>>`, `<<document>>`, and `<<executable>>`.
  * **Advanced Ports:** Implements UML 2.5.1 Ports (`provided`, `required`) and strict differentiation between Assembly and Delegation connectors.

-----

## Quick Start

Isomorph is built on a modern Vite and React 18 stack.

```bash
git clone https://github.com/team02-faf241/isomorph.git
cd isomorph
npm install
npm run dev
```

Open **http://localhost:5173** — the CodeMirror 6 editor loads with a sample diagram and syntax highlighting enabled.

-----

## Example: Valid `.isx` Source

Below is a compliant example demonstrating Isomorph's syntax and strict adherence to the Teacher's Core rules:

```isomorph
diagram BankingSystem : component {

  // Rule TC-02: Interfaces MUST start with 'I'
  interface ICardReader {
    + readStrip() : String
    + ejectCard() : void
  }

  interface IBankNetwork {
    + authorizeTransaction(id: String, amount: float) : boolean
  }

  // Nouns used for Components. Mandatory stereotypes applied.
  component ATMTerminal <<executable>> {
    property isIndirectlyInstantiated = false
    
    // UML 2.5 Ports
    port cardSlot : ICardReader provided
    port uplink : IBankNetwork required
  }

  component BankServer <<table>> {
    - connectionString : String
  }

  // Rule TC-03: Realization STRICTLY connects Component -> Interface
  ATMTerminal realizes ICardReader
  
  // Dependency between Components
  ATMTerminal depends BankServer

  // Bidirectional layout annotations — written by the sync engine
  @ATMTerminal at (100, 150)
  @BankServer  at (400, 150)
}
```

-----

## Architecture & Technology Stack

The meaning of an Isomorph program is defined by its translation into the **Isomorph Object Model (IOM)** — a typed intermediate representation connecting the analyzer to the pure SVG renderers. Every function in the pipeline is **total** (never throws) and **pure** (returns errors as values).

| Concern | Technology | Version |
|---|---|---|
| **Language** | TypeScript (strict mode) | 5.7 |
| **Bundler** | Vite | 6.x |
| **UI Framework** | React | 18.x |
| **Code Editor** | CodeMirror | 6.x |
| **Diagram Renderer** | Pure SVG (template-based, zero external deps) | — |
| **Test Runner** | Vitest + jsdom | 2.x |

-----

## Testing

Isomorph maintains **84 passing tests** covering everything from the hand-crafted lexer to the static semantic analyzer.

```bash
npm run test          # Run all 84 tests
npm run test:coverage # Generate a coverage report
npm run build         # Production build (typecheck + bundle)
```

**License:** [MIT](https://www.google.com/search?q=LICENSE)