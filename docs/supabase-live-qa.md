# Supabase Live QA Checklist

Run this checklist locally against your own Supabase project. Do not paste project URLs, anon keys, service-role keys, database passwords, JWTs, or user credentials into issues, chats, logs, or screenshots.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` with your own project values.
3. Apply `supabase/schema.sql` in the Supabase SQL editor or your local Supabase workflow.
4. Start the app with `npm run dev`.

## Automated Live Contract

Default QA still runs without live Supabase credentials. To prove real auth, RLS, save/load, database limits, trigger behavior, and telemetry persistence, run the live contract with `QA_LIVE_SUPABASE=1`.

The repo is a Vite app, so use the `VITE_*` Supabase env names:

```bash
QA_LIVE_SUPABASE=1 \
VITE_SUPABASE_URL=... \
VITE_SUPABASE_PUBLISHABLE_KEY=... \
QA_SUPABASE_SERVICE_ROLE_KEY=... \
npm run qa:supabase:live
```

`QA_SUPABASE_SERVICE_ROLE_KEY` is optional when two disposable auth users already exist. In that case, provide their credentials instead:

```bash
QA_LIVE_SUPABASE=1 \
VITE_SUPABASE_URL=... \
VITE_SUPABASE_PUBLISHABLE_KEY=... \
QA_SUPABASE_USER_A_EMAIL=... \
QA_SUPABASE_USER_A_PASSWORD=... \
QA_SUPABASE_USER_B_EMAIL=... \
QA_SUPABASE_USER_B_PASSWORD=... \
npm run qa:supabase:live
```

For local developer convenience, the CLI runner also reads `.env` and `.env.local`. `SUPABASE_SECRET` is accepted as a local alias for `QA_SUPABASE_SERVICE_ROLE_KEY`; keep it out of logs and commits.

`npm run qa:app` also runs the same live contract first when `QA_LIVE_SUPABASE=1` is present. The runner uses the publishable key for browser-client actions, signs in as two real users, and uses the admin secret only to create/delete disposable QA users when explicit QA users are not provided. It deletes only rows whose title/route/payload starts with `ISOMORPH_QA_DO_NOT_KEEP`.

Verified on 2026-05-31 with:

```powershell
$env:QA_LIVE_SUPABASE='1'
npm run qa:supabase:live
```

Observed proof points from the live run:

- Created two disposable Supabase auth users, signed both in, and verified each produced a real session.
- Saved and loaded a diagram row with `canvas_state` and `active_diagram_name` intact.
- Proved User B could not read or update User A's diagram row through RLS.
- Updated User A's diagram and verified `diagrams_set_updated_at` advanced `updated_at`.
- Verified the database rejects sources over 1000 lines.
- Filled User A to the 20-file limit and verified the database rejects the next insert.
- Inserted and ended a telemetry session, inserted a telemetry event, and proved User B could not read either row.

## Auth State

1. Open the app without Supabase env values and confirm the app treats sync as unconfigured.
2. Open the app with env values and no user session and confirm the app treats sync as signed out.
3. Sign in and confirm the app sees a signed-in user id.
4. Sign out and confirm the state returns to signed out.

## Diagram Sync

1. Save a diagram with a blank or whitespace title and confirm the service normalizes it to `Untitled diagram`.
2. Save two new diagrams with the same title and confirm both rows exist. Duplicate titles are allowed.
3. Update a diagram by id and confirm the existing row changes instead of creating a duplicate.
4. Create 20 diagrams for one user, then attempt a 21st and confirm both the client guard and database trigger reject it.
5. Attempt to save a source file over 1000 lines and confirm the client guard and database check reject it.
6. Confirm the list view only requests bounded pages. The service default is 20 diagrams and the maximum accepted page size is 100.

## Telemetry

1. Start a telemetry session after auth state is known and keep the returned session id client-side only.
2. Trigger codegen, save, copy, paste, and export actions.
3. Confirm each inserted telemetry event includes the active session id when one exists.
4. End the telemetry session and confirm `telemetry_sessions.ended_at` is populated.
5. Confirm aggregate metrics can be computed from exported telemetry rows without needing secrets.

## RLS Smoke Test

1. User A saves a diagram and telemetry session.
2. User B signs in and confirms User A's diagrams, sessions, and events are not visible.
3. User B attempts to update User A's diagram id through the browser client and confirms RLS rejects it.

