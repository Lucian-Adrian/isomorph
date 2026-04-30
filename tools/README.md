# Tools Layout

This folder contains non-runtime scripts that were previously cluttering project root.

## maintenance/
Reusable helper scripts that may still be useful.

- `maintenance/debug/` parser/debug probes
- `maintenance/i18n/` canonical i18n migration helpers
- `maintenance/styling/` canonical color migration helper
- `maintenance/utils/` small reusable extraction utilities

## archive/
Legacy one-off scripts, experimental variants, and temporary helpers kept for historical reference.

- `archive/i18n/` older i18n migration iterations
- `archive/styling/` older styling migration iterations
- `archive/debug-tests/` regex/debug probes
- `archive/misc/` one-off mutation scripts

## Safety note
These scripts are not part of runtime, build, or test pipelines.
Run them manually and review diffs before applying in active branches.
