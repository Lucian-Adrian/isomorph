# Isomorph TODO

## Implementation Policy
- Every new/fixed item must be documented (TODO/docs/roadmap parity).
- Every new/fixed item must follow existing design language and support EN/RO/RU i18n + dark/light mode from the start.

---

## Executive Reality Check

The roadmap in task.md is partially outdated.
A large part of Phase 1 and some Phase 2/3/4/5 items are already implemented in code, but often with gaps or inconsistencies.

High-confidence current state:
- Implemented: config statements, sequence fragments (core), sequence autonumber, swimlanes/partitions, deployment rendering path, basic system boundaries, basic ports notation rendering.
- Partially implemented: sequence lifecycle commands, component ports semantics, use case boundary semantics, state composite/regions, collaboration numbering depth.
- Broken or inconsistent: non-class arrow anchoring, partition layout validation error SS-10, deployment nesting behavior, docs/grammar parity, some source rewrite formatting edge cases.

---

## Truth Matrix: Task vs Chat vs Code

### 1) Deployment renderer
- task.md says: missing, to be extracted.
- chat.md says: deployment exists but nesting is badly done.
- code reality: deployment is rendered by component-renderer via renderer dispatch for deployment kind.
- verdict: chat is closer to reality.
- why:
  - Renderer dispatch maps deployment to renderComponentDiagram in src/renderer/index.ts.
  - No dedicated src/renderer/deployment-renderer.ts file exists.
  - README still says deployment is To Be Extracted, which is stale.

### 2) Sequence fragments
- task.md says: not implemented.
- chat.md says: forgotten / not implemented.
- code reality: implemented for parsing + IOM + rendering for alt/loop/opt/par/break/critical with else blocks.
- verdict: both docs are stale.
- why:
  - AST includes FragmentDecl.
  - Lexer has alt/else/opt/loop/par/break/critical/end tokens.
  - Parser parseFragmentDecl exists.
  - Analyzer collects fragments into iom.fragments.
  - sequence-renderer draws fragment boxes/tabs and else separators.
  - tests/fragments.test.ts validates parsing + analysis.

### 3) Config layer (title/subtitle/legend/direction/strict/autonumber)
- task.md says: needs to be added in Phase 1.
- code reality: already implemented, including caption.
- verdict: Phase 1 core already done.
- why:
  - ast.ts includes ConfigDecl.
  - lexer/parser support keys and statements.
  - analyzer propagates to iom.config.
  - renderers call config header/legend/caption utilities.
  - tests/dsl_features.test.ts validates parsing and rendering behavior.

### 4) Swimlanes / partitions
- task.md says: missing.
- chat.md says: present but bugged; resize + SS-10 issue.
- code reality: present and rendered, but validation path has a known bug.
- verdict: chat is correct.
- why:
  - Parser supports PartitionDecl and @Partition at (x,y,w,h).
  - Analyzer creates iom.partitions and applies position.
  - state-renderer renders lanes with resize handles and width/height.
  - Bug: SS-10 validation checks unknown layout targets against entities/packages only and forgets partitions, causing false error for partition layout annotations.

### 4.1) Partition drag/resize instability and coordinate loss
- user report: partition drag/resize is hit-or-miss; width/height get dropped, lane auto-stretches, resizing can jump lane outside activity canvas; with two lanes snapping/resizing behaves erratically.
- code reality: confirmed with concrete state synchronization gaps.
- verdict: confirmed bug cluster.
- why:
  - Move path in App persists coords via activeDiagram.entities.get(name), but partitions live in diag.partitions, so w/h are often omitted and annotation is rewritten as @Lane at (x, y).
  - Resize path in App also reads x/y from activeDiagram.entities.get(name); for partitions this falls back to defaults (40,40), causing lane jumps on resize commit.
  - Renderer auto-expands lane dimensions when partition.position.w/h are missing, which looks like auto-stretch over the full activity area.
  - With two lanes, resize snapping runs in DiagramView against transformed lane groups while persisted source coords are stale/misaligned, amplifying jumps.

### 4.2) Partition rename/edit modal missing
- user report: partitions do not open rename/edit modal.
- code reality: confirmed.
- verdict: confirmed.
- why:
  - Activity lanes are rendered from diag.partitions and expose data-entity-name.
  - Double-click edit path resolves entity through diagram.entities.get(name); partitions are not in diagram.entities, so modal never opens.
  - This creates feature inconsistency vs other draggable elements.

### 5) System boundaries in use case
- task.md says: missing.
- chat.md says: present but drag behavior bug exists in some cases.
- code reality: present at renderer level, but semantics/DSL style differs from planned syntax.
- verdict: task is outdated, chat likely captures real UX issue.
- why:
  - Use case renderer supports entities of kind system/boundary and draws boundary rectangles.
  - Also renders a default boundary even when none is declared.
  - There is no dedicated system "Name" { ... } container grammar; boundary is modeled as an entity kind.
  - Boundary defaults to hardcoded size unless explicit positioning exists.

### 6) Ports/interfaces in component diagram
- task.md says: missing.
- chat.md says: exists but interconnection is not good.
- code reality: visual notation exists in a limited field-based model, but relation semantics are incomplete.
- verdict: chat is accurate.
- why:
  - component-renderer draws provided circles, required sockets, and port boxes from fields typed provided/required/port.
  - Relations are still generic center-to-center lines between entities.
  - No dedicated provides/requires relation operators in parser relation kinds.
  - This blocks true EA-style port-to-port connectors.

### 6.1) Circle/lollipop notation depth (beyond simple ports)
- user report: also need actual circle/lollipop notation behavior too, not only basic port visuals.
- code reality: only basic symbols are drawn; semantics and routing are still generic.
- verdict: confirmed gap.
- why:
  - Current rendering uses field type hints to paint circles/sockets.
  - Connector semantics are still relation-line based, not notation-aware.
  - There is no dedicated collaboration-level circle/lollipop notation support at all.

### 7) Numbered messages in collaboration
- task.md says: missing.
- chat.md says: exists.
- code reality: partially true.
- verdict: both partially true.
- why:
  - Collaboration renderer displays labels if present and supports arrow glyphs in label text.
  - No native auto numbering/sub-number generation in collaboration renderer.
  - There is sequence autonumber config and a sequence->collaboration transform that injects msg metadata, but collaboration renderer does not implement full numbering hierarchy logic.

### 8) Arrows under figures except class
- chat.md says: bug exists.
- code reality: strongly supported.
- verdict: confirmed.
- why:
  - class-renderer computes box-edge intersection and anchors arrows on box boundaries.
  - flow/state/usecase/component/collaboration generally connect from center-to-center, often visually crossing shapes.
  - This is exactly the discrepancy users observe.

### 9) Sequence custom relation y coordinates
- chat.md says: added.
- code reality: confirmed.
- verdict: confirmed.
- why:
  - sequence-renderer reads relation style attribute y.
  - DiagramView supports vertical drag of sequence relations.
  - App rewrites relation attribute y in source on drag end.

### 9.1) Sequence selection/move regression on dev
- user report: cannot select or move sequence relations/participants/actor.
- code reality: mostly confirmed, with concrete causes.
- verdict: confirmed regression symptoms.
- why:
  - Sequence renderer does not set data-entity-name on participant/actor groups, so DiagramView cannot detect/select/drag them as entities.
  - Sequence relations are rendered without transparent hit lines (unlike other renderers), making relation picking very hard and often perceived as broken.
  - Relation vertical move logic exists in DiagramView/App, but depends on successful hit-selection first.

### 9.2) Missing auto activation box behavior compared to master
- user report: master auto-shows blue activation boxes on lifeline-linked messages; dev no longer does.
- code reality: consistent with implementation.
- verdict: likely regression / behavior change.
- why:
  - Activation bars in sequence renderer are currently driven by explicit activate/deactivate events only.
  - There is no implicit auto-activation generation from synchronous call relations.

### 10) Sequence y drag corrupts formatting / blank lines
- chat.md says: formatting gets messed.
- code reality: plausible and consistent with source formatting logic.
- verdict: likely true.
- why:
  - Relation rewrite uses targeted regex replacement per relation line.
  - Other actions call formatDiagramSource, which reorders sections and rebuilds spacing with broad heuristics.
  - Blank-line stability around relations and annotations is not guaranteed.

### 11) Semantic rule coverage SS-15..SS-33
- task.md expects many new diagram-specific rules.
- code reality: implemented and numbered accurately (SS-1..SS-17, SS-30..SS-33).
- verdict: fixed and aligned.
- why:
  - analyzer comments updated to claim the full active baseline.
  - SS-15 and SS-16 are fragment checks.
  - SS-30 is naming convention.
  - SS-31 is component provides/requires.
  - SS-32, SS-33 are sequence interaction checks.

### 12) Formal grammar parity
- task.md assumes grammar file is source-of-truth to evolve.
- code reality: parser/lexer evolved ahead of grammar/Isomorph.g4.
- verdict: fixed and aligned.
- why:
  - grammar file updated to thoroughly match the AST and Lexer capabilities.

### 13) 16 parse errors around title member names
- user report: multiple parser errors likely caused by title.
- code reality: confirmed root cause class.
- verdict: confirmed.
- why:
  - title/subtitle/caption/legend are reserved config keywords in lexer.
  - In class members, field names are parsed as IDENT; title token is not IDENT.
  - This causes parser failures when users declare fields like + title: string.

---

## Deep Implementation Notes (What Is In)

### Already implemented and usable
- Config statements: title, subtitle, caption, legend, direction, strict, autonumber.
- Sequence fragments: alt/else, loop, opt, par, break, critical (with nested body parsing).
- Sequence activation markers: activate/deactivate rendered as activation bars.
- Sequence message y persistence: [y="..."] style attribute + drag support.
- Deployment diagram rendering path (shared renderer with component/deployment kinds).
- Use case system boundary rendering (entity-driven + default fallback boundary).
- Activity partitions/swimlanes with custom width/height layout.
- Collaboration renderer supports multiple relation curves and collision-aware label placement.
- Editor has autocompletion/lint integration and many quality-of-life hooks.

### Implemented but incomplete
- Sequence lifecycle commands:
  - return/ref parsed, but not semantically integrated or specially rendered as lifecycle events.
  - create/destroy tokens exist in lexer but no dedicated parser/analyzer/render behavior.
- Composite/concurrent state data structures:
  - parser + analyzer capture nested entities/regions.
  - renderer does not yet draw full hierarchical state containers/region separators per roadmap.
- Ports/interfaces:
  - visual symbols exist from field types.
  - no first-class relation operators and no proper connector routing between ports.
- Sequence interaction:
  - relation vertical move infrastructure exists.
  - participant/entity select-drag is broken in sequence due to missing data-entity-name attributes.
- Activity partition UX:
  - lanes are interactive (drag/resize handles) but persistence layer is entity-centric and does not reliably persist partition x/y/w/h.
  - rename flow is missing for partitions.

### Broken or inconsistent
- SS-10 partition annotation false positives (layout validation does not include partitions in target check).
- Arrow anchoring quality differs by renderer (class has edge-aware anchors; others mostly center anchors).
- Deployment nesting behavior incomplete:
  - nested entities are captured as children in IOM.
  - rendering path does not use children hierarchy for node-inside-node placement.
- Documentation mismatch:
  - README and roadmap statements conflict with actual code.
  - grammar/Isomorph.g4 not aligned with runtime parser implementation.
- Use-case boundary behavior mismatch:
  - renderer creates a synthetic default boundary when no system/boundary entity exists.
  - once a real system entity is added/dragged, synthetic boundary disappears by design, which looks like old boundary vanishing.
  - synthetic boundary has no persisted @coords, so it cannot be repositioned like real entities.

---

## Prioritized TODO (Reality-Based)

## P0 Critical Fixes
- [x] Fix SS-10 for partitions in semantic layout validation.
  - update analyzer layout target check to include known partition names.
- [x] Fix partition coordinate persistence and resize stability.
  - when moving/resizing partitions, read/write coordinates from activeDiagram.partitions instead of activeDiagram.entities.
  - preserve w/h on drag and preserve x/y on resize commits.
  - ensure dual-partition resize/snap does not cause jump artifacts.
- [x] Add partition rename/edit modal path.
  - support partition rename through existing edit UX.
  - ensure label updates persist in source and renderer.
  - ensure strings and controls are fully localized (EN/RO/RU) and compatible with both dark/light themes.
- [x] Standardize arrow anchoring in non-class renderers.
  - implement shape-edge intersection helpers in shared renderer utils and apply in usecase/component/flow/state/collaboration.
- [x] Stabilize source rewriting around relation y updates and annotation spacing.
  - preserve section separators and avoid destructive normalization side effects.
- [x] Fix package horizontal drag jitter and snap-back.
  - package drags with nested items should track cursor 1:1 on X and persist final drop position without backward snap.
- [x] Restore sequence interaction parity.
  - add data-entity-name attributes for sequence participants/actors.
  - add transparent relation hit-lines for reliable relation selection/drag.
- [x] Resolve config keyword collisions with common member names.
  - allow title/subtitle/caption/legend/return as identifiers in member context (or implement contextual keyword parsing).
- [x] Document true deployment renderer architecture.
  - update README table to reflect shared renderer implementation instead of To Be Extracted.

## P1 High Value Functional Completion
- [x] Add first-class relation operators for provides/requires in parser + AST + semantics.
- [x] Implement port-to-port connector routing and endpoint anchoring in component/deployment rendering.
- [x] Implement sequence return/create/destroy semantics and visuals.
  - return dashed back arrow, create at participant birth point, destroy marker.
- [x] Enforce sequence message model: call/response/return.
  - call requires a matching response, response must close the latest open call, return is one-way and does not require response.
  - sequence relation modal now exposes synchronous/asynchronous/response types mapped to relation operators (`-->`, `--|>`, `..>`) and provides UI actions to insert create/destroy lifecycle commands for the target participant.
- [x] Add sequence fragment semantic constraints aligned with intended SS-15+ rules.
- [-] Implement visual UI controls/dragging for Sequence Diagram Fragments (alt, loop, opt, etc.) with custom coloring support.
- [-] Implement visual tooling context menus or specialized drag modes to draw `create` and `destroy` arrows directly via the canvas UI mapping.
- [x] Upgrade circle/lollipop notation from decorative to semantic.
  - add operator-level semantics and endpoint routing for lollipop/socket connectors.

## P2 Correctness and Parity
- [x] Reconcile semantic rule numbering and meaning with docs.
  - avoid reusing SS IDs for unrelated checks.
- [x] Align grammar/Isomorph.g4 with actual parser/lexer capabilities.
- [x] Add targeted tests for currently under-tested advanced behaviors:
  - partition layout semantic check regression
  - non-class edge anchoring geometry
  - deployment nested node rendering
  - nested component port routing
  - source rewrite formatting idempotence

## P3 UX and Quality
- [x] Improve use case boundary model from plain entity toward explicit container behavior.
  - persist default boundary as a real editable system entity on first interaction, with optional width/height coordinates (similar to partitions).
  - boundary edit modal is restricted to name changes (no stereotype/body editing) for system/boundary entities.
- [ ] Add collaboration auto numbering and sub-numbering logic (in modal selection) (1, 1.1, 1.1.1).
- [x] Add Escape-to-close behavior for all modals.
  - Escape should close the active modal, consistent with click-outside close and Enter save behavior.
- [x] Consider touch pinch zoom support in DiagramView for mobile.

---

## Suggested Phase Reframe

Instead of restarting from task.md Phase 1, use this corrected sequence:
1. Stabilize correctness (P0).
2. Complete missing semantics and connectors (P1).
3. Restore documentation/grammar/test parity (P2).
4. Polish UX and advanced notation (P3).

This avoids re-implementing features that already exist while targeting the real pain points from chat.md.

---

## Known Current Limitations (Confirmed)

- [ ] Sequence create/destroy UI path is modal-assisted only.
  - Current flow inserts lifecycle commands from relation edit modal actions; dedicated canvas draw tools for create/destroy are still pending.
- [ ] Sequence call/response pairing is strict LIFO.
  - Response validation closes only the latest open synchronous call, which can be stricter than free-form sequence drafting.

---

## Quick Mismatch List to Keep Updated

- task.md says no fragments -> code has fragments.
- task.md says no swimlanes -> code has swimlanes, plus partition validation bug.
- task.md says no system boundaries -> code has boundary rendering.
- task.md says deployment missing -> deployment is routed through component renderer.
- README says deployment To Be Extracted -> stale.
- grammar file lags parser/lexer behavior.
- default use-case boundary is synthetic and not persisted, causing apparent disappearance when real system boundary is introduced.
- sequence participant groups are not selectable because they miss data-entity-name attributes in SVG output.

Keep this list fresh whenever a discrepancy is resolved.
