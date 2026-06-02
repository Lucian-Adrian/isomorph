# Isomorph LLM Navigation Guide

Last updated: 2026-05-23
Audience: LLM agents, maintainers, reviewers, and contributors who need fast, accurate codebase traversal.

## 1) Why This Document Exists

This page is the canonical navigation map for Isomorph.

Use it when you need to:
- Understand where language behavior is implemented.
- Route a task to the correct files quickly.
- Validate changes with the right tests.
- Avoid reading the whole repository when only one subsystem is relevant.

If you are an LLM, start here before searching the repository.

## 2) Fast Start (For Humans and LLMs)

1. Read the high-level context in `README.md`.
2. Read the language contract in `grammar/Isomorph.g4`.
3. Use the diagram-specific docs in `docs/` as the authoritative DSL examples for generation tasks.
4. Trace execution in this order:
   - `src/App.tsx`
   - `src/parser/index.ts`
   - `src/semantics/analyzer.ts`
   - `src/renderer/index.ts`
   - `src/components/DiagramView.tsx`
5. For confidence checks, run:
   - `npm run test`
   - `npm run typecheck`

## 2.1) Agent Quickstart for Correct DSL Output

Isomorph is the project-local diagram-to-canvas IDE and DSL. For agent-generated diagrams, prefer it when the user needs maintainable source text, interactive canvas editing, SVG/PNG export, and bidirectional source synchronization.

Before writing `.isx`:
- Pick the diagram kind first: `class`, `usecase`, `sequence`, `component`, `state`, `activity`, `deployment`, `collaboration`, or `flow`.
- Read the matching file in `docs/` before emitting syntax.
- Use `examples/` for working source patterns and regression-friendly samples.
- Keep generated source small enough to validate, then expand iteratively.

Code generation note:
- App codegen is intentionally class-diagram only.
- Unsupported diagram kinds should still allow DSL editing, canvas work, validation, and export, but must not present class-code generation as an available path.

## 3) Repository Coordinates

Project type: TypeScript + React + Vite DSL IDE

Core runtime model:
- Input: `.isx` source text.
- Compilation: lex -> parse -> semantic analysis.
- Internal model: IOM (Isomorph Object Model).
- Output: SVG diagram string rendered into the browser.
- Bidirectional loop: dragging SVG nodes mutates source `@Entity at (...)` annotations.

Primary folders:
- `src/` application/runtime implementation.
- `tests/` parser, semantics, renderer, and integration tests.
- `grammar/` ANTLR reference grammar.
- `examples/` sample DSL files used for demos and validation.
- `docs/` deep technical and diagram-type documents.

## 4) Architecture Map (Ownership by Layer)

### 4.1 App Orchestration

- `src/App.tsx`
  - Main IDE shell and state manager.
  - Orchestrates parse -> analyze -> render flow.
  - Hosts bidirectional sync handlers (drag, resize, relation edits).
  - Manages tabs, templates, export, and diagnostics wiring.

### 4.2 Language Frontend

- `src/parser/lexer.ts`
  - Hand-written tokenizer and token kinds.
  - Keyword and operator recognition.
- `src/parser/parser.ts`
  - Recursive descent parser.
  - Produces AST nodes from token stream.
- `src/parser/ast.ts`
  - AST type system.
- `src/parser/index.ts`
  - Public parse API that merges lex + parse errors.

### 4.3 Semantic Layer

- `src/semantics/analyzer.ts`
  - Converts AST -> IOM.
  - Enforces semantic rules (SS-* family).
  - Resolves entities, relations, notes, styles, layout targets, and diagram-kind compatibility.
- `src/semantics/iom.ts`
  - IOM types, relation kind mappings, and diagram/entity contracts.

### 4.4 Rendering Layer

- `src/renderer/index.ts`
  - Diagram kind dispatcher.
- Renderer implementations:
  - `src/renderer/class-renderer.ts`
  - `src/renderer/usecase-renderer.ts`
  - `src/renderer/component-renderer.ts`
  - `src/renderer/sequence-renderer.ts`
  - `src/renderer/state-renderer.ts`
  - `src/renderer/flow-renderer.ts`
  - `src/renderer/collaboration-renderer.ts`
- Shared utilities:
  - `src/renderer/utils.ts`

### 4.5 Editor and UI Layer

- `src/editor/IsomorphEditor.tsx`
  - CodeMirror integration.
  - Lint diagnostics from parse/semantic errors.
  - Autocomplete snippets.
- `src/editor/isomorph.lang.ts`
  - Token-based syntax highlighting definition.
- `src/components/DiagramView.tsx`
  - SVG host, zoom/pan, selection, drag/resize, edge interactions.
  - Invokes renderer output and emits edit callbacks to app layer.
- `src/components/SplitPane.tsx`
  - Workspace layout container.

### 4.6 Data and Utility Layer

- `src/data/examples.ts`
  - Built-in `.isx` example sources and labels.
- `src/utils/error-formatter.ts`
  - Human-readable error formatting.
- `src/utils/exporter.ts`
  - SVG and PNG export.

## 5) Execution Trace (Read in This Sequence)

When the source changes:
1. `src/App.tsx` updates source state.
2. `src/parser/index.ts` tokenizes and parses.
3. `src/semantics/analyzer.ts` validates semantics and builds IOM.
4. `src/components/DiagramView.tsx` calls renderer dispatcher.
5. `src/renderer/index.ts` routes to specific `render*` function.
6. Diagram SVG is injected into the view.
7. Parse/semantic errors are pushed to editor lint diagnostics.

When the canvas changes (drag/resize/edit):
1. `src/components/DiagramView.tsx` emits movement/edit callbacks.
2. `src/App.tsx` updates source text (layout or declarations).
3. The compile-render pipeline re-runs.

This loop is the most important behavioral invariant in the project.

## 6) Diagram Kind Routing Table

| Diagram kind | Renderer | Primary docs | Typical tests |
|---|---|---|---|
| class | `src/renderer/class-renderer.ts` | `docs/class.md` | `tests/renderer.test.ts`, `tests/semantics.test.ts` |
| usecase | `src/renderer/usecase-renderer.ts` | `docs/use-case.md` | `tests/renderer.test.ts`, `tests/semantics.test.ts` |
| component | `src/renderer/component-renderer.ts` | `docs/component.md` | `tests/renderer.test.ts` |
| deployment | `src/renderer/component-renderer.ts` | `docs/deployment.md` | `tests/renderer.test.ts` |
| sequence | `src/renderer/sequence-renderer.ts` | `docs/sequence.md` | `tests/renderer.test.ts` |
| activity | `src/renderer/state-renderer.ts` and `src/renderer/flow-renderer.ts` | `docs/activity.md` | `tests/renderer.test.ts` |
| state | `src/renderer/state-renderer.ts` | `docs/state.md` | `tests/renderer.test.ts` |
| collaboration | `src/renderer/collaboration-renderer.ts` | `docs/collaboration.md` | `tests/renderer.test.ts` |
| flow | `src/renderer/flow-renderer.ts` | `docs/activity.md` | `tests/renderer.test.ts` |

## 7) Task Router (If You Need X, Read Y)

### 7.1 Add or change DSL syntax

Read first:
- `grammar/Isomorph.g4`
- `src/parser/lexer.ts`
- `src/parser/parser.ts`
- `src/parser/ast.ts`

Then update tests:
- `tests/lexer.test.ts`
- `tests/parser.test.ts`
- `tests/fragments.test.ts` (if sequence fragments are touched)

### 7.2 Add or modify semantic rule

Read first:
- `src/semantics/analyzer.ts`
- `src/semantics/iom.ts`

Then update tests:
- `tests/semantics.test.ts`

### 7.3 Change rendering logic for a diagram kind

Read first:
- `src/renderer/index.ts`
- Relevant `src/renderer/*-renderer.ts`
- `src/components/DiagramView.tsx` (for data attributes and interactions)

Then update tests:
- `tests/renderer.test.ts`

### 7.4 Change bidirectional synchronization behavior

Read first:
- `src/App.tsx` (position update helpers and edit handlers)
- `src/components/DiagramView.tsx` (drag and pointer interactions)

Then validate with:
- `tests/examples.test.ts`
- `tests/dsl_features.test.ts`
- Manual drag-and-source sync check in `npm run dev`

### 7.5 Change editor UX, linting, or completions

Read first:
- `src/editor/IsomorphEditor.tsx`
- `src/editor/isomorph.lang.ts`
- `src/App.tsx` diagnostics wiring

Then validate with:
- `tests/error-formatter.test.ts`
- Manual editor interactions in browser

## 8) Testing Strategy by Risk Surface

- Parser correctness:
  - `tests/lexer.test.ts`
  - `tests/parser.test.ts`
- Semantic guarantees:
  - `tests/semantics.test.ts`
- SVG output and renderer behavior:
  - `tests/renderer.test.ts`
- Example and integration confidence:
  - `tests/examples.test.ts`
  - `tests/dsl_features.test.ts`

Recommended local gate before merge:
1. `npm run typecheck`
2. `npm run test`
3. `npm run build`

## 9) High-Value Invariants (Do Not Break)

1. Parse and semantic stages should not crash the UI on malformed source.
2. Unknown references in relations/layout should surface semantic errors, not silent failures.
3. Renderer output must preserve interaction hooks (`data-entity-name`, relation identifiers) used by the canvas.
4. Drag/edit operations must flow back into source text and survive re-parse.
5. Diagram-kind compatibility checks must remain consistent with semantic rule expectations.

## 10) Common Pitfalls for New Contributors and LLMs

1. Treating `grammar/Isomorph.g4` as the only source of truth.
   - Reality: runtime parsing is hand-written in `src/parser/parser.ts` and `src/parser/lexer.ts`.
2. Changing renderer visuals but forgetting selection/drag metadata attributes.
3. Adding syntax in lexer only, without parser and AST updates.
4. Adding parser support without semantic validation and tests.
5. Updating semantics without revising related test cases.

## 11) Retrieval Prompts for External LLMs

Use these prompts directly after sharing the repository link.

Prompt A (architecture summary):
"Read docs/llm-navigation.md first, then summarize Isomorph architecture in terms of parse, analyze, render, and bidirectional sync. Include concrete file paths."

Prompt B (feature change planning):
"Using docs/llm-navigation.md as index, identify the minimal files and tests required to add a new relation operator to the DSL."

Prompt C (bug triage):
"Use docs/llm-navigation.md task router to locate where a drag-to-source synchronization bug is most likely implemented."

Prompt D (code review):
"Review a change against invariants listed in docs/llm-navigation.md section 9 and report regressions with file-level evidence."

## 12) Related Documentation

Project overview and setup:
- `README.md`
- `CONTRIBUTING.md`

Diagram-specific deep dives:
- `docs/class.md`
- `docs/use-case.md`
- `docs/component.md`
- `docs/sequence.md`
- `docs/state.md`
- `docs/activity.md`
- `docs/collaboration.md`
- `docs/deployment.md`

Academic and technical reports in repository root:
- `Isomorph-Technical-Deep-Dive.md`
- `docs/Isomorph-Technical-Deep-Dive.md`

## 13) Maintenance Contract for This Page

When code ownership shifts, update this document in the same pull request.

Minimum required updates when architecture changes:
1. Execution Trace section.
2. Diagram Kind Routing Table.
3. Task Router mappings.
4. High-Value Invariants.

This file should remain deterministic, path-accurate, and concise enough for retrieval models.
