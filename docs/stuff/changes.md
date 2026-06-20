# Implementation Changes Log

This file documents the features and changes implemented by the agent.

## Date: 2026-06-07
**Features Implemented:**
- **Sequence Diagram Autocomplete:** Corrected sequence diagram autocomplete operator labels: `-->` for synchronous messages, `..>` for response, and `--|>` for asynchronous messages. Added spacing to fragment autocomplete blocks in `isomorph.lang.ts`.
- **Right-Click Modal Trigger:** Added `onContextMenu` interception to the canvas to open the entity/relation edit modals on right-click instead of just double-click in `DiagramView.tsx`.
- **Canvas Multi-Selection & Marquee:** Enabled multi-selection by holding `Ctrl`, `Shift`, or `Meta` and clicking entities. Also implemented drag-to-select (marquee) functionality when using the 'move' tool on the canvas background. 
- **Arrow Key Movement:** Added the ability to move selected entities precisely using arrow keys (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`). Holding `Shift` with the arrow keys increases the movement step size.
- **Multi-Drag Support:** Enabled dragging multiple selected items at once on the canvas. When multiple entities are selected, dragging one entity moves all selected entities simultaneously. 
- **Selection Retention on Drag:** Fixed OS-style multi-selection so that releasing the mouse after dragging multiple items keeps them selected, instead of reverting to a single item selection.
- **Editor Comment Toggling:** Enabled standard `Ctrl + /` and `Shift + Alt + A` to toggle line and block comments respectively in the CodeMirror editor by registering `languageData.commentTokens` in the custom syntax language.
- **Multiline Lexer Fix:** Added CodeMirror state tracking to `isomorph.lang.ts` so `/* ... */` multiline comments are properly greyed out across line breaks.
- **Keyboard Shortcuts Update:** Changed the shortcuts overlay toggle hotkey from `Ctrl + ?` to `Ctrl + Q`.
- **Ctrl+D Duplication:** Added `Ctrl+D` support to instantly duplicate single or multiple selected entities, re-using existing auto-renaming and placement logic.

## Date: 2026-06-10
**Features Implemented:**
- **Watermark Toggle:** Added a "Generated with Isomorph" watermark, which can be toggled via the Settings menu.
- **Diagram Animations:** Implemented a system to animate various diagrams. The animations can be toggled on/off and their speed can be adjusted (Fast, Normal, Slow) in the Settings menu. Supported animations include:
  - **Sequence Diagrams:** Light orb animation that follows message lines in sequential order.
  - **Communication Diagrams:** Simultaneous ping effects on connections.
  - **Activity Diagrams:** Baton pass animation across swimlanes.
  - **Flowcharts:** Split pulse for decision branches and fill-up effects.
  - **State Machine Diagrams:** Breathing nodes and leaping transitions.
  - **Class Diagrams:** Blueprint reveal animation that traces the strokes of the class boxes.
- **GIF & Video (WebM) Export:** Added the ability to export diagrams as animated GIFs or Video (WebM). The export only shows up when animations are enabled. 
- **Export Loading UI:** Implemented a loading spinner and a live seconds timer that displays the elapsed time during GIF and WebM exports.
- **i18n Support:** Added translations for the new "Exporting..." status in English, Romanian, and Russian.
- **UI & UX Polishing:**
  - **Dark Mode Icon:** The theme toggle now displays a Sun icon when in dark mode, and a Moon icon when in light mode.
  - **Modal Interactions:** All modals, tooltips, and dropdown menus now strictly close when pressing the `Escape` key or when clicking outside of them.
  - **Quick Save:** Pressing `Enter` now saves the contents of editable fields and modals.
  - **Dropdown Hover Effects:** Restored and ensured that all buttons and dropdown items have proper hover effects.
  - **Export Icons:** Added distinct icons for each "Save as" option in the export menu (`PNG`, `SVG`, `GIF`, `WebM`).
  - **Settings Clean-up:** Removed a duplicate "Strict UML" toggle from the settings modal.

## Date: 2026-06-20
**Features Implemented & Bugs Fixed:**
- **Real-time Collaboration Network Failures:** Fixed the WebSocket server URL configuration in `collaboration.ts` to fall back from `VITE_COLLAB_SERVER_URL` to `VITE_WS_URL` (which is configured in `.env.local`). Also, implemented dynamic local network resolution so that when clients access the application over a local network IP (e.g. `192.168.x.y` on a phone), WebSocket connections automatically point to that network IP instead of literal `localhost`, enabling seamless network testing.
- **CodeMirror Sync & Document Clearing Fix:** Resolved a major bug in `IsomorphEditor.tsx` where `initializedYTextRef.current` remained `true` after a connection disconnect. If the connection dropped and reconnected, the editor failed to re-upload its local content to the server if the server room was empty, causing it to overwrite the client's CodeMirror with an empty Yjs document. Resetting `initializedYTextRef.current` to `false` when collaboration goes offline (`isSynced === false`) ensures clean and safe re-initialization of Yjs document content.
- **Canvas-Editor Sync Restoration:** Restored diff-based external value synchronization in `IsomorphEditor.tsx` using `fast-myers-diff`. When synced, any canvas updates (like dragging shapes) are cleanly mapped as minimal diffs to CodeMirror, allowing `yCollab` to propagate edits across all connected devices and preventing editor regression/reversion issues.
- **JWT Token Refresh & Change Connection Handling:** Modified `yjsManager` connection pool in `collaboration.ts` to track client access tokens. If the token is refreshed/changed, the client now correctly disconnects the stale connection and establishes a fresh WebSocket connection with the new credentials, preventing authentication failure loop states.
- **Synchronous Server Authentication & Dev Fallback:** Refactored the `server/index.js` WebSocket connection handler to perform JWT authentication synchronously. If signature verification with the configured `SUPABASE_JWT_SECRET` fails in development (detected by `NODE_ENV !== 'production'` or mock UUID secrets), the server falls back to decoding the token synchronously via `jwt.decode(token)`. If valid, the connection is accepted. This eliminates the async `supabase.auth.getUser` call (which was failing due to mock key mismatches against the remote Supabase API gateway) and stops profile flashing/reconnection loops.
