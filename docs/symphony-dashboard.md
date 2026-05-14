# Symphony Dashboard

This project ships a repo-local Symphony setup with a visual dashboard and JSON runtime snapshot API.

## Why this setup is easy to reuse

- No external tracker is required for the first rollout.
- No database is required.
- No live coding-agent session is required.
- `agent.dry_run: true` keeps the system observable without mandatory LLM token spend.
- The dashboard runs from the same Symphony process, so there is no second service to maintain.

## Minimal per-repo recipe

1. Copy `symphony/`
2. Copy `WORKFLOW.md`
3. Copy `orchestration/tasks/`
4. Keep this front matter pattern:

```yaml
---
tracker:
  kind: repo-tasks
  tasks_path: orchestration/tasks
  active_states: [ready, in_progress]
  terminal_states: [done, cancelled]
polling:
  interval_ms: 30000
workspace:
  root: .worktrees/symphony
agent:
  command: codex
  dry_run: true
  timeout_ms: 3600000
orchestration:
  max_concurrent_agents: 2
  max_retries: 2
  retry_base_delay_ms: 30000
  logs_path: artifacts/qa/symphony.jsonl
server:
  port: 4318
verification:
  command: npm run verify
  required: true
handoff:
  summary_path: artifacts/qa/handoff.md
---
```

## Commands

```bash
npm run symphony:check
npm run symphony:once
npm run symphony:status
npm run symphony:dashboard
```

## What the dashboard serves

- `GET /`
  - human-readable operator dashboard
- `GET /api/v1/state`
  - current runtime snapshot
- `POST /api/v1/refresh`
  - trigger an immediate refresh/poll
- `GET /api/v1/issues/:identifier`
  - current issue-level runtime detail

## Current behavior

- The dashboard is observability-only.
- Repo tasks are loaded from YAML files.
- Runtime state is derived from the in-memory store plus structured JSONL logs.
- When `dry_run` is enabled, the dashboard still shows dispatchability, blockers, logs, and health without launching a live coding-agent run.
