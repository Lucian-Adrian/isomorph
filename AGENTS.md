# Agent TODO Operating Instructions

## Mission
Use this file as the primary execution contract for implementing and closing items from TODO.md and ROADMAP.md safely, incrementally, and verifiably.

## Workflow Rules
- Work in small batches, starting from highest-priority unchecked items (typically P0 first).
- Before each batch:
  - confirm scope (what items are included),
  - identify code touch points,
  - identify expected risks and rollback-safe strategy.
- After each batch:
  - run verification (tests + build + static checks),
  - summarize what changed and why,
  - provide manual test steps,
  - wait for user green light before starting next batch.

## Bug Intake Rule (From User Reports)
When a bug is reported in chat:
- Reproduce/analyze against code paths.
- Document it in TODO.md with:
  - observed behavior,
  - code-level root cause,
  - scope/impact,
  - concrete fix tasks,
  - test/verification criteria.
- If docs are impacted, update ROADMAP.md and relevant docs references.

## Implementation Safety Rules
- Prefer minimal, targeted changes over broad refactors.
- Preserve existing design language (UI style, spacing, controls, visual patterns).
- Preserve dark/light theme compatibility from day 1 for all new/changed UI.
- Preserve i18n compatibility from day 1 for EN/RO/RU (no hardcoded visible strings).
- Keep behavior backward-compatible unless explicitly approved otherwise.
- Avoid deleting existing functionality while fixing another issue.

## Verification Gate (Mandatory)
For each implementation batch:
1. Add/update tests where feasible (unit/integration/renderer/semantics).
2. Run existing test suite and ensure old tests still pass.
3. Run build/type checks.
4. Validate with manual UI steps for interactive changes.
5. Report:
  - changed files,
  - test/build results,
  - manual test checklist,
  - known limitations (if any).

## User-Controlled Progression
- Stop after each verified batch.
- Wait for explicit user green light before proceeding to next set of fixes/features.
- Do not silently start the next milestone.

## Documentation Contract
Any new feature/fix must include documentation updates when applicable:
- TODO.md status/checklist updates,
- ROADMAP.md scope/status updates,
- diagram-specific docs updates if user-visible behavior changed,
- examples/tests updated for parity.

- Keep verification strict: old + new tests, build pass, and manual test instructions after each batch.
