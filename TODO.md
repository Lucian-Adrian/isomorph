# Isomorph TODO

Last refreshed: 2026-06-09 from the local `feature/infinite-canvas-ultimate-ux` worktree.

## Implementation Policy
- Every new/fixed item must be documented in TODO/roadmap/relevant docs.
- Every new/fixed item must follow the existing design language and support EN/RO/RU i18n plus dark/light mode.
- Verification claims in this file must come from fresh local command output or be explicitly marked as older/unverified.

---

## Current Verification Snapshot

- [x] `npm test -- --run`: 487 passing, 0 failing, 30 test files.
- [x] `npm run typecheck`: passed.
- [x] `npm run build`: passed.
- [x] `npm run qa:app`: passed inside `npm run verify`; timestamped QA logs are written under `artifacts/qa/`.
- [x] `npm run symphony:check`: passed; 13 tracked tasks, no dispatchable or blocked tasks.
- [ ] `npm run qa:supabase:live`: not rerun in this refresh. Previous docs record a 2026-05-31 live pass; current live proof still needs credentials.

Build output to keep in mind:
- `website/dist/app/assets/index-BKoHKtcB.js`: 381.06 kB.
- `website/dist/app/assets/vendor-editor-CKufDpsk.js`: 357.24 kB.
- `website/dist/app/assets/vendor-supabase-Cp1pO4X2.js`: 204.43 kB.
- `website/dist/app/assets/vendor-react-CIlLrotA.js`: 138.64 kB.

---

## Current Reality Check

The old `task.md`/chat mismatch list is now mostly historical. The branch currently has broad implementations for the previously missing core features:

- [x] Config statements: `title`, `subtitle`, `caption`, `legend`, `direction`, `strict`, `autonumber`, `autoactivation`.
- [x] Sequence fragments: parse/analyze/render coverage for fragment boxes and constraints.
- [x] Sequence lifecycle: create/destroy syntax, activations, renderer visuals, source rewrite helpers, modal/stencil/canvas paths.
- [x] Sequence interaction: participants expose drag metadata, relation hit-lines exist, y-position persistence is scoped and formatting-safe.
- [x] Activity partitions: SS-10 false positive fixed; move/resize/rename persistence paths are covered.
- [x] Use-case boundaries: explicit/editable system boundaries and default-boundary behavior are covered.
- [x] Component/deployment ports: provides/requires operators, semantic validation, endpoint routing, and lollipop/socket markers.
- [x] Deployment nesting: nested node rendering has regression coverage.
- [x] Collaboration numbering: hierarchical autonumbering and manual message numbers are implemented in renderer behavior.
- [x] State composites: nested children and concurrent region separators render beyond only parsed data structures.
- [x] Non-class arrows: shared edge/boundary helpers now reduce center-under-shape routing across renderers.
- [x] Formal grammar parity: `grammar/Isomorph.g4` has been aligned with runtime parser/lexer behavior.
- [x] Codegen: Java/Python generation is tested with real `javac` and Python runtime probes; CLI supports `--diagram`.
- [x] Canvas: pure freeform mode, drawing, drag/resize/rotate, lasso, eraser, image/embed/text metadata, draft semantic links, upload, and export are covered.
- [x] Export: merged semantic/freeform SVG+PNG hardcases, off-bounds content, `xmlns:xlink`, root dimensions, and rotation are covered.
- [x] Metrics: measured latency/productivity/time split/canvas tool usage and RO/RU localization are covered.

---

## P0 Must Stay Green

- [x] Keep browser QA failing on React maximum-update-depth warnings.
- [x] Keep pure-canvas QA covering no parsed diagram, blank-click selection clearing, eraser deletion, lasso selection, image/embed/text persistence, and export hardcases.
- [x] Keep source rewrite tests for active-diagram scoping, duplicate entity names, sequence relation y spacing, lifecycle insertion, and component relation grouping.
- [x] Keep codegen tests compiling/running emitted Java/Python, not just string-checking output.
- [x] Keep exporter tests inspecting serialized SVG content and PNG-ready dimensions.
- [x] Rerun full `npm run verify` after the final release-slice cleanup; it passed on 2026-06-09.
- [ ] Rerun `npm run qa:supabase:live` with real QA credentials before claiming current live auth/RLS/save-load/telemetry proof.

---

## P1 Documentation Sync

- [x] Update `ROADMAP.md` to current branch state.
- [x] Update `TODO.md` to current branch state.
- [x] Update `README.md` test badge and testing section from 438 to 487 passing.
- [x] Update `docs/qa/isomorph-release-handoff.md` with the 487-test snapshot and current bundle chunk sizes.
- [ ] Re-scan diagram docs for claims that still describe fixed gaps as open, especially sequence, state, component, collaboration, and deployment docs.
- [ ] Keep `docs/mar26/*` and `docs/unorganised/chat.md` clearly treated as historical/raw planning material, not current product truth.

---

## P2 Remaining Product Work

- [ ] Implement real concurrent source/canvas editing through a CRDT/provider instead of only presence and adapter shapes.
- [ ] Add collaborator comments, role-specific permissions, and visible remote cursors.
- [ ] Add account cloud version history.
- [ ] Polish account import/export flows and prove them through UI QA.
- [ ] Decide whether sequence response pairing should remain strict LIFO under `autoactivation` or offer a relaxed drafting mode.
- [ ] Add object, timing, data, EBNF, Gantt, network, and database-schema diagram types only after the current release surface is stable.

---

## P3 Maintainability and Performance

- [ ] Continue extracting `src/App.tsx` orchestration into smaller command/render modules.
- [ ] Add a CI bundle-size budget.
- [ ] Run source-map or bundle-analyzer review before final deployment.
- [ ] Consider lazy-loading or deferring Supabase client code until account/cloud UI opens.
- [ ] Keep optional editor/codegen/metrics/full-canvas surfaces lazy-loaded as the shell evolves.
- [ ] Clean the current dirty branch into reviewable commits without reverting unrelated worktree changes.

---

## P4 Release Proof Checklist

Run before final submission or deployment:

```powershell
npm run verify
```

Run additionally when live credentials are available:

```powershell
$env:QA_LIVE_SUPABASE='1'
npm run qa:supabase:live
```

Manual or browser proof still worth doing before final handoff:
- [x] Open the local app and sanity-check welcome/create flow, IDE `#/app`, Canvas `#/canvas`, and Back navigation.
- [x] Export SVG and PNG hardcases are covered by `npm run qa:app` for semantic/freeform mixed content and by exporter regression tests.
- [ ] Generate Java/Python through both the panel and `npm run codegen`.
- [ ] Save/load with Supabase using current credentials if cloud claims are included in the report.
- [ ] Check EN/RO/RU labels on newly touched metrics, canvas, sequence, and collaboration controls.

---

## Historical Notes Now Resolved

These were true gaps in older notes but should not be carried forward as open TODOs unless a new regression appears:

- Sequence fragments missing.
- Swimlanes/partitions missing or blocked by SS-10.
- System boundaries missing.
- Deployment renderer absent.
- Component lollipop/socket notation only decorative.
- Collaboration numbered messages absent.
- Sequence participant/relation selection broken.
- Sequence y-drag source formatting corruption.
- State composite/regions only parsed but not rendered.
- Codegen only string-tested.
- Export downloads succeeding while off-bounds content is cropped.
