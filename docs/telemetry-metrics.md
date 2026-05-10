# Telemetry Metrics

Telemetry is append-only at the event level and grouped by `telemetry_sessions.id` when a session is active. The client should start a session once auth state is known, pass the returned session id into action events, and end the session when the app closes or the user signs out.

## Session Lifecycle

- `startTelemetrySession` inserts a row in `telemetry_sessions` with user id, route, device details, and `started_at`.
- `logTelemetry` inserts action events into `telemetry_events` and stores `session_id` when provided.
- `endTelemetrySession` updates `ended_at` for the session row.

## Aggregates

`aggregateTelemetryMetrics` computes:

- Compile latency from `codegen.payload.latency_ms`.
- Save latency from `save.payload.latency_ms`.
- Generated LOC from `codegen.payload.generated_loc` or `generatedCodeLines`.
- Time split from `duration_ms` on editor and diagram interaction events.
- Copy, paste, and export counts from matching event types.

## Diagram Save Semantics

Diagram titles are normalized by the service before persistence. Blank titles become `Untitled diagram`, and duplicate titles are allowed because the stable update key is the diagram id. Passing `existingId` updates that row; omitting it creates a new row after file and line limits pass.

