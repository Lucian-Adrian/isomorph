// ============================================================
// Isomorph — Keyboard Shortcuts Hook
// ============================================================
// Registers keyboard event listeners for workspace actions.
// Extracted from App.tsx during demonolith decomposition.
// ============================================================

import { useEffect } from 'react';
import type { WorkspaceTab } from '../types/index.js';
import { removeEntityDeclaration, insertBeforeAnnotations, escapeRegex, extractEntityDeclaration } from '../utils/source-manipulation.js';
import { formatDiagramSource } from '../utils/formatting.js';
import { ENTITY_KINDS_RX } from '../constants.js';

interface KeyboardShortcutsOptions {
  activeTab: WorkspaceTab | null;
  activeDiagram: any;
  selectedItems: { type: 'entity' | 'relation'; id: string }[];
  setSelectedItems: (items: any[]) => void;
  updateActiveTab: (updater: (tab: WorkspaceTab) => WorkspaceTab, sync?: boolean) => void;
  addToast: (message: string, type?: 'success' | 'info') => void;
  t: (key: string, vars?: any) => string;
  pasteCounterRef: React.MutableRefObject<number>;
  handleNew: () => void;
  setIsLibraryOpen: (open: boolean) => void;
  handleSaveToCloud: () => void;
  handleExportSVG: () => void;
  handleExportPNG: () => void;
  setShortcutsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  shortcutsOpen: boolean;

  // Escape handlers
  editingEntity: any;
  setEditingEntity: (v: any) => void;
  editingRelation: any;
  setEditingRelation: (v: any) => void;
  editingText: any;
  setEditingText: (v: any) => void;
  isNewModalOpen: boolean;
  setIsNewModalOpen: (v: boolean) => void;
  setIsSavingFlow: (v: boolean) => void;
  tabToClose: any;
  setTabToClose: (v: any) => void;
  isDeleteModalOpen?: boolean;
  setIsDeleteModalOpen?: (v: boolean) => void;
  renameModalOpen: boolean;
  setRenameModalOpen: (v: boolean) => void;
  isRevertModalOpen: boolean;
  setIsRevertModalOpen: (v: boolean) => void;
  saveToCloudModalOpen: boolean;
  setSaveToCloudModalOpen: (v: boolean) => void;
  projectDetailModalOpen: boolean;
  setProjectDetailModalOpen: (v: boolean) => void;
  isHistoryOpen: boolean;
  setIsHistoryOpen: (v: boolean) => void;
  isAuthOpen: boolean;
  setIsAuthOpen: (v: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (v: boolean) => void;
  isLibraryOpen: boolean;
  exportMenuOpen: boolean;
  setExportMenuOpen: (v: boolean) => void;
}

export function useKeyboardShortcuts({
  activeTab,
  activeDiagram,
  selectedItems,
  setSelectedItems,
  updateActiveTab,
  addToast,
  t,
  pasteCounterRef,
  handleNew,
  setIsLibraryOpen,
  handleSaveToCloud,
  handleExportSVG,
  handleExportPNG,
  setShortcutsOpen,
  shortcutsOpen,
  editingEntity,
  setEditingEntity,
  editingRelation,
  setEditingRelation,
  editingText,
  setEditingText,
  isNewModalOpen,
  setIsNewModalOpen,
  setIsSavingFlow,
  tabToClose,
  setTabToClose,
  isDeleteModalOpen,
  setIsDeleteModalOpen,
  renameModalOpen,
  setRenameModalOpen,
  isRevertModalOpen,
  setIsRevertModalOpen,
  saveToCloudModalOpen,
  setSaveToCloudModalOpen,
  projectDetailModalOpen,
  setProjectDetailModalOpen,
  isHistoryOpen,
  setIsHistoryOpen,
  isAuthOpen,
  setIsAuthOpen,
  isSettingsOpen,
  setIsSettingsOpen,
  isLibraryOpen,
  exportMenuOpen,
  setExportMenuOpen,
}: KeyboardShortcutsOptions) {
  // Click listener for closing export dropdown
  useEffect(() => {
    const clickHandler = () => setExportMenuOpen(false);
    window.addEventListener('click', clickHandler);
    return () => window.removeEventListener('click', clickHandler);
  }, [setExportMenuOpen]);

  // Main canvas and clipboard operations keydown listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ae = document.activeElement;
      const isInEditor = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.closest?.('.cm-content') || ae.closest?.('.cm-editor'));
      if (isInEditor) return;

      // Deletion of selected items
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItems.length > 0) {
          updateActiveTab(tab => {
            let nextSource = tab.source;

            for (const item of selectedItems) {
              if (item.type === 'entity') {
                nextSource = removeEntityDeclaration(nextSource, item.id);
                const rxAnno = new RegExp(`^[ \\t]*@${escapeRegex(item.id)}[ \\t]+at[ \\t]*\\([^)]+\\)[ \\t]*\\n?`, 'gm');
                nextSource = nextSource.replace(rxAnno, '');
                const rxRel = new RegExp(`^[ \\t]*(?:${escapeRegex(item.id)}[ \\t]+(?:--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|<\\.\\.|o--|\\*--|-->|->|\\.\\.>|--o|--\\*|--x|--)[ \\t]+[A-Za-z_][\\w]*|[A-Za-z_][\\w]*[ \\t]+(?:--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|<\\.\\.|o--|\\*--|-->|->|\\.\\.>|--o|--\\*|--x|--)[ \\t]+${escapeRegex(item.id)})(?:[ \\t]*\\[[^\\]]*\\])?[ \\t]*\\n?`, 'gm');
                nextSource = nextSource.replace(rxRel, '');
              } else if (item.type === 'relation') {
                const idxRaw = item.id.replace('rel_', '');
                const relationIdx = Number.parseInt(idxRaw, 10);
                if (Number.isInteger(relationIdx) && relationIdx >= 0) {
                  const relRegex = /^([ \t]*)([A-Za-z_][\w]*)[ \t]+(--\|>|\.\.\|>|<\|--|<\|\.\.|<\.\.|o--|\*--|-->|->|\.\.>|--o|--\\*|--x|--)[ \t]+([A-Za-z_][\w]*)([ \t]*\[[^\]]*\])?[ \t]*$/gm;
                  const matches = [...nextSource.matchAll(relRegex)];
                  const match = matches[relationIdx];
                  if (match && match.index != null) {
                    nextSource = nextSource.slice(0, match.index) + nextSource.slice(match.index + match[0].length + 1);
                  }
                }
              }
            }
            return { ...tab, source: nextSource };
          });
          setSelectedItems([]);
        }
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && !isInEditor) {
        if (e.key === 'z') {
          e.preventDefault();
          updateActiveTab(tab => {
            if (!tab.undoStack || tab.undoStack.length === 0) return tab;
            const newUndo = [...tab.undoStack];
            const previousSource = newUndo.pop()!;
            return {
              ...tab,
              source: previousSource,
              undoStack: newUndo,
              redoStack: [...(tab.redoStack || []), tab.source]
            };
          }, false);
        } else if (e.key === 'y') {
          e.preventDefault();
          updateActiveTab(tab => {
            if (!tab.redoStack || tab.redoStack.length === 0) return tab;
            const newRedo = [...tab.redoStack];
            const nextSource = newRedo.pop()!;
            return {
              ...tab,
              source: nextSource,
              undoStack: [...(tab.undoStack || []), tab.source],
              redoStack: newRedo
            };
          }, false);
        }

        // Duplicate selected items (Ctrl+D) or Copy (Ctrl+C)
        if ((e.key === 'c' || e.key === 'd') && selectedItems.length > 0 && activeDiagram) {
          e.preventDefault();
          const snippets: string[] = [];
          for (const item of selectedItems) {
            if (item.type === 'entity') {
              if (!activeDiagram.entities.has(item.id) && !activeDiagram.packages.find((p: any) => p.name === item.id)) continue;
              const extracted = extractEntityDeclaration(activeTab!.source, item.id);
              if (extracted) snippets.push(extracted.trim());
              const annoRx = new RegExp(`^\\s*@${escapeRegex(item.id)}\\s+at\\s*\\([^)]+\\)`, 'gm');
              const annoMatches = activeTab?.source.match(annoRx);
              if (annoMatches) snippets.push(...annoMatches);
            }
          }
          if (snippets.length > 0) {
            const textToCopy = snippets.join('\n');
            if (e.key === 'c') {
              navigator.clipboard.writeText(textToCopy).then(() => addToast(t('ui.copied') || 'Copied')).catch(() => { });
              pasteCounterRef.current = 1;
            } else if (e.key === 'd') {
              const doPaste = (text: string) => {
                if (!text.trim()) return;
                let pasteText = text;
                const entityNameRx = new RegExp(`${ENTITY_KINDS_RX}\\s+([A-Za-z_]\\w*)`, 'g');
                const namesToReplace = [...new Set([...pasteText.matchAll(entityNameRx)].map(m => m[1]))];

                for (const name of namesToReplace) {
                  const baseMatch = name.match(/^([A-Za-z_]+)(\d*)$/);
                  const baseStr = baseMatch ? baseMatch[1] : name;
                  let newName = baseStr + '1';
                  let i = 2;
                  const isNameTaken = (n: string) => {
                    const rx = new RegExp(`\\b${escapeRegex(n)}\\b`);
                    return rx.test(activeTab?.source || '') || rx.test(pasteText);
                  };
                  let emergencyBreak = 0;
                  while (isNameTaken(newName) && emergencyBreak < 1000) {
                    newName = baseStr + i;
                    i++;
                    emergencyBreak++;
                  }
                  pasteText = pasteText.replace(new RegExp(`\\b${escapeRegex(name)}\\b`, 'g'), newName);
                }
                pasteText = pasteText.replace(/@(\w+)\s+at\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)?\s*\)/g, (_, n, x, y, sizeSuffix) => {
                  const offset = 40 * pasteCounterRef.current;
                  return `@${n} at (${Math.round(parseFloat(x) + offset)}, ${Math.round(parseFloat(y) + offset)}${sizeSuffix || ''})`;
                });
                pasteCounterRef.current++;
                updateActiveTab(tab => {
                  let src = insertBeforeAnnotations(tab.source, pasteText.trim());
                  src = formatDiagramSource(src);
                  return { ...tab, source: src };
                });
              };
              doPaste(textToCopy);
            }
          }
        }

        // Paste from clipboard
        if (e.key === 'v') {
          e.preventDefault();
          navigator.clipboard.readText().then(text => {
            if (!text.trim()) return;
            let pasteText = text;
            const entityNameRx = new RegExp(`${ENTITY_KINDS_RX}\\s+([A-Za-z_]\\w*)`, 'g');
            const namesToReplace = [...new Set([...pasteText.matchAll(entityNameRx)].map(m => m[1]))];

            for (const name of namesToReplace) {
              const baseMatch = name.match(/^([A-Za-z_]+)(\d*)$/);
              const baseStr = baseMatch ? baseMatch[1] : name;
              let newName = baseStr + '1';
              let i = 2;
              const isNameTaken = (n: string) => {
                const rx = new RegExp(`\\b${escapeRegex(n)}\\b`);
                return rx.test(activeTab?.source || '') || rx.test(pasteText);
              };
              let emergencyBreak = 0;
              while (isNameTaken(newName) && emergencyBreak < 1000) {
                newName = baseStr + i;
                i++;
                emergencyBreak++;
              }
              pasteText = pasteText.replace(new RegExp(`\\b${escapeRegex(name)}\\b`, 'g'), newName);
            }
            pasteText = pasteText.replace(/@(\w+)\s+at\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)?\s*\)/g, (_, n, x, y, sizeSuffix) => {
              const offset = 40 * pasteCounterRef.current;
              return `@${n} at (${Math.round(parseFloat(x) + offset)}, ${Math.round(parseFloat(y) + offset)}${sizeSuffix || ''})`;
            });
            pasteCounterRef.current++;
            updateActiveTab(tab => {
              let src = insertBeforeAnnotations(tab.source, pasteText.trim());
              src = formatDiagramSource(src);
              return { ...tab, source: src };
            });
          }).catch(() => { });
        }

        // Cut selected items
        if (e.key === 'x' && selectedItems.length > 0 && activeDiagram) {
          e.preventDefault();
          const snippets: string[] = [];

          updateActiveTab(tab => {
            let nextSource = tab.source;
            for (const item of selectedItems) {
              if (item.type === 'entity') {
                if (!activeDiagram.entities.has(item.id) && !activeDiagram.packages.find((p: any) => p.name === item.id)) continue;
                const extracted = extractEntityDeclaration(nextSource, item.id);
                if (extracted) snippets.push(extracted.trim());
                nextSource = removeEntityDeclaration(nextSource, item.id);
                const annoRx = new RegExp(`^[ \\t]*@${escapeRegex(item.id)}[ \\t]+at[ \\t]*\\([^)]+\\)[ \\t]*\\n?`, 'gm');
                const annoMatches = nextSource.match(annoRx);
                if (annoMatches) snippets.push(...annoMatches.map(s => s.trim()));
                nextSource = nextSource.replace(annoRx, '');
                const rxRel = new RegExp(`^[ \\t]*(?:${escapeRegex(item.id)}[ \\t]+(?:--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|<\\.\\.|o--|\\*--|-->|->|\\.\\.>|--o|--\\*|--x|--)[ \\t]+[A-Za-z_][\\w]*|[A-Za-z_][\\w]*[ \\t]+(?:--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|<\\.\\.|o--|\\*--|-->|->|\\.\\.>|--o|--\\*|--x|--)[ \\t]+${escapeRegex(item.id)})(?:[ \\t]*\\[[^\\]]*\\])?[ \\t]*\\n?`, 'gm');
                nextSource = nextSource.replace(rxRel, '');
              }
            }
            if (snippets.length > 0) {
              navigator.clipboard.writeText(snippets.join('\n')).then(() => addToast(t('ui.copied') || 'Copied')).catch(() => { });
            }
            return { ...tab, source: nextSource };
          });
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedItems, updateActiveTab, activeDiagram, activeTab, addToast, t, pasteCounterRef]);

  // Secondary keydown listener for Escape and global modifiers (Ctrl+S, Ctrl+N, Ctrl+O, etc.)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ae = document.activeElement;
      const isInInput = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');

      if (e.key === 'Escape') {
        if (editingEntity) { setEditingEntity(null); return; }
        if (editingRelation) { setEditingRelation(null); return; }
        if (editingText) { setEditingText(null); return; }
        if (isNewModalOpen) { setIsNewModalOpen(false); setIsSavingFlow(false); return; }
        if (tabToClose) { setTabToClose(null); return; }
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
        if (isDeleteModalOpen && setIsDeleteModalOpen) { setIsDeleteModalOpen(false); return; }
        if (renameModalOpen) { setRenameModalOpen(false); return; }
        if (isRevertModalOpen) { setIsRevertModalOpen(false); return; }
        if (saveToCloudModalOpen) { setSaveToCloudModalOpen(false); return; }
        if (projectDetailModalOpen) { setProjectDetailModalOpen(false); return; }
        if (isHistoryOpen) { setIsHistoryOpen(false); return; }
        if (isAuthOpen) { setIsAuthOpen(false); return; }
        if (isSettingsOpen) { setIsSettingsOpen(false); return; }
        if (isLibraryOpen) { setIsLibraryOpen(false); return; }
        if (exportMenuOpen) { setExportMenuOpen(false); return; }
      }

      if (isInInput) return;
      if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
        if (!activeTab?.project_id || activeTab?.project_role === 'owner') {
          e.preventDefault();
          handleNew();
        }
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'o') {
        if (!activeTab?.project_id || activeTab?.project_role === 'owner') {
          e.preventDefault();
          setIsLibraryOpen(true);
        }
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 's') { e.preventDefault(); handleSaveToCloud(); }
      if (e.ctrlKey && !e.shiftKey && e.key === 'e') { e.preventDefault(); handleExportSVG(); }
      if (e.ctrlKey && e.shiftKey && e.key === 'E') { e.preventDefault(); handleExportPNG(); }
      if (e.ctrlKey && e.key === 'q') { e.preventDefault(); setShortcutsOpen(o => !o); }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    handleNew,
    handleExportSVG,
    handleExportPNG,
    handleSaveToCloud,
    setShortcutsOpen,
    shortcutsOpen,
    editingEntity,
    setEditingEntity,
    editingRelation,
    setEditingRelation,
    editingText,
    setEditingText,
    isNewModalOpen,
    setIsNewModalOpen,
    setIsSavingFlow,
    tabToClose,
    setTabToClose,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    renameModalOpen,
    setRenameModalOpen,
    isRevertModalOpen,
    setIsRevertModalOpen,
    saveToCloudModalOpen,
    setSaveToCloudModalOpen,
    projectDetailModalOpen,
    setProjectDetailModalOpen,
    isHistoryOpen,
    setIsHistoryOpen,
    isAuthOpen,
    setIsAuthOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isLibraryOpen,
    exportMenuOpen,
    setExportMenuOpen,
    activeTab,
  ]);
}
