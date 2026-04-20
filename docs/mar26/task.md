# 🚀 Isomorph — Overachieve Execution Plan

> **Goal:** Transform Isomorph from a solid class-diagram DSL into a **mature, multi-diagram UML platform** that exceeds expectations across grammar, parsing, semantics, rendering, testing, and documentation — all within a structured Git workflow.

---

## Table of Contents

- [Git Workflow & Branch Strategy](#git-workflow--branch-strategy)
- [Current State Assessment](#current-state-assessment)
- [Phase 1 — Foundation & Grammar Evolution](#phase-1--foundation--grammar-evolution-priority-critical)
- [Phase 2 — Sequence Diagram Overhaul](#phase-2--sequence-diagram-overhaul-priority-highest)
- [Phase 3 — State & Activity Diagram Maturity](#phase-3--state--activity-diagram-maturity-priority-high)
- [Phase 4 — Component & Deployment Diagrams](#phase-4--component--deployment-diagrams-priority-high)
- [Phase 5 — Use Case & Collaboration Polish](#phase-5--use-case--collaboration-polish-priority-medium-high)
- [Phase 6 — Class Diagram Refinements](#phase-6--class-diagram-refinements-priority-medium)
- [Phase 7 — Layout Engine & Auto-Layout](#phase-7--layout-engine--auto-layout-priority-high)
- [Phase 8 — Testing Blitz](#phase-8--testing-blitz-priority-critical)
- [Phase 9 — Documentation, Parity & Examples](#phase-9--documentation-parity--examples-priority-critical)
- [Phase 10 — UI/UX & Editor Enhancements](#phase-10--uiux--editor-enhancements-priority-medium)
- [Phase 11 — Website, Demo & Presentation](#phase-11--website-demo--presentation-priority-medium)
- [Sprint Calendar](#sprint-calendar)
- [Definition of Done](#definition-of-done)
- [Risk Mitigation](#risk-mitigation)

---

## Git Workflow & Branch Strategy

### Setup (run once)

```bash
cd d:\uni\year2\dslpbl\repo
git fetch --all
git checkout master            # or main — whichever is the primary branch
git pull origin master
git checkout -b dev            # create dev branch from latest master
git push -u origin dev
```

### Branch naming convention

| Prefix      | Purpose               | Example                          |
| ----------- | --------------------- | -------------------------------- |
| `feature/`  | New functionality     | `feature/sequence-fragments`     |
| `fix/`      | Bug fixes             | `fix/parser-stereo-close`        |
| `refactor/` | Code reorganization   | `refactor/renderer-shared-utils` |
| `test/`     | Test additions only   | `test/state-diagram-coverage`    |
| `docs/`     | Documentation changes | `docs/sequence-spec-parity`      |
| `chore/`    | Build, config changes | `chore/ci-coverage-badge`        |

### Feature development flow

```
master ← dev ← feature/xyz
```

```bash
# 1. Start feature
git checkout dev
git pull origin dev
git checkout -b feature/sequence-fragments

# 2. Develop (commit often with conventional commits)
git add -A
git commit -m "feat(parser): add alt/else/end fragment parsing"
git commit -m "feat(renderer): render sequence fragments with boxes"
git commit -m "test(sequence): fragment balance validation tests"

# 3. Push and create PR to dev
git push -u origin feature/sequence-fragments
# Create PR: feature/sequence-fragments → dev (on GitHub)
# PR must pass: ✅ npm test  ✅ npm run typecheck  ✅ Code review

# 4. After PR merge into dev (squash merge)
git checkout dev
git pull origin dev

# 5. After sprint — merge dev → master (release)
git checkout master
git pull origin master
git merge dev
git push origin master
git tag v1.1.0
git push --tags
```

### Commit message format (Conventional Commits)

```
<type>(<scope>): <description>

feat(parser): add alt/else/end fragment parsing
fix(renderer): correct arrow direction in reversed relations
test(semantics): add SS-15 composite state validation
docs(sequence): align spec with implemented fragment support
refactor(renderer): extract shared SVG utils into base module
chore(ci): add typecheck step to GitHub Actions
```

---

## Current State Assessment

### What exists and works ✅

| Component                             | Status       | LOC      | Quality                                    |
| ------------------------------------- | ------------ | -------- | ------------------------------------------ |
| **Lexer** (`lexer.ts`)                | ✅ Solid      | ~350     | 66 token types, hand-crafted, fast         |
| **Parser** (`parser.ts`)              | ✅ Good       | ~550     | LL(1) recursive descent, 22 AST constructs |
| **AST** (`ast.ts`)                    | ✅ Complete   | ~210     | Rich type system with spans                |
| **Semantic Analyzer** (`analyzer.ts`) | ✅ Strong     | ~480     | 14 rules (SS-1 to SS-14)                   |
| **IOM** (`iom.ts`)                    | ✅ Clean      | ~148     | Well-typed intermediate representation     |
| **Class Renderer**                    | ✅ Best       | ~420     | Full UML class diagram rendering           |
| **Sequence Renderer**                 | ⚠️ Basic      | ~166     | Messages + lifelines, no fragments         |
| **State Renderer**                    | ⚠️ Basic      | ~171     | Flat nodes, no composite/nesting           |
| **Flow Renderer**                     | ⚠️ Basic      | ~161     | Simple grid, no swimlanes                  |
| **Component Renderer**                | ⚠️ Basic      | ~270     | No ports/interfaces/lollipops              |
| **Use Case Renderer**                 | ⚠️ Basic      | ~190     | No system boundary, no include/extend      |
| **Collaboration Renderer**            | ⚠️ Basic      | ~150     | No numbered messages                       |
| **Deployment Renderer**               | ❌ Missing    | N/A      | "To Be Extracted" in README                |
| **Editor**                            | ✅ Good       | ~470     | CodeMirror 6 with syntax highlighting      |
| **Tests**                             | ✅ Solid base | 84 tests | Lexer 24, Parser 28, Semantics 32          |
| **Examples**                          | ⚠️ Limited    | 3 files  | Only class, component, usecase             |

### What's missing ❌

2. **No deployment renderer** — marked "To Be Extracted"
3. **No sequence fragments** (alt/else/end, loop, opt, par, break, critical)
4. **No composite states** in state diagrams
5. **No swimlanes/partitions** in activity diagrams
6. **No ports/interfaces** in component diagrams
7. **No system boundary** in use case diagrams
8. **No numbered messages** in collaboration diagrams
9. **No title/legend/config** statement layer in grammar
10. **No diagram-specific semantic validation** beyond generic SS rules
11. **Major docs ↔ implementation parity gap**
13. **No renderer tests** beyond basic smoke test
14. **No integration/e2e tests**

---

## Phase 1 — Foundation & Grammar Evolution (Priority: CRITICAL)

> **Branch:** `feature/grammar-statement-layer`  

### 1.1 Add title/subtitle/config statements to reference grammar, modify real grammar

**File:** `grammar/Isomorph.g4`

Add to `bodyItem`:
```antlr
bodyItem
    : packageDecl
    | entityDecl
    | relationDecl
    | noteDecl
    | styleDecl
    | layoutAnnotation
    | configDecl          // NEW
    ;

configDecl
    : KW_TITLE STRING
    | KW_SUBTITLE STRING
    | KW_LEGEND STRING
    | KW_DIRECTION directionKind
    | KW_STRICT
    | KW_AUTONUMBER
    ;

directionKind
    : 'LR' | 'RL' | 'TB' | 'BT'
    ;
```

**New keywords to add:**
- `title`, `subtitle`, `legend`, `direction`, `strict`, `autonumber`, `caption`

### 1.2 Extend AST types

**File:** `src/parser/ast.ts`

```typescript
// Add to BodyItem union type:
export type BodyItem =
  | PackageDecl | EntityDecl | RelationDecl | NoteDecl
  | StyleDecl | LayoutAnnotation
  | ConfigDecl           // NEW
  | FragmentDecl;        // NEW (Phase 2)

// New AST node:
export interface ConfigDecl {
  kind: 'ConfigDecl';
  key: 'title' | 'subtitle' | 'legend' | 'direction' | 'strict' | 'autonumber';
  value: string;
  span: Span;
}
```

### 1.3 Update lexer and parser

**Files:** `src/parser/lexer.ts`, `src/parser/parser.ts`

- Add new keyword tokens: `title`, `subtitle`, `legend`, `direction`, `strict`, `autonumber`
- Add `parseConfigDecl()` method to parser
- Handle config propagation into IOM

### 1.4 Update IOM to carry config

**File:** `src/semantics/iom.ts`

```typescript
export interface IOMDiagram {
  name: string;
  kind: DiagramKind;
  entities: Map<string, IOMEntity>;
  relations: IOMRelation[];
  packages: IOMPackage[];
  notes: IOMNote[];
  config: IOMConfig;     // NEW
}

export interface IOMConfig {
  title?: string;
  subtitle?: string;
  legend?: string;
  direction?: 'LR' | 'RL' | 'TB' | 'BT';
  strict?: boolean;
  autonumber?: boolean;
}
```

### 1.5 Render title/subtitle in all renderers

- Add a shared `renderDiagramHeader(config: IOMConfig): string` utility in `renderer/utils.ts`
- Call it at the top of every `render*Diagram()` function

### Tasks checklist:

- [ ] Add new keywords to `Isomorph.g4`
- [ ] Add `ConfigDecl` to `ast.ts`
- [ ] Add new tokens to `lexer.ts`
- [ ] Add `parseConfigDecl()` to `parser.ts`
- [ ] Add `IOMConfig` to `iom.ts`
- [ ] Wire config through `analyzer.ts`
- [ ] Add `renderDiagramHeader()` to `renderer/utils.ts`
- [ ] Integrate header into all 8 renderers
- [ ] Write 6+ tests for config parsing
- [ ] Write 4+ tests for config rendering
- [ ] Update `Isomorph.g4` formal spec

---

## Phase 2 — Sequence Diagram Overhaul (Priority: HIGHEST)

> **Branch:** `feature/sequence-fragments`  
> **Why highest:** Sequence diagram DSLs are judged harshest by users — Mermaid and PlantUML set the bar

### 2.1 Add fragment syntax to grammar

**New grammar productions:**

```antlr
// In bodyItem, add:
| fragmentDecl

fragmentDecl
    : KW_ALT guardExpr LBRACE sequenceBody RBRACE
      ( KW_ELSE guardExpr? LBRACE sequenceBody RBRACE )*
    | KW_LOOP guardExpr LBRACE sequenceBody RBRACE
    | KW_OPT guardExpr LBRACE sequenceBody RBRACE
    | KW_PAR LBRACE sequenceBody RBRACE
    | KW_BREAK guardExpr LBRACE sequenceBody RBRACE
    | KW_CRITICAL LBRACE sequenceBody RBRACE
    | KW_REF STRING
    ;

guardExpr
    : STRING    // "[x > 0]"
    ;

sequenceBody
    : ( entityDecl | relationDecl | fragmentDecl | noteDecl )*
    ;
```

**New keywords:** `alt`, `else`, `loop`, `opt`, `par`, `break`, `critical`, `ref`, `activate`, `deactivate`, `return`, `create`, `destroy`

### 2.2 AST nodes for fragments

```typescript
export interface FragmentDecl {
  kind: 'FragmentDecl';
  fragmentType: 'alt' | 'loop' | 'opt' | 'par' | 'break' | 'critical' | 'ref';
  guard?: string;
  body: BodyItem[];
  elseBlocks?: { guard?: string; body: BodyItem[] }[];
  span: Span;
}
```

### 2.3 Sequence-specific semantic rules

| Rule      | Description                                                   |
| --------- | ------------------------------------------------------------- |
| **SS-15** | Fragment must contain at least one message                    |
| **SS-16** | `alt` must have at least one `else` alternative               |
| **SS-17** | `activate`, `deactivate`, `create`, `destroy` must reference declared participant |
| **SS-32** | Sequence diagrams support only synchronous, asynchronous and response relations |
| **SS-33** | Sequence call/response context matching constraints           |

### 2.4 Enhanced sequence renderer

The renderer must draw:

- **Fragment boxes** — labeled rounded rectangles (`alt`, `loop`, `opt`, `par`, `break`, `critical`)
- **Fragment headers** — pentagon tag in top-left corner with fragment type
- **Guard conditions** — bracketed text `[x > 0]` inside fragments
- **`else` dividers** — dashed horizontal lines within `alt` blocks
- **Activation bars** — narrow rectangles on lifelines during active call
- **Self-messages** — loop-back arrows (already partially implemented)
- **Return messages** — dashed arrows going back
- **Create messages** — arrow pointing to participant box (drawn at message Y)
- **Destroy messages** — X marker on lifeline
- **Autonumbering** — sequential numbers on messages `1:`, `2:`, `3:`

### Tasks checklist:

- [ ] Add fragment keywords to lexer
- [ ] Add `fragmentDecl` parsing with recursive nesting
- [ ] Add `FragmentDecl` AST node
- [ ] Add fragment IOM representation
- [ ] Implement SS-15, SS-16, SS-17, SS-32, SS-33
- [ ] Rewrite `sequence-renderer.ts` with fragment rendering
- [ ] Add activation bar rendering
- [ ] Add return message rendering (dashed)
- [ ] Add create/destroy visualization
- [ ] Add autonumber support
- [ ] Write 15+ parser tests for fragments
- [ ] Write 10+ semantic tests for SS-15, SS-16, SS-17, SS-32, SS-33
- [ ] Write 5+ renderer tests
- [ ] Create `examples/sequence-diagram.isx` with rich fragments
- [ ] Update `docs/sequence.md` to match implementation

---

## Phase 3 — State & Activity Diagram Maturity (Priority: HIGH)

> **Branch:** `feature/state-composite`  

### 3.1 Composite/nested states

Current: Flat node-edge graph.  
Target: True hierarchical state nesting.

#### Grammar additions:

```antlr
// Allow entities to contain nested entities (for composite states)
member
    : fieldDecl
    | methodDecl
    | enumValueDecl
    | entityDecl       // nested entity = sub-state
    | regionDecl       // concurrent regions
    | SEMI
    ;

regionDecl
    : KW_REGION LBRACE diagramBody RBRACE
    ;
```

#### AST & parser changes:

- `EntityDecl.members` already includes `EntityDecl` in the type union → ensure parser handles nested composite states
- Add `region` keyword and `RegionDecl` AST node

#### Renderer changes (`state-renderer.ts`):

- Render composite states as **large rounded rectangles** containing nested state boxes
- Draw **concurrent region separators** as dashed horizontal lines
- Render **pseudostates** correctly:
  - `choice` → diamond
  - `history` → circle with "H"  
  - `fork`/`join` → synchronization bar
  - `start` → filled circle
  - `stop` → bull's eye

#### State-specific semantic rules:

*Removed in rule cleanup (now handled generically)*

### 3.2 Activity diagram enhancements

> **Branch:** `feature/activity-swimlanes`

#### Grammar:

```antlr
// Swimlane / partition container
partitionDecl
    : KW_PARTITION STRING LBRACE diagramBody RBRACE
    ;

// Add to bodyItem
| partitionDecl
```

#### Renderer:

- Render **swimlanes** as vertical columns with headers
- **Guard conditions** rendered as text labels on decision arrows
- **Object nodes** rendered as rectangles (distinct from action rounded-rects)
- **Signal send/receive** rendered as pentagon shapes

### Tasks checklist:

- [ ] Add `region`, `partition` keywords
- [ ] Implement composite state nesting in parser
- [ ] Add `RegionDecl`, `PartitionDecl` AST nodes
- [ ] Rewrite `state-renderer.ts` with composite support
- [ ] Add swimlane rendering to `flow-renderer.ts`
- [ ] Write 10+ tests
- [ ] Create `examples/state-diagram.isx`
- [ ] Create `examples/activity-diagram.isx`

---

## Phase 4 — Component & Deployment Diagrams (Priority: HIGH)

> **Branch:** `feature/component-ports`  

### 4.1 Component diagram: ports & interfaces

#### Grammar:

```antlr
// New entity kinds
entityKind
    : ... existing ...
    | KW_INTERFACE     // already present
    | KW_PORT          // NEW
    ;

// New relation types
relOp
    : ... existing ...
    | REL_PROVIDES     // '--()' lollipop
    | REL_REQUIRES     // '--(>' socket
    ;
```

#### Renderer additions:

- **Lollipop notation** (provided interface): `──○`
- **Socket notation** (required interface): `──◠`
- **Port boxes** on component boundaries
- **Assembly connectors** connecting provided to required
- **Delegation connectors** from port to internal component
- **Nested component structure** — components inside components

#### Semantic rules:

| Rule      | Description                            |
| --------- | -------------------------------------- |
| **SS-31** | `provides`/`requires` relation operator only valid in component/deployment |

### 4.2 Deployment diagram: full implementation

> **Branch:** `feature/deployment-renderer`

This is currently marked **"To Be Extracted"** — it needs full implementation.

#### Grammar additions:

```antlr
entityKind
    : ... existing ...
    | KW_DEVICE
    | KW_ARTIFACT
    | KW_ENVIRONMENT
    ;
```

#### Renderer: `deployment-renderer.ts` (NEW FILE)

- **Node** → 3D box shape
- **Device** → 3D box with `<<device>>` stereotype  
- **Environment** → rounded container with `<<executionEnvironment>>`
- **Artifact** → dog-eared rectangle
- **Nesting** → artifacts nested inside nodes/devices
- **Communication paths** → labeled edges with protocol names
- **Manifest** relationship → dashed arrow with `<<manifest>>`

#### Semantic rules:

*Combined into SS-31*

### Tasks checklist:

- [ ] Add `port`, `device`, `artifact`, `environment` keywords  
- [ ] Add provides/requires relation operators
- [ ] Update parser for new entity/relation kinds
- [ ] Create `deployment-renderer.ts` from scratch
- [ ] Add port/interface rendering to `component-renderer.ts`
- [ ] Add SS-31
- [ ] Write 12+ tests
- [ ] Create `examples/component-diagram.isx` (enhanced)
- [ ] Create `examples/deployment-diagram.isx`

---

## Phase 5 — Use Case & Collaboration Polish (Priority: MEDIUM-HIGH)

> **Branch:** `feature/usecase-boundaries`  

### 5.1 Use case diagram

#### Add:

- **System boundary** — `system "Online Shop" { ... }` renders as a rectangle container around use cases
- **First-class `include`/`extend`** — render as dashed arrows with `<<include>>`/`<<extend>>` stereotypes instead of generic relation labels
- **Extension points** — shown as a compartment inside use case ovals
- **Actor generalization** — inheritance between actors

#### Semantic rules:

| Rule      | Description                                            |
| --------- | ------------------------------------------------------ |
| **SS-30** | Naming Convention (usecases=verbs, actors=nouns)       |

### 5.2 Collaboration diagram

#### Add:

- **Numbered messages** — `1: doSomething()` rendered as labels on links
- **Message nesting/sub-numbering** — `1.1`, `1.2`, `1.1.1`
- **Self-links** — loopback messages on a single object
- **Return messages** — dashed arrows
- **Direction markers** on non-directional links — small arrow in middle of edge

### Tasks checklist:

- [ ] Add `system` keyword and boundary parsing
- [ ] Add include/extend as first-class relation operators
- [ ] Add system boundary rendering in `usecase-renderer.ts`
- [ ] Add message numbering to `collaboration-renderer.ts`
- [ ] Add SS-30
- [ ] Write 8+ tests
- [ ] Create `examples/usecase-diagram-advanced.isx`
- [ ] Create `examples/collaboration-diagram.isx`

---

## Phase 6 — Class Diagram Refinements (Priority: MEDIUM)

> **Branch:** `feature/class-enhancements`  

### Improvements:

- [ ] **Association classes** — rendered as a class box connected to an association line by a dashed line
- [ ] **N-ary associations** — diamond node connected to >2 classes
- [ ] **Qualified associations** — small qualifier box at the association end
- [ ] **Better multiplicity rendering** — multiplicities as `{label}` boxes at ends
- [ ] **Constraint notes** — `{constraint}` labels rendered below relations
- [ ] **Notes attached to members** — not just to entities
- [ ] **Abstract/final visual distinctions** — italic names for abstract, `{leaf}` for final
- [ ] **Better generic rendering** — `Class<T>` rendered with prominent type parameters
- [ ] **Package containers** — render packages as tabbed folders containing entities, with proper nesting

---

## Phase 7 — Layout Engine & Auto-Layout (Priority: HIGH)

> **Branch:** `feature/auto-layout`  

### 7.1 Implement basic auto-layout algorithms

```typescript
// src/layout/auto-layout.ts (NEW)
export interface LayoutEngine {
  layout(diagram: IOMDiagram, direction: 'TB' | 'LR' | 'RL' | 'BT'): Map<string, Position>;
}
```

#### Algorithms to implement:

1. **Sugiyama/layered layout** (for class, component, deployment) — hierarchical, top-down
2. **Force-directed layout** (for collaboration) — spring model
3. **Sequence layout** (for sequence) — column-based with time axis
4. **Timeline layout** (for state, activity) — topological ordering

### 7.2 Layout features:

- [ ] **Partial auto-layout** — auto-place only entities without `@at` annotations
- [ ] **Lock/unlock** entity positions
- [ ] **Container-aware nesting** — auto-resize packages/partitions when children move
- [ ] **Routing hints** — orthogonal edge routing for clean diagrams
- [ ] **Alignment tools** — align entities horizontally/vertically
- [ ] **Snap-to-grid** — optional grid snapping
- [ ] **Edge routing modes** — orthogonal, polyline, curved (bezier)

### 7.3 Layout keyboard shortcuts:

| Shortcut       | Action                             |
| -------------- | ---------------------------------- |
| `Ctrl+Shift+L` | Auto-layout all                    |
| `Ctrl+Shift+A` | Auto-layout unplaced entities only |
| `Ctrl+Shift+G` | Toggle snap-to-grid                |

---

## Phase 8 — Testing Blitz (Priority: CRITICAL)

> **Branch:** `test/comprehensive-coverage`  

### 8.1 Test targets

| Test Suite               | Current | Target | Description                                   |
| ------------------------ | ------- | ------ | --------------------------------------------- |
| `lexer.test.ts`          | 24      | 35+    | Cover all new keywords and token types        |
| `parser.test.ts`         | 28      | 55+    | Cover fragments, configs, regions, partitions |
| `semantics.test.ts`      | 32      | 60+    | All SS rules (SS-1 through SS-17, SS-30 through SS-33) |
| `renderer.test.ts`       | ~5      | 40+    | Each renderer with multiple scenarios         |
| `integration.test.ts`    | 0       | 15+    | Full pipeline: source → AST → IOM → SVG       |
| `error-recovery.test.ts` | ~5      | 15+    | Graceful degradation and error messages       |

**Total: 84 → 220+ tests**

### 8.2 Test categories for each diagram type:

```
For EACH of the 8 diagram types:
  - 2+ lexer tests (new tokens)
  - 3+ parser tests (structural correctness)
  - 3+ semantic tests (rule validation)
  - 3+ renderer tests (SVG output correctness)
  - 2+ integration tests (end-to-end)
  = ~13 tests per diagram type × 8 = ~104 new tests
```

### 8.3 Test quality standards:

- Every test must have a **descriptive name** explaining what it verifies
- Every semantic rule must have at least **one positive and one negative test**
- Renderer tests verify SVG contains expected `data-entity-name` and `data-relation-*` attributes
- Integration tests verify the full pipeline doesn't throw and produces valid SVG

### Tasks checklist:

- [ ] Add 10+ lexer tests for new keywords
- [ ] Add 25+ parser tests for fragments, configs, composites
- [ ] Add 28+ semantic tests for SS-15 through SS-17, and SS-30 through SS-33
- [ ] Add 35+ renderer tests (4+ per diagram type)
- [ ] Add 15+ integration tests
- [ ] Add edge case and error recovery tests
- [ ] Ensure `npm run test:coverage` shows 80%+ coverage

---

## Phase 9 — Documentation, Parity & Examples (Priority: CRITICAL)

> **Branch:** `docs/implementation-parity`  

### 9.1 Close the docs ↔ implementation gap

This is one of the **most impactful improvements**. Users get frustrated when docs promise features that don't work.

For EACH diagram spec document:

| Doc File                | Action                                         |
| ----------------------- | ---------------------------------------------- |
| `docs/sequence.md`      | Rewrite to match implemented fragment support  |
| `docs/state.md`         | Update composite state and pseudostate docs    |
| `docs/activity.md`      | Update swimlane and partition docs             |
| `docs/component.md`     | Update port/interface docs                     |
| `docs/deployment.md`    | Write from scratch (currently conceptual)      |
| `docs/use-case.md`      | Update system boundary and include/extend docs |
| `docs/collaboration.md` | Update message numbering docs                  |
| `docs/class.md`         | Update package and association class docs      |

### 9.2 Each doc must contain:

1. **Implemented features** — with working `.isx` code examples
2. **Grammar rule reference** — copy from `Isomorph.g4`
3. **Semantic rules** — which SS-N rules apply
4. **Known limitations** — honest about what's not yet done
5. **Visual examples** — screenshots or SVG renders

### 9.3 Example files (expand from 3 to 10+):

| File                                 | Status                           |
| ------------------------------------ | -------------------------------- |
| `examples/class-diagram.isx`         | ✅ Exists, enhance                |
| `examples/component-diagram.isx`     | ✅ Exists, enhance                |
| `examples/usecase-diagram.isx`       | ✅ Exists, enhance                |
| `examples/sequence-diagram.isx`      | ❌ Create (with fragments!)       |
| `examples/state-diagram.isx`         | ❌ Create (with composite states) |
| `examples/activity-diagram.isx`      | ❌ Create (with swimlanes)        |
| `examples/deployment-diagram.isx`    | ❌ Create                         |
| `examples/collaboration-diagram.isx` | ❌ Create                         |
| `examples/showcase-all.isx`          | ❌ Create (multi-diagram file)    |
| `examples/kitchen-sink.isx`          | ❌ Create (every feature)         |

### 9.4 README.md update:

- [ ] Update supported diagram table with actual feature coverage
- [ ] Update test count badge (84 → 220+)
- [ ] Add animated GIF of bidirectional editing
- [ ] Add architecture diagram rendered by Isomorph itself (meta!)
- [ ] Add "What's New" section listing recent enhancements

### Tasks checklist:

- [ ] Rewrite all 8 diagram spec docs
- [ ] Create 7 new example `.isx` files
- [ ] Enhance 3 existing example files
- [ ] Update README.md
- [ ] Update CONTRIBUTING.md with new rules (SS-15 through SS-17, SS-30 through SS-33)
- [ ] Add CHANGELOG.md

---

## Phase 10 — UI/UX & Editor Enhancements (Priority: MEDIUM)

> **Branch:** `feature/editor-improvements`  

### 10.1 Editor enhancements:

- [ ] **Auto-completion** for keywords (`alt`, `loop`, `partition`, etc.)
- [ ] **Snippet insertion** — type `seq` → expand to sequence diagram template
- [ ] **Error underlining** — underline specific tokens on semantic errors (not just console)
- [ ] **Bracket matching** — highlight matching `{ }`, `( )`
- [ ] **Folding** — collapsible diagram/entity blocks
- [ ] **Minimap** — side-panel code preview

### 10.2 Canvas/diagram view:

- [ ] **Zoom controls** — buttons and mouse wheel with Ctrl
- [ ] **Pan** — click-and-drag on canvas background
- [ ] **Entity selection** — highlight border on click
- [ ] **Multi-select** — Shift+click or drag-box selection
- [ ] **Toolbar** — zoom in/out, fit-to-view, export SVG, export PNG
- [ ] **Diagram type indicator** — badge showing current diagram kind

### 10.3 Export capabilities:

- [ ] **SVG export** with proper metadata
- [ ] **PNG export** at configurable DPI
- [ ] **Copy to clipboard** as SVG/PNG
- [ ] **PDF export** via browser print

---

## Phase 11 — Website, Demo & Presentation (Priority: MEDIUM)

> **Branch:** `feature/website-showcase`  

### 11.1 Live demo improvements:

- [ ] Pre-loaded example picker dropdown (select from 10+ examples)
- [ ] "Share diagram" via URL-encoded source in hash
- [ ] Dark/light theme toggle
- [ ] Split pane with adjustable width (already exists — polish it)

### 11.2 Website content:

- [ ] Language reference card (cheat sheet)
- [ ] Interactive tutorial walkthrough
- [ ] Comparison table: Isomorph vs Mermaid vs PlantUML
- [ ] Performance benchmarks (parsing speed for large files)
---
## Definition of Done
A feature is "done" when:
- [ ] Reference Grammar `.g4` spec updated
- [ ] AST types defined in `ast.ts`
- [ ] Lexer handles new tokens
- [ ] Parser produces correct AST
- [ ] Semantic analyzer validates applicable rules
- [ ] IOM carries the new information
- [ ] Renderer produces correct SVG
- [ ] ≥3 tests per new semantic rule
- [ ] ≥2 parser tests per new construct
- [ ] ≥1 renderer test per new visual element
- [ ] Corresponding `.md` doc updated
- [ ] Example `.isx` file includes the feature
- [ ] `npm test` passes all (including new) tests
- [ ] `npm run typecheck` shows no errors
- [ ] PR reviewed and merged into `dev`
---
## Risk Mitigation

| Risk                                                | Impact | Mitigation                                                                                         |
| --------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| Grammar changes break existing tests                | High   | Run full test suite after every grammar change. Keep AST backward-compatible.                      |
| Fragment nesting causes parser complexity explosion | High   | Limit nesting depth in parser (max 5 levels). Add cycle detection.                                 |
| Auto-layout is computationally expensive            | Medium | Implement as opt-in. Cache layout results. Use web workers for large diagrams.                     |
| Docs still out of parity after edits                | Medium | Create a CI check: "every entity kind in grammar must appear in at least one doc and one example." |
| Team coordination conflicts                         | Medium | Assign ownership: one person per diagram type. Use `CODEOWNERS` file.                              |
| Scope creep                                         | High   | This plan is the scope ceiling. Defer any feature not listed here to v2.0.                         |
| Renderer tests are brittle (SVG string matching)    | Medium | Test SVG structure via DOM queries (jsdom + querySelector), not string equality.                   |

---
## Summary: Overachieve Targets
| Metric                  | Current                | Target                                     | Multiplier |
| ----------------------- | ---------------------- | ------------------------------------------ | ---------- |
| **Test count**          | 84                     | 220+                                       | **2.6×**   |
| **Semantic rules**      | 14 (SS-1–SS-14)        | 21 (SS-1–SS-17, SS-30-33)                  | **1.5×**   |
| **Example files**       | 3                      | 10+                                        | **3.3×**   |
| **Diagram renderers**   | 7 (deployment missing) | 8+ (all complete)                          | **1.14×**  |
| **Fragment support**    | 0                      | Full (alt/loop/opt/par/break/critical/ref) | **∞**      |
| **Composite states**    | No                     | Yes with regions                           | **∞**      |
| **Swimlanes**           | No                     | Yes                                        | **∞**      |
| **Ports/interfaces**    | No                     | Yes with lollipop/socket                   | **∞**      |
| **System boundary**     | No                     | Yes                                        | **∞**      |
| **Auto-layout**         | No                     | Basic Sugiyama + force                     | **∞**      |
| **Title/legend/config** | No                     | Yes                                        | **∞**      |
| **Deployment renderer** | "To Be Extracted"      | Fully implemented                          | **∞**      |
> **This planships a genuinely competitive UML diagramming DSL.**