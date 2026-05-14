# Isomorph UX Contract

Isomorph is organized around two work modes, not one overloaded screen.

## IDE Mode

IDE Mode is for exact semantic work:

- edit `.isx` source;
- validate and inspect semantic problems;
- view the synchronized UML diagram;
- generate Python or Java boilerplate from the parsed AST/IOM;
- save, load, sync, and report project metrics.

The IDE shell separates work by intent:

- source controls stay near the editor;
- diagram creation and properties stay in the right rail beside the diagram;
- account, cloud files, code generation, and metrics open only when requested;
- status is shown as compact pills rather than a permanent footer strip.

## Canvas Mode

Canvas Mode is for spatial modeling:

- edge-to-edge canvas;
- floating toolbar and status controls;
- no IDE top menu, footer, source editor, or permanent sidebars;
- contextual style controls only when a tool or selection needs them.

The canvas may contain semantic UML objects and freeform objects. Semantic operations can update `.isx`. Freeform objects are stored in `canvas_state`.

## State Ownership

`.isx` remains the strict source of truth for the formal diagram. `canvas_state` stores viewport data, freeform drawing objects, selection/style state, unresolved drafts, and future collaboration metadata. Telemetry stores action metadata and latency/productivity measures, not passwords or private source text.

## Collaboration Direction

The first real-time layer uses Supabase Presence for cursors, avatars, active mode, and selected object identifiers. Broadcast can carry temporary interactions. Saved snapshots stay in Supabase tables. Yjs is the next layer for true concurrent text and canvas editing.
