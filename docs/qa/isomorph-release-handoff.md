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

## Verification Commands

```powershell
npm run typecheck
npm test -- --run
npm run build
npm run qa:app
npm run symphony:check
```

## Live Supabase QA

Use live credentials only in a user-controlled run:

```powershell
$env:QA_LIVE_SUPABASE='1'
$env:VITE_SUPABASE_URL='https://fdjbpbbxetymtaxrareg.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='...'
npm run qa:app
```

The automated default path disables live Supabase so tests do not transmit credentials or private project data.

## Remaining Product Risks

- `App.tsx` remains a large orchestrator. The new shell components provide a safer extraction path, but a later pass should move render chunks out of `App.tsx`.
- Freeform canvas tools now have a state model and toolbar surface, but full drawing/rendering/export of every freeform element should continue in a dedicated UI pass.
- Real-time collaboration currently covers presence and the adapter shape. Concurrent source/canvas editing should be implemented with Yjs in the next phase.
- Production bundle size is above Vite's default warning threshold; code-splitting CodeMirror, codegen, and Symphony/dashboard-adjacent paths would improve load time.

## Symphony Usage

```powershell
npm run symphony:check
npm run symphony:status
npm run symphony:dashboard
```

`symphony:dashboard` launches the local visual dashboard for repo tasks and runtime state. The task files live in `orchestration/tasks`.
