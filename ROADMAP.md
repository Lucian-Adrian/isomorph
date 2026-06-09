# Isomorph Roadmap

Last refreshed: 2026-06-09 from the local `feature/infinite-canvas-ultimate-ux` worktree.

## Implementation Policy
- Every feature/fix must keep README, TODO, roadmap, and relevant docs in parity.
- UI work must follow the existing design language and include EN/RO/RU i18n plus dark/light mode support.
- Roadmap entries must describe verified current state, not only original intent.
- Do not claim live Supabase status from normal local gates; use `npm run qa:supabase:live` with explicit credentials for that proof.

## Current Product Baseline
- Implemented: formal `.isx` parsing, semantic analysis, SVG rendering, bidirectional source rewrites, diagram examples, CodeMirror editor integration, workspace shell, full-canvas shell, code generation panel and CLI, telemetry metrics, Supabase persistence helpers, presence adapter interfaces, and browser QA.
- Implemented diagram paths: class, use case, component, deployment through the shared component/deployment renderer, sequence, activity/flow, state, and collaboration.
- Implemented language features: config statements, sequence fragments, sequence lifecycle syntax/visuals, autoactivation, sequence y-position persistence, activity partitions, editable use-case boundaries, component/deployment provides/requires semantics, port endpoint routing, collaboration hierarchical message numbering, composite state containment/regions, and grammar/parser parity.
- Canvas mode now supports pure freeform usage without a parsed diagram, rectangle/ellipse/line/arrow/pen/text/image/embed/frame/lasso/laser/strict-UML tools, multi-select, drag/resize/rotate, style/layer controls, image uploads, draft semantic links, blank-click selection clearing, eraser behavior, and export from canonical `canvas_state`.
- Export is hardened for merged semantic + freeform canvases, off-bounds content, root `xmlns:xlink`, PNG-ready SVG dimensions, and rotated canvas-state elements.
- Codegen is no longer only app-panel driven: `scripts/codegen-cli.ts` supports Python/Java output, `--out`, multi-diagram warnings, and `--diagram` selection.
- Metrics are report-oriented: latency, productivity, measured text-vs-visual activity split, canvas tool usage, localization, and workflow profile summaries are covered by tests.
- Build improvement remains in place: optional editor/codegen/metrics/right-rail/overlay/full-canvas paths are split out of static imports, though current bundle output should be watched because app code grew again with canvas features.

## Fresh Local Verification
- [x] `npm test -- --run`: 31 files, 504 tests passed.
- [x] `npm run typecheck`: passed.
- [x] `npm run build`: passed.
  - Current production output: `index-BMlJFpO1.js` 389.50 kB, `vendor-editor-CKufDpsk.js` 357.24 kB, `vendor-supabase-Cp1pO4X2.js` 204.43 kB, `vendor-react-CIlLrotA.js` 138.64 kB.
- [x] `npm run qa:app`: passed inside `npm run verify` and wrote timestamped logs under `artifacts/qa/`.
- [x] `npm run symphony:check`: passed with 13 tracked tasks and no dispatchable or blocked tasks.
- [ ] `npm run qa:supabase:live`: not rerun in this refresh; previous docs mention a 2026-05-31 live proof, but current live status requires credentials.

## P0 Submission Readiness
- [x] Remove stale README/docs claims about the old 84-test baseline.
- [x] Reframe roadmap/TODO docs around actual implemented and partial behavior.
- [x] Keep release handoff verification output copied from fresh runs only.
- [x] Keep browser QA strict enough to fail React maximum-update-depth warnings and pure-canvas/export regressions.
- [x] Preserve `.isx` vs `canvas_state` ownership: semantic diagram edits rewrite `.isx`; freeform/draft canvas objects stay in `canvas_state`.
- [x] Refresh README/release-handoff test counts and bundle-size notes from the current 504-test/389.50 kB snapshot.

## P1 Product Correctness
- [x] Fix SS-10 partition layout validation.
- [x] Stabilize partition move/resize persistence and rename/edit flow.
- [x] Standardize non-class arrow anchoring across renderers.
- [x] Restore sequence participant/relation selection and relation y dragging.
- [x] Align `grammar/Isomorph.g4` with runtime parser/lexer capabilities.
- [x] Add component/deployment provides/requires operators and endpoint routing.
- [x] Add sequence return/create/destroy semantics and visuals.
- [x] Add direct canvas drawing for sequence create lifecycle messages.
- [x] Expose sequence create/destroy stencils/actions in the workspace flow.
- [x] Add collaboration auto-numbering and nested message numbering.
- [x] Render state composite containment and concurrent region separators.
- [x] Scope source rewrites to the active diagram for duplicate names, relation y updates, lifecycle inserts, and entity positions.

## P2 UX and Collaboration
- [x] Add workspace right rail, source/canvas panels, overlay host, metrics, and codegen surfaces.
- [x] Add Escape-to-close behavior and mobile-aware canvas/source layout.
- [x] Add Supabase presence and persistence adapter interfaces.
- [x] Add canvas collaboration pill and share modal foundations.
- [x] Add full-canvas More menu coverage for frame, web embed, laser pointer, lasso, UML package, strict UML, validate/export/source/shortcuts flow.
- [x] Add image upload and editable text/embed/image/draft-semantic-link metadata in canvas properties.
- [ ] Move concurrent source/canvas editing from adapter shape to a real CRDT/provider implementation.
- [ ] Add collaborator comments, role-specific permissions, and visible remote cursors beyond the current presence foundation.
- [ ] Add cloud storage version history and polished import/export flows for account users.

## P3 Performance and Maintainability
- [x] Split the largest optional UI/runtime paths out of the initial production import graph.
- [x] Add focused regression tests for source rewrites, CLI, exporter, canvas shell, metrics, renderer semantics, and app scoping.
- [ ] Continue extracting `App.tsx` orchestration into focused command/render modules.
- [ ] Add build-size budget checks so regressions are caught in CI.
- [ ] Run a bundle analyzer/source-map review before final deployment; current app chunk is 389.50 kB after the latest feature work.
- [ ] Consider deferring Supabase client code until account/cloud flows are opened.
- [ ] Clean up the current dirty branch into reviewable commits without reverting unrelated worktree changes.

## P4 Future Diagram Expansion
- [ ] Object and timing diagrams.
- [ ] Data diagrams for JSON/YAML visualization.
- [ ] EBNF grammar diagrams.
- [ ] Project-management diagrams such as Gantt.
- [ ] Infrastructure diagrams such as network and database schema diagrams.

## Known Current Limitations
- Live Supabase behavior was not re-proven during this refresh; rerun `npm run qa:supabase:live` with explicit QA credentials before making a current live claim.
- Concurrent editing is still presence/adapter-first, not a real CRDT-backed source/canvas merge system.
- The codebase still centralizes too much orchestration in `src/App.tsx`.
- Bundle size improved structurally but needs a hard CI budget; the current main app chunk is 389.50 kB.
- Response matching in sequence diagrams is intentionally stricter than loose sketching when `autoactivation` is enabled.
- Collaboration comments, permissions, visible remote cursors, account version history, and final cloud import/export polish are still future work.
