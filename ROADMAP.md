# Isomorph Roadmap

## Implementation Policy
- Every feature/fix must keep README, TODO, roadmap, and relevant docs in parity.
- UI work must follow the existing design language and include EN/RO/RU i18n plus dark/light mode support.
- Roadmap entries must describe current state, not only original intent.

## Current Product Baseline
- Implemented: formal `.isx` parsing, semantic analysis, SVG rendering, bidirectional position rewrites, diagram examples, CodeMirror editor integration, workspace shell, full-canvas shell, code generation panel, telemetry metrics, Supabase persistence interfaces, and live QA helpers.
- Implemented diagram paths: class, use case, component, deployment through the shared component/deployment renderer, sequence, activity/flow, state, collaboration.
- Implemented language features include config statements, sequence fragments, sequence lifecycle syntax/visuals, sequence y-position persistence, activity partitions, use-case system boundaries, component lollipop/socket semantics, and grammar/parser parity.
- Build improvement completed: production bundle now lazy-loads the source editor/CodeMirror path, code generation engine/panel, metrics panel, right rail, workspace overlays, and full-canvas shell instead of statically pulling all of them into the initial app chunk.

## P0 Submission Readiness
- [x] Remove stale README claims about 84 passing tests.
- [x] Remove the internal orchestration dashboard section from README.
- [x] Reframe roadmap/TODO docs around actual implemented and partial behavior.
- [x] Add bundle splitting for editor, codegen, metrics, right rail, overlay, and full-canvas paths.
- [x] Resolve current test failures before any "all tests pass" submission claim.
- [x] Keep release handoff verification output copied from a fresh run only.

## P1 Product Correctness
- [x] Fix SS-10 partition layout validation.
- [x] Stabilize partition move/resize persistence and rename/edit flow.
- [x] Standardize non-class arrow anchoring across renderers.
- [x] Restore sequence participant/relation selection and relation y dragging.
- [x] Align grammar/Isomorph.g4 with runtime parser/lexer capabilities.
- [x] Add component/deployment provides/requires operators and endpoint routing.
- [x] Add sequence return/create/destroy semantics and visuals.
- [ ] Finish dedicated canvas tools for drawing sequence create/destroy flows.
- [ ] Add collaboration auto-numbering and nested message numbering.
- [ ] Expand state composite/region rendering beyond parsed data structures.

## P2 UX and Collaboration
- [x] Add workspace right rail, source/canvas panels, overlay host, metrics, and codegen surfaces.
- [x] Add Escape-to-close behavior and mobile-aware canvas/source layout.
- [x] Add Supabase presence and persistence adapter interfaces.
- [ ] Move concurrent source/canvas editing from adapter shape to a real CRDT/provider implementation.
- [ ] Add collaborator comments, role-specific permissions, and visible cursors.
- [ ] Add cloud storage version history and import/export flows for account users.

## P3 Performance and Maintainability
- [x] Split the largest optional UI/runtime paths out of the initial production chunk.
- [ ] Continue extracting `App.tsx` orchestration into focused command/render modules.
- [ ] Add build-size budget checks so regressions are caught in CI.
- [ ] Consider deferring Supabase client code until account/cloud flows are opened.
- [ ] Review source-map or bundle-analyzer output before final deployment if load time remains high.

## P4 Future Diagram Expansion
- [ ] Object and timing diagrams.
- [ ] Data diagrams for JSON/YAML visualization.
- [ ] EBNF grammar diagrams.
- [ ] Project-management diagrams such as Gantt.
- [ ] Infrastructure diagrams such as network and database schema diagrams.

## Known Current Limitations
- Current sequence create/destroy creation is modal-assisted; dedicated canvas draw tools are still pending.
- Sequence call/response pairing is strict LIFO.
- Collaboration message numbering is not yet first-class.
- Supabase collaboration has presence/persistence plumbing but not true concurrent source merging.
