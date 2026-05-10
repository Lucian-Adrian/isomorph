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
verification:
  command: npm run verify
  required: true
handoff:
  summary_path: artifacts/qa/handoff.md
---
# Isomorph Symphony Workflow

Implement `{{issue.identifier}}`: `{{issue.title}}`.

Use the issue description as the scope boundary. Work only inside the issue's branch/workspace. Follow `AGENTS.md`: make minimal targeted edits, add tests where feasible, run verification, and stop with a concise handoff.

Do not transmit user credentials. Live Supabase QA is user-run unless disposable test credentials are explicitly provided and confirmed at action time.
