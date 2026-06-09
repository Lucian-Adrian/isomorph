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
