// ============================================================
// Isomorph — Centralized Type Definitions
// ============================================================
// All shared types, interfaces, and type aliases live here.
// Extracted from App.tsx during demonolith decomposition.
// ============================================================

import type { IOMDiagram } from '../semantics/iom.js';

/** The kind of diagram — derived from the IOM. */
export type DiagramKind = IOMDiagram['kind'];

/** Type of message arrow in a sequence diagram. */
export type SequenceMessageType = 'synchronous' | 'asynchronous' | 'response' | 'self-call';

/** A single tab in the workspace tab bar. */
export interface WorkspaceTab {
  id: string;
  name: string;
  source: string;
  activeDiagramIdx: number;
  diagramKindFilter: 'all' | DiagramKind;
  undoStack?: string[];
  redoStack?: string[];
  savedSource?: string; // Snapshot of source when tab was created/opened — used for beforeunload guard
  project_role?: 'owner' | 'editor' | 'commenter' | 'viewer' | string;
  diagram_id?: string;
  project_id?: string;
}
