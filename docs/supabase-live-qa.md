# Supabase Live QA Checklist

Run this checklist locally against your own Supabase project. Do not paste project URLs, anon keys, service-role keys, database passwords, JWTs, or user credentials into issues, chats, logs, or screenshots.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` with your own project values.
3. Apply `supabase/schema.sql` in the Supabase SQL editor or your local Supabase workflow.
4. Start the app with `npm run dev`.

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

