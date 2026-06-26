// ============================================================
// Isomorph — Workspace State Hook
// ============================================================
// Manages workspace tabs, active tab, and renaming states.
// Extracted from App.tsx during demonolith decomposition.
// ============================================================

import { useState } from 'react';
import type { WorkspaceTab, DiagramKind } from '../types/index.js';

export function useWorkspace() {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [newDiagramKind, setNewDiagramKind] = useState<DiagramKind>('class');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [tabToClose, setTabToClose] = useState<string | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    newDiagramKind,
    setNewDiagramKind,
    isNewModalOpen,
    setIsNewModalOpen,
    tabToClose,
    setTabToClose,
    renamingTabId,
    setRenamingTabId,
  };
}
