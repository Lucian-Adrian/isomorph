# Isomorph Release Handoff

## Completed Scope

- Added a typed IDE/Canvas mode contract with command availability and right-rail selection mapping.
- Added a versioned `canvas_state` model for freeform canvas objects, viewport, selection, style, draft links, serialization, and reducers.
- Added quiet telemetry batching with retry/backoff, queue health, payload scrubbing, and report-ready metrics aggregation.
- Added Supabase Presence collaboration interfaces, room/membership schema, share modal, and canvas collaboration pill.
- Added safe `.isx` rewrite helpers for component relation regressions, relation attributes, multiplicities, escaped labels, and diagram-scoped position updates.
- Improved full-canvas structure with extracted toolbar/properties/inspector components and a richer More menu.
- Removed the persistent bottom status bar from IDE rendering and replaced it with compact floating status pills.
- Added/kept browser QA harness under `scripts/qa/isomorph-app-qa.mjs`.
- Split optional production paths out of the initial app bundle: CodeMirror/source panel, codegen engine and panel, metrics, workspace overlays, right rail, and full-canvas shell now load on demand.

## Verification Commands

```powershell
npm run typecheck
npm test -- --run
npm run build
npm run qa:app
npm run symphony:check
```

Latest local smoke:
- `npm test -- --run`: 438 passed.
- `npm run build`: passed; initial app JS chunk is 261.31 kB with CodeMirror/editor, codegen, metrics, overlay, right rail, and full-canvas code split into separate chunks.

## Live Supabase QA

Use live credentials only in a user-controlled run. The Vite app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; the live QA runner can create/delete disposable auth users when `QA_SUPABASE_SERVICE_ROLE_KEY` or the local `SUPABASE_SECRET` alias is available.

```powershell
$env:QA_LIVE_SUPABASE='1'
npm run qa:supabase:live
```

Verified on 2026-05-31 with the local `.env` / `.env.local` values:
- `npm run qa:supabase:live`: passed.
- Proof covered two real signed-in auth sessions, RLS isolation for diagrams and telemetry, diagram save/load with `canvas_state`, `active_diagram_name`, `diagrams_set_updated_at`, the 1000-line database check, the 20-file database trigger, telemetry event/session persistence, and cleanup of disposable QA auth users.

The automated default path disables live Supabase so tests do not transmit credentials or private project data. `npm run qa:app` runs the same live contract first only when `QA_LIVE_SUPABASE=1` is present.

## Remaining Product Risks

- `App.tsx` remains a large orchestrator. The new shell components provide a safer extraction path, but a later pass should move render chunks out of `App.tsx`.
- Freeform canvas tools now have a state model and toolbar surface, but full drawing/rendering/export of every freeform element should continue in a dedicated UI pass.
- Real-time collaboration currently covers presence and the adapter shape. Concurrent source/canvas editing should be implemented with Yjs in the next phase.
- Bundle size has been partially addressed with lazy-loaded editor, codegen, metrics, overlay, right-rail, and full-canvas chunks. Remaining bundle work should focus on a CI size budget, a bundle analyzer pass, and deferring Supabase until account/cloud flows are opened.

## Symphony Usage

```powershell
npm run symphony:check
npm run symphony:status
npm run symphony:dashboard
```

`symphony:dashboard` launches the local visual dashboard for repo tasks and runtime state. The task files live in `orchestration/tasks`.
