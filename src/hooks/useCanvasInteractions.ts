// ============================================================
// Isomorph — Canvas Interactions Hook
// ============================================================
// Manages logic for dragging/moving entities, auto-layout,
// resizing, entity editing request/submission, notes,
// diagram deletion, and file/cloud persistence workflows.
// Extracted from App.tsx during demonolith decomposition.
// ============================================================

import { useCallback } from 'react';
import type { WorkspaceTab, DiagramKind, SequenceMessageType } from '../types/index.js';
import type { IOMDiagram, IOMEntity } from '../semantics/iom.js';
import {
  slugId,
  escapeRegex,
  inferSequenceMessageType,
  findDiagramBlock,
  insertBeforeAnnotations,
  insertIntoPackage,
  insertRelation,
  insertAtEnd,
  updateEntityPosition,
  removeLayoutAnnotation,
  updateRelationVerticalPosition,
  updateRelationVerticalPositions,
  updateRelationById,
  hasEntityDeclaration,
  ensureUseCaseBoundaryDeclaration,
  extractEntityBody,
  extractEntityDeclaration,
  replaceEntityBody,
  entitySupportsBody,
  updateEntityDeclaration,
  normalizePartitionDeclaration,
  normalizeBoundaryDeclaration,
} from '../utils/source-manipulation.js';
import { parse } from '../parser/index.js';
import { computeLayout } from '../utils/auto-layout.js';
import { logEvent } from '../lib/telemetry.js';
import { exportSVG, exportPNG } from '../utils/exporter.js';
import { templateFor } from '../utils/templates.js';
import type { Project, DiagramHistory } from '../lib/projects.js';
import { getDiagramHistory, deleteDiagramHistoryAfter } from '../lib/projects.js';
import type { Language } from '../i18n.js';
import { ENTITY_KINDS_RX } from '../constants.js';

interface CanvasInteractionsOptions {
  activeTab: WorkspaceTab | null;
  activeDiagram: IOMDiagram | null;
  diagrams: IOMDiagram[];
  tabs: WorkspaceTab[];
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  updateActiveTab: (update: (tab: WorkspaceTab) => WorkspaceTab, saveHistory?: boolean) => void;
  pasteCounterRef: React.MutableRefObject<number>;
  selectedItems: { type: 'entity' | 'relation'; id: string }[];
  setSelectedItems: React.Dispatch<React.SetStateAction<{ type: 'entity' | 'relation'; id: string }[]>>;
  addToast: (message: string, type?: 'success' | 'info') => void;
  t: (key: string, vars?: any) => string;
  language: Language;
  isUMLCompliant: boolean;
  isAnimationsEnabled: boolean;
  isWatermarkEnabled: boolean;
  animationSpeed: number;
  user: any;
  setAuthMode: (mode: 'login' | 'register') => void;
  setIsAuthOpen: (open: boolean) => void;
  isNewModalOpen: boolean;
  setIsNewModalOpen: (open: boolean) => void;
  isSavingFlow: boolean;
  setIsSavingFlow: (v: boolean) => void;
  newDiagramKind: DiagramKind;
  setNewProjectName: (name: string) => void;
  setNewProjectError: (err: string) => void;
  isCreatingProject: boolean;
  setIsCreatingProject: (v: boolean) => void;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  newModalTab: 'tab' | 'project';
  selectedProjectId: string;
  isSavingToCloud: boolean;
  setIsSavingToCloud: (v: boolean) => void;
  saveToCloudModalOpen: boolean;
  setSaveToCloudModalOpen: (open: boolean) => void;
  setIsExporting: (v: boolean) => void;
  setExportTime: React.Dispatch<React.SetStateAction<number>>;
  setEditingEntity: React.Dispatch<React.SetStateAction<any>>;
  setEditingRelation: React.Dispatch<React.SetStateAction<any>>;
  setEditingText: React.Dispatch<React.SetStateAction<any>>;
  editingEntity: any;
  editingRelation: any;
  editingText: any;
  tabToClose: string | null;
  setTabToClose: React.Dispatch<React.SetStateAction<string | null>>;
  setProjectDetailDiagrams: React.Dispatch<React.SetStateAction<any[]>>;
  setDiagramToDelete: React.Dispatch<React.SetStateAction<any>>;
  diagramToDelete: any;
  allErrors: string[];
  isMobileLayout: boolean;
  setMobilePane: (pane: 'code' | 'diagram') => void;
  setPendingMobileDropKeyword: (kw: string | null) => void;
  setDiagramHistoryList: React.Dispatch<React.SetStateAction<DiagramHistory[]>>;
  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;
  selectedHistoryId: string | null;
  setSelectedHistoryId: (id: string | null) => void;
  selectedHistoryItem: DiagramHistory | undefined;
  setIsRevertModalOpen: (open: boolean) => void;
  diagramHistoryList: DiagramHistory[];
  displaySource: string;
  formatDiagramSource: (source: string) => string;
  sequenceToCollaborationSource: (diagram: IOMDiagram) => string;
  setProjectDetailModalOpen: (open: boolean) => void;
  projectDetailProject: Project | null;
  isLoadingProjectDetail: boolean;
  projectDetailDiagrams: any[];
  projectDetailAccessMap: { base: string; diagrams: Record<string, string> };
}

export function useCanvasInteractions(options: CanvasInteractionsOptions) {
  const {
    activeTab,
    activeDiagram,
    setTabs,
    activeTabId,
    setActiveTabId,
    updateActiveTab,
    pasteCounterRef,
    setSelectedItems,
    addToast,
    t,
    isWatermarkEnabled,
    animationSpeed,
    user,
    setAuthMode,
    setIsAuthOpen,
    selectedProjectId,
    isSavingToCloud,
    setIsSavingToCloud,
    setSaveToCloudModalOpen,
    setIsExporting,
    setExportTime,
    setEditingEntity,
    setEditingRelation,
    setEditingText,
    setProjectDetailDiagrams,
    setDiagramToDelete,
    diagramToDelete,
    allErrors,
    isMobileLayout,
    setMobilePane,
    setPendingMobileDropKeyword,
    setDiagramHistoryList,
    isHistoryOpen,
    setIsHistoryOpen,
    selectedHistoryItem,
    setIsNewModalOpen,
    setSelectedHistoryId,
    setIsRevertModalOpen,
    formatDiagramSource,
    sequenceToCollaborationSource,
  } = options;

  const getPlacedItemPosition = useCallback(
    (name: string) => {
      const partitionPos = activeDiagram?.partitions.find((p) => p.name === name)?.position;
      if (partitionPos) return partitionPos;
      const fragmentPos = activeDiagram?.fragments?.find((f) => f.id === name)?.position;
      if (fragmentPos) return fragmentPos;
      return activeDiagram?.entities.get(name)?.position;
    },
    [activeDiagram],
  );

  // ── Bidirectional: drag entity → update @Entity at ───────
  const handleEntityMove = useCallback(
    (
      name: string,
      x: number,
      y: number,
      dragDx?: number,
      dragDy?: number,
      seedPositions?: Record<string, { x: number; y: number; w?: number; h?: number }>,
    ) => {
      updateActiveTab((tab) => {
        let src = tab.source;

        if (seedPositions) {
          for (const [entityName, pos] of Object.entries(seedPositions)) {
            const current = getPlacedItemPosition(entityName);
            if (!current) continue;
            src = updateEntityPosition(
              src,
              entityName,
              Math.round(pos.x),
              Math.round(pos.y),
              Number.isFinite(pos.w) ? Math.round(pos.w as number) : current?.w,
              Number.isFinite(pos.h) ? Math.round(pos.h as number) : current?.h,
            );
          }
        }

        if (activeDiagram) {
          const pkg = activeDiagram.packages.find((p) => p.name === name);
          if (pkg) {
            const dx = dragDx ?? 0;
            const dy = dragDy ?? 0;

            // Compute final package position from IOM annotation + cursor delta
            const oldPkgX = pkg.position?.x ?? 100;
            const oldPkgY = pkg.position?.y ?? 100;
            const newPkgX = Math.round(oldPkgX + dx);
            const newPkgY = Math.round(oldPkgY + dy);
            const pkgW = pkg.position?.w;
            const pkgH = pkg.position?.h;
            src = updateEntityPosition(src, name, newPkgX, newPkgY, pkgW, pkgH);

            // Shift all nested entities by the same cursor delta
            if (dx !== 0 || dy !== 0) {
              for (const eName of pkg.entityNames) {
                const ent = activeDiagram.entities.get(eName);
                if (ent && ent.position) {
                  src = updateEntityPosition(
                    src,
                    eName,
                    Math.round(ent.position.x + dx),
                    Math.round(ent.position.y + dy),
                    ent.position.w,
                    ent.position.h,
                  );
                }
              }
            }
            return { ...tab, source: formatDiagramSource(src) };
          }
        }
        let targetName = name;
        if (activeDiagram?.kind === 'usecase' && !activeDiagram.entities.has(name)) {
          const promoted = ensureUseCaseBoundaryDeclaration(src, name);
          src = removeLayoutAnnotation(promoted.source, name);
          targetName = promoted.name;
        }

        const moved = seedPositions?.[name];
        const movedW = Number.isFinite(moved?.w) ? Math.round(moved!.w as number) : getPlacedItemPosition(name)?.w;
        const movedH = Number.isFinite(moved?.h) ? Math.round(moved!.h as number) : getPlacedItemPosition(name)?.h;

        return {
          ...tab,
          source: formatDiagramSource(updateEntityPosition(src, targetName, x, y, movedW, movedH)),
        };
      });
    },
    [updateActiveTab, activeDiagram, getPlacedItemPosition, formatDiagramSource],
  );

  const handleEntityResize = useCallback(
    (name: string, w: number, h: number, x?: number, y?: number) => {
      updateActiveTab((tab) => {
        let src = tab.source;
        let targetName = name;

        if (activeDiagram?.kind === 'usecase' && !activeDiagram.entities.has(name)) {
          const promoted = ensureUseCaseBoundaryDeclaration(src, name);
          src = removeLayoutAnnotation(promoted.source, name);
          targetName = promoted.name;
        }

        const current = getPlacedItemPosition(name);
        const resizeX = Number.isFinite(x) ? Math.round(x as number) : Math.round(current?.x ?? 40);
        const resizeY = Number.isFinite(y) ? Math.round(y as number) : Math.round(current?.y ?? 40);
        return {
          ...tab,
          source: formatDiagramSource(
            updateEntityPosition(src, targetName, resizeX, resizeY, Math.round(w), Math.round(h)),
          ),
        };
      });
    },
    [updateActiveTab, getPlacedItemPosition, activeDiagram, formatDiagramSource],
  );

  const handleRelationVerticalMove = useCallback(
    (relationId: string, y: number, seedRelationYs?: Record<string, number>) => {
      updateActiveTab((tab) => {
        let src = tab.source;
        if (seedRelationYs && Object.keys(seedRelationYs).length > 0) {
          src = updateRelationVerticalPositions(src, seedRelationYs);
        }
        src = updateRelationVerticalPosition(src, relationId, y);
        return { ...tab, source: formatDiagramSource(src) };
      });
    },
    [updateActiveTab, formatDiagramSource],
  );

  const handleCopyErrors = useCallback(async () => {
    if (allErrors.length === 0) return;
    const text = allErrors.join('\n');
    let copied = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', 'true');
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        copied = document.execCommand('copy');
        document.body.removeChild(area);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      addToast(t('ui.copied') || 'Copied');
    }
  }, [allErrors, addToast, t]);

  const handleEntityEditRequest = useCallback(
    (entity: IOMEntity) => {
      let body = '';
      if (activeTab) {
        body = extractEntityBody(activeTab.source, entity.name) ?? '';
      }
      // Strip leading uniform indentation and tabs from body for display
      if (body) {
        body = body.replace(/\t/g, '  ');
        const bodyLines = body.split('\n');
        // Find minimum leading spaces
        const minIndent = bodyLines
          .filter((l) => l.trim())
          .reduce((min, l) => {
            const match = l.match(/^(\s*)/);
            return match ? Math.min(min, match[1].length) : min;
          }, Infinity);
        if (minIndent > 0 && minIndent < Infinity) {
          body = bodyLines.map((l) => l.slice(minIndent)).join('\n');
        }
      }
      setEditingEntity({ ...entity, bodyText: body, origName: entity.name });
    },
    [activeTab, setEditingEntity],
  );

  const handleRelationEditRequest = useCallback(
    (relationId: string, label: string, kind: string) => {
      const rel = activeDiagram?.relations.find((r) => r.id === relationId);
      setEditingRelation({
        relationId,
        label,
        kind,
        direction: 'forward',
        fromMult: rel?.fromMult || '',
        toMult: rel?.toMult || '',
        seqMessageType:
          activeDiagram?.kind === 'sequence' ? inferSequenceMessageType(kind, rel?.from, rel?.to) : undefined,
      });
    },
    [activeDiagram, setEditingRelation],
  );

  const handleTextRenameRequest = useCallback(
    (oldName: string, _newName: string, type: 'diagram' | 'package') => {
      setEditingText({ oldName, newName: oldName, type });
    },
    [setEditingText],
  );

  const handleRelationAddRequest = useCallback(
    (fromEntity: string, toEntity: string, y?: number) => {
      updateActiveTab((tab) => {
        const relationLine =
          activeDiagram?.kind === 'sequence' && y !== undefined
            ? `  ${fromEntity} --> ${toEntity} [y="${y}"]`
            : `  ${fromEntity} --> ${toEntity}`;
        let newSource = insertRelation(tab.source, relationLine);
        newSource = formatDiagramSource(newSource);
        return { ...tab, source: newSource };
      });
    },
    [updateActiveTab, activeDiagram, formatDiagramSource],
  );

  const handleEntityEdit = useCallback(
    (
      entityName: string,
      updates: {
        name?: string;
        stereotype?: string;
        isAbstract?: boolean;
        bodyText?: string;
        kind?: string;
        elseBlocks?: { label?: string }[];
      },
    ) => {
      updateActiveTab((tab) => {
        let sourceIn = tab.source;
        const nextName = updates.name || entityName;
        if ((updates.kind === 'system' || updates.kind === 'boundary') && !hasEntityDeclaration(sourceIn, entityName)) {
          const promoted = ensureUseCaseBoundaryDeclaration(sourceIn, nextName);
          sourceIn = removeLayoutAnnotation(promoted.source, entityName);
        }

        let source = sourceIn;
        const isFragment = ['alt', 'loop', 'opt', 'par', 'break', 'critical'].includes(updates.kind || '');
        if (isFragment) {
          try {
            const ast = parse(sourceIn);
            let foundFrag: any = null;
            let fragIndex = 0;
            const walk = (items: any[]) => {
              if (foundFrag) return;
              for (const item of items) {
                if (item.kind === 'PackageDecl') walk(item.body);
                else if (item.kind === 'FragmentDecl') {
                  const id = item.name || `frag_${fragIndex + 1}`;
                  fragIndex++;
                  if (id === entityName) {
                    foundFrag = item;
                  }
                  walk(item.body);
                  if (item.elseBlocks) {
                    for (const b of item.elseBlocks) walk(b.body);
                  }
                }
              }
            };
            walk(ast.program.diagrams[0]?.body || []);
            if (foundFrag && foundFrag.span) {
              const extractBodyTextSafe = (src: string, body: any[]) => {
                if (!body || body.length === 0) return '';
                let minStart = Infinity;
                let maxEnd = -1;
                for (const item of body) {
                  if (item.span) {
                    if (item.span.start < minStart) minStart = item.span.start;
                    if (item.span.end > maxEnd) maxEnd = item.span.end;
                  }
                }
                if (minStart === Infinity || maxEnd === -1) return '';
                return src.slice(minStart, maxEnd);
              };

              const stereo = updates.stereotype ? ` <<${updates.stereotype}>>` : '';
              let newText = `${updates.kind} ${nextName}${stereo} {\n  `;
              newText += extractBodyTextSafe(sourceIn, foundFrag.body) + '\n';
              const newElseBlocks = updates.elseBlocks || [];
              newElseBlocks.forEach((newB: any, i: number) => {
                const oldB = foundFrag.elseBlocks?.[i];
                const bodyText = oldB ? extractBodyTextSafe(sourceIn, oldB.body) : '';
                newText += `} else${newB.label ? ` <<${newB.label}>>` : ''} {\n  ${bodyText}\n`;
              });
              newText += `}`;
              source = sourceIn.slice(0, foundFrag.span.start) + newText + sourceIn.slice(foundFrag.span.end);

              if (nextName !== entityName) {
                const identPattern = new RegExp(`\\b${escapeRegex(entityName)}\\b`, 'g');
                source = source.replace(identPattern, nextName);
              }
            } else {
              source = updateEntityDeclaration(sourceIn, entityName, updates);
            }
          } catch (e) {
            source = updateEntityDeclaration(sourceIn, entityName, updates);
          }
        } else {
          source = updateEntityDeclaration(sourceIn, entityName, updates);
        }

        if (updates.kind === 'partition') {
          source = normalizePartitionDeclaration(source, updates.name || entityName);
        } else if (updates.kind === 'system' || updates.kind === 'boundary') {
          source = normalizeBoundaryDeclaration(source, updates.name || entityName, updates.kind);
        } else if (updates.bodyText !== undefined && entitySupportsBody(updates.kind)) {
          source = replaceEntityBody(source, updates.name || entityName, updates.bodyText);
        }
        source = formatDiagramSource(source);
        return { ...tab, source };
      });
      setEditingEntity(null);
    },
    [updateActiveTab, setEditingEntity, formatDiagramSource],
  );

  const handleRelationEdit = useCallback(
    (
      relationId: string,
      updates: {
        label?: string;
        kind?: string;
        direction?: 'forward' | 'reverse';
        fromMult?: string;
        toMult?: string;
        seqMessageType?: SequenceMessageType;
      },
    ) => {
      updateActiveTab((tab) => {
        let src = updateRelationById(tab.source, relationId, updates, activeDiagram?.kind);
        src = formatDiagramSource(src);
        return { ...tab, source: src };
      });
      setEditingRelation(null);
    },
    [updateActiveTab, activeDiagram, formatDiagramSource, setEditingRelation],
  );

  const handleDropEntity = useCallback(
    (keyword: string, x: number, y: number, targetPackage?: string) => {
      updateActiveTab((tab) => {
        let src = tab.source.trim();
        if (!src || src.lastIndexOf('}') < 0) {
          const dk = tab.diagramKindFilter === 'all' ? 'class' : tab.diagramKindFilter || 'class';
          src = `diagram NewDiagram : ${dk} {\n\n}\n`;
        }

        const baseName = keyword.split(' ')[0];

        let index = 1;
        const prefixName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        let name = `${prefixName}${index}`;
        while (new RegExp(`${ENTITY_KINDS_RX}[ \\t]+${name}\\b`).test(src)) {
          index++;
          name = `${prefixName}${index}`;
        }

        const BRACE_KINDS = [
          'class',
          'interface',
          'component',
          'node',
          'state',
          'usecase',
          'package',
          'composite',
          'concurrent',
          'environment',
          'artifact',
          'device',
          'enum',
          'note',
        ];
        const FRAGMENT_KINDS = ['alt', 'loop', 'opt', 'par', 'break', 'critical'];
        let declaration = `  ${keyword} ${name}`;
        if (BRACE_KINDS.includes(baseName)) {
          declaration += ' {\n\n  }';
        }

        if (FRAGMENT_KINDS.includes(baseName)) {
          if (baseName === 'alt' || baseName === 'par') {
            declaration += ' {\n    \n  } else {\n    \n  }';
          } else {
            declaration += ' {\n    \n  }';
          }
          src = insertBeforeAnnotations(src, declaration);
        } else {
          if (targetPackage) {
            src = insertIntoPackage(src, targetPackage, declaration);
          } else {
            src = insertBeforeAnnotations(src, declaration);
          }
          src = insertAtEnd(src, `  @${name} at (${Math.round(x)}, ${Math.round(y)})`);
        }
        src = formatDiagramSource(src);
        return { ...tab, source: src };
      });
    },
    [updateActiveTab, formatDiagramSource],
  );

  const handleStencilInsert = useCallback(
    (keyword: string) => {
      if (isMobileLayout) {
        setPendingMobileDropKeyword(keyword);
        setMobilePane('diagram');
        return;
      }
      const entityCount = activeDiagram?.entities.size ?? 0;
      const x = 120 + (entityCount % 4) * 110;
      const y = 110 + Math.floor(entityCount / 4) * 90;
      handleDropEntity(keyword, x, y);
      setMobilePane('diagram');
    },
    [activeDiagram, handleDropEntity, isMobileLayout, setPendingMobileDropKeyword, setMobilePane],
  );

  const handleExportSVG = useCallback(() => {
    logEvent('diagram_exported', { format: 'svg', kind: activeDiagram?.kind });
    exportSVG(activeDiagram?.name ?? 'diagram');
  }, [activeDiagram]);

  const handleExportPNG = useCallback(() => {
    logEvent('diagram_exported', { format: 'png', kind: activeDiagram?.kind });
    exportPNG(activeDiagram?.name ?? 'diagram');
  }, [activeDiagram]);

  const executeNewDiagram = useCallback(
    (kind: DiagramKind) => {
      const id = `tab-${slugId()}`;
      const src = templateFor(kind);
      logEvent('diagram_created', { kind });
      setTabs((prev) => [
        ...prev,
        {
          id,
          name: `untitled-${prev.length + 1}.isx`,
          source: src,
          savedSource: src,
          activeDiagramIdx: 0,
          diagramKindFilter: 'all',
        },
      ]);
      setActiveTabId(id);
      setIsNewModalOpen(false);
    },
    [setTabs, setActiveTabId, setIsNewModalOpen],
  );

  const handleNew = useCallback(() => {
    setIsNewModalOpen(true);
  }, [setIsNewModalOpen]);

  const handleTransformToCollaboration = useCallback(() => {
    if (!activeDiagram || activeDiagram.kind !== 'sequence') return;
    const id = `tab-${slugId()}`;
    const baseName = activeTab?.name?.replace(/\.(isx|iso|txt)$/i, '') || activeDiagram.name || 'diagram';
    const nextName = `${baseName}-collaboration.isx`;
    const transformedSource = sequenceToCollaborationSource(activeDiagram);

    setTabs((prev) => [
      ...prev,
      {
        id,
        name: nextName,
        source: transformedSource,
        savedSource: transformedSource,
        activeDiagramIdx: 0,
        diagramKindFilter: 'collaboration',
      },
    ]);
    setActiveTabId(id);
  }, [activeDiagram, activeTab?.name, setTabs, setActiveTabId, sequenceToCollaborationSource]);

  const handleFileOpen = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const text = reader.result;
          const id = `tab-${slugId()}`;
          setTabs((prev) => [
            ...prev,
            {
              id,
              name: file.name,
              source: text,
              savedSource: text,
              activeDiagramIdx: 0,
              diagramKindFilter: 'all',
            },
          ]);
          setActiveTabId(id);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [setTabs, setActiveTabId],
  );

  const handleSaveToCloudSubmit = useCallback(async (customFileName?: string) => {
    if (!selectedProjectId || !user || isSavingToCloud) return;
    setIsSavingToCloud(true);
    const saveName = (customFileName || activeTab?.name || "untitled.isx").trim();
    try {
      const { createDiagram } = await import('../lib/projects.js');
      const diagram = await createDiagram(user.id, selectedProjectId, saveName, activeDiagram?.kind || 'class', {
        source: activeTab!.source,
      });
      if (diagram) {
        updateActiveTab(
          (tab) => ({
            ...tab,
            name: saveName,
            diagram_id: diagram.id,
            project_id: selectedProjectId,
            savedSource: tab.source,
            project_role: 'owner',
          }),
          false,
        );
        setSaveToCloudModalOpen(false);
        addToast('Saved to cloud', 'success');
      }
    } catch (e: any) {
      addToast(e.message || 'Error saving to cloud', 'error');
    } finally {
      setIsSavingToCloud(false);
    }
  }, [
    user,
    selectedProjectId,
    isSavingToCloud,
    activeTab,
    activeDiagram,
    updateActiveTab,
    setSaveToCloudModalOpen,
    addToast,
  ]);

  const handleSaveToCloud = useCallback(
    async (projectName?: string) => {
      if (!user) {
        setAuthMode('login');
        setIsAuthOpen(true);
        return;
      }
      if (activeTab?.diagram_id) {
        setIsSavingToCloud(true);
        logEvent('diagram_saved', { project_id: activeTab.project_id, diagram_id: activeTab.diagram_id });
        const { updateDiagramContent, saveDiagramHistory } = await import('../lib/projects.js');
        await updateDiagramContent(activeTab.diagram_id, { source: activeTab.source });
        await saveDiagramHistory(activeTab.diagram_id, { source: activeTab.source }, user.id);
        const { logAudit } = await import('../lib/audit.js');
        await logAudit('diagram_saved', 'diagram', activeTab.diagram_id, { project_id: activeTab.project_id });
        setIsSavingToCloud(false);
        updateActiveTab((tab) => ({ ...tab, savedSource: tab.source }), false);
      } else {
        if (projectName) {
          setIsSavingToCloud(true);
          const { createProject, createDiagram } = await import('../lib/projects.js');
          const p = await createProject(user.id, projectName);
          if (p) {
            const kind =
              activeTab?.diagramKindFilter === 'all'
                ? activeDiagram?.kind || 'class'
                : activeTab?.diagramKindFilter || 'class';
            const d = await createDiagram(user.id, p.id, activeTab!.name, kind, { source: activeTab!.source });
            if (d) {
              updateActiveTab(
                (tab) => ({
                  ...tab,
                  project_id: p.id,
                  diagram_id: d.id,
                  savedSource: tab.source,
                  project_role: 'owner',
                }),
                false,
              );
              addToast('Saved to cloud');
            }
          }
          setIsSavingToCloud(false);
        } else {
          setSaveToCloudModalOpen(true);
        }
      }
    },
    [
      user,
      activeTab,
      activeDiagram,
      updateActiveTab,
      setAuthMode,
      setIsAuthOpen,
      setIsSavingToCloud,
      addToast,
      setSaveToCloudModalOpen,
    ],
  );

  const handleExportGIF = useCallback(async () => {
    if (!activeDiagram) return;
    setIsExporting(true);
    setExportTime(0);
    const timer = setInterval(() => setExportTime((t) => t + 1), 1000);
    try {
      const m = await import('../utils/exporter.js');
      await m.exportGIF(activeDiagram, activeTab?.name ? activeTab.name.replace('.isx', '') : 'diagram', {
        isWatermarkEnabled,
        animationSpeed,
      });
    } finally {
      clearInterval(timer);
      setIsExporting(false);
    }
  }, [activeDiagram, activeTab, isWatermarkEnabled, animationSpeed, setIsExporting, setExportTime]);

  const handleExportMP4 = useCallback(async () => {
    if (!activeDiagram) return;
    setIsExporting(true);
    setExportTime(0);
    const timer = setInterval(() => setExportTime((t) => t + 1), 1000);
    try {
      const m = await import('../utils/exporter.js');
      await m.exportVideo(activeDiagram, activeTab?.name ? activeTab.name.replace('.isx', '') : 'diagram', {
        isWatermarkEnabled,
        animationSpeed,
      });
    } finally {
      clearInterval(timer);
      setIsExporting(false);
    }
  }, [activeDiagram, activeTab, isWatermarkEnabled, animationSpeed, setIsExporting, setExportTime]);

  const toggleHistory = async () => {
    if (!isHistoryOpen && activeTab?.diagram_id) {
      const history = await getDiagramHistory(activeTab.diagram_id);
      setDiagramHistoryList(history);
    }
    setIsHistoryOpen(!isHistoryOpen);
  };

  const confirmRevertHistory = async () => {
    if (!selectedHistoryItem || !activeTab?.diagram_id) return;
    await deleteDiagramHistoryAfter(activeTab.diagram_id, selectedHistoryItem.created_at);
    updateActiveTab((tab) => ({ ...tab, source: selectedHistoryItem.content?.source || '' }));
    setDiagramHistoryList((prev) => prev.filter((h) => h.created_at <= selectedHistoryItem.created_at));
    setSelectedHistoryId(null);
    setIsHistoryOpen(false);
    setIsRevertModalOpen(false);
    addToast('Reverted to snapshot and deleted newer history');
  };

  const handleAddNote = useCallback(
    (_x: number, _y: number, attachToEntity?: string) => {
      if (!activeTab) return;
      updateActiveTab((tab) => {
        let src = tab.source;
        let noteIdx = 1;
        while (src.includes(`note Note${noteIdx}`)) noteIdx++;
        const noteName = `Note${noteIdx}`;
        const block = findDiagramBlock(src);
        if (block) {
          const before = src.slice(0, block.closeBrace);
          const after = src.slice(block.closeBrace);
          let extra = '';
          if (attachToEntity) {
            extra = `  ${attachToEntity} ..> ${noteName}\n`;
          }
          src = before.trimEnd() + `\n\n  note ${noteName} {\n    New note\n  }\n${extra}` + after;
        }
        return { ...tab, source: src };
      });
    },
    [activeTab, updateActiveTab],
  );

  const handleConfirmDeleteDiagram = () => {
    if (!diagramToDelete) return;
    import('../lib/projects.js').then(({ deleteDiagram }) => {
      deleteDiagram(diagramToDelete.id).then((success) => {
        if (success) {
          setProjectDetailDiagrams((prev) => prev.filter((d) => d.id !== diagramToDelete.id));
          setTabs((prev) => {
            const next = prev.filter((t) => t.diagram_id !== diagramToDelete.id);
            if (activeTabId === diagramToDelete.id) {
              setActiveTabId(next[Math.max(0, next.length - 1)]?.id ?? '');
            }
            return next;
          });
          addToast('Diagram deleted');
        } else {
          addToast('Failed to delete diagram', 'info');
        }
        setDiagramToDelete(null);
      });
    });
  };

  const downloadDiagramFile = (diagram: any) => {
    if (!diagram) return;
    const content = diagram.content as any;
    const sourceText = typeof content === 'string' ? content : content?.source || '';
    const blob = new Blob([sourceText], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = diagram.name.endsWith('.isx') ? diagram.name : `${diagram.name}.isx`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Diagram downloaded');
  };

  const handleAutoLayout = useCallback(
    (mode: 'left-right' | 'snowflake' | 'compact') => {
      if (!activeDiagram || !activeTab) return;
      const entities = [...activeDiagram.entities.values()];
      if (entities.length === 0) return;

      const layoutEntities = entities.map((e) => ({ name: e.name }));
      const layoutRelations = activeDiagram.relations.map((r) => ({ from: r.from, to: r.to }));
      const { positions } = computeLayout(mode, layoutEntities, layoutRelations);

      updateActiveTab((tab) => {
        let src = tab.source;
        src = src.replace(/^\s*@\w+\s+at\s*\([^)]+\)\s*$/gm, '');
        src = src.replace(/\n{3,}/g, '\n\n');
        const annotations = [...positions.entries()]
          .map(([name, pos]) => `  @${name} at (${pos.x}, ${pos.y})`)
          .join('\n');
        const block = findDiagramBlock(src);
        if (block) {
          const before = src.slice(0, block.closeBrace);
          const after = src.slice(block.closeBrace);
          src = before.trimEnd() + '\n\n' + annotations + '\n' + after;
        }
        return { ...tab, source: src };
      });
    },
    [activeDiagram, activeTab, updateActiveTab],
  );

  const handleContextEntityDelete = useCallback(
    (entityName: string) => {
      if (!activeTab) return;
      updateActiveTab((tab) => {
        let src = tab.source;
        const extracted = extractEntityDeclaration(src, entityName);
        if (extracted) {
          src = src.replace(extracted, '');
        }
        const annoRx = new RegExp(`^\\s*@${escapeRegex(entityName)}\\s+at\\s*\\([^)]+\\)\\s*$`, 'gm');
        src = src.replace(annoRx, '');
        const relRx = new RegExp(
          `^\\s*${escapeRegex(entityName)}\\s+(?:--|\\.\\.)[^\\n]*$|^\\s*\\S+\\s+(?:--|\\.\\.)[^\\n]*${escapeRegex(entityName)}[^\\n]*$`,
          'gm',
        );
        src = src.replace(relRx, '');
        src = src.replace(/\n{3,}/g, '\n\n');
        return { ...tab, source: src };
      });
      setSelectedItems((prev) => prev.filter((i) => i.id !== entityName));
    },
    [activeTab, updateActiveTab, setSelectedItems],
  );

  const handleContextEntityDuplicate = useCallback(
    (entityName: string) => {
      if (!activeTab || !activeDiagram) return;
      const snippets: string[] = [];
      const extracted = extractEntityDeclaration(activeTab.source, entityName);
      if (extracted) snippets.push(extracted.trim());
      const annoRx = new RegExp(`^\\s*@${escapeRegex(entityName)}\\s+at\\s*\\([^)]+\\)`, 'gm');
      const annoMatches = activeTab.source.match(annoRx);
      if (annoMatches) snippets.push(...annoMatches);
      if (snippets.length === 0) return;

      let pasteText = snippets.join('\n');
      const entityNameRx = new RegExp(`${ENTITY_KINDS_RX}\\s+([A-Za-z_]\\w*)`, 'g');
      const namesToReplace = [...new Set([...pasteText.matchAll(entityNameRx)].map((m) => m[1]))];
      for (const name of namesToReplace) {
        const baseMatch = name.match(/^([A-Za-z_]+)(\d*)$/);
        const baseStr = baseMatch ? baseMatch[1] : name;
        let newName = baseStr + '1';
        let i = 2;
        const isNameTaken = (n: string) => {
          const rx = new RegExp(`\\b${escapeRegex(n)}\\b`);
          return rx.test(activeTab.source) || rx.test(pasteText);
        };
        let emergencyBreak = 0;
        while (isNameTaken(newName) && emergencyBreak < 1000) {
          newName = baseStr + i;
          i++;
          emergencyBreak++;
        }
        pasteText = pasteText.replace(new RegExp(`\\b${escapeRegex(name)}\\b`, 'g'), newName);
      }
      pasteText = pasteText.replace(
        /@(\w+)\s+at\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)?\s*\)/g,
        (_, n, x, y, sizeSuffix) => {
          const offset = 40 * pasteCounterRef.current;
          return `@${n} at (${Math.round(parseFloat(x) + offset)}, ${Math.round(parseFloat(y) + offset)}${sizeSuffix || ''})`;
        },
      );
      pasteCounterRef.current++;
      updateActiveTab((tab) => {
        let src = insertBeforeAnnotations(tab.source, pasteText.trim());
        src = formatDiagramSource(src);
        return { ...tab, source: src };
      });
    },
    [activeTab, activeDiagram, updateActiveTab, pasteCounterRef, formatDiagramSource],
  );

  const handleContextEntityCopy = useCallback(
    (entityName: string) => {
      if (!activeTab) return;
      const snippets: string[] = [];
      const extracted = extractEntityDeclaration(activeTab.source, entityName);
      if (extracted) snippets.push(extracted.trim());
      const annoRx = new RegExp(`^\\s*@${escapeRegex(entityName)}\\s+at\\s*\\([^)]+\\)`, 'gm');
      const annoMatches = activeTab.source.match(annoRx);
      if (annoMatches) snippets.push(...annoMatches);
      if (snippets.length > 0) {
        navigator.clipboard
          .writeText(snippets.join('\n'))
          .then(() => addToast(t('ui.copied') || 'Copied'))
          .catch(() => {});
        pasteCounterRef.current = 1;
      }
    },
    [activeTab, addToast, t, pasteCounterRef],
  );

  const handleContextRelationDelete = useCallback(
    (relationId: string) => {
      if (!activeTab || !activeDiagram) return;
      const rel = activeDiagram.relations.find((r) => r.id === relationId);
      if (!rel) return;
      updateActiveTab((tab) => {
        let src = tab.source;
        const patterns = [new RegExp(`^\\s*${escapeRegex(rel.from)}\\s+\\S+\\s+${escapeRegex(rel.to)}[^\\n]*$`, 'gm')];
        for (const rx of patterns) {
          const match = src.match(rx);
          if (match) {
            src = src.replace(match[0], '');
            break;
          }
        }
        src = src.replace(/\n{3,}/g, '\n\n');
        return { ...tab, source: src };
      });
      setSelectedItems((prev) => prev.filter((i) => i.id !== relationId));
    },
    [activeTab, activeDiagram, updateActiveTab, setSelectedItems],
  );

  const handleContextPaste = useCallback(() => {
    navigator.clipboard
      .readText()
      .then((text) => {
        if (!text.trim() || !activeTab) return;
        let pasteText = text;
        const entityNameRx = new RegExp(`${ENTITY_KINDS_RX}\\s+([A-Za-z_]\\w*)`, 'g');
        const namesToReplace = [...new Set([...pasteText.matchAll(entityNameRx)].map((m) => m[1]))];
        for (const name of namesToReplace) {
          const baseMatch = name.match(/^([A-Za-z_]+)(\d*)$/);
          const baseStr = baseMatch ? baseMatch[1] : name;
          let newName = baseStr + '1';
          let i = 2;
          const isNameTaken = (n: string) => {
            const rx = new RegExp(`\\b${escapeRegex(n)}\\b`);
            return rx.test(activeTab.source) || rx.test(pasteText);
          };
          let emergencyBreak = 0;
          while (isNameTaken(newName) && emergencyBreak < 1000) {
            newName = baseStr + i;
            i++;
            emergencyBreak++;
          }
          pasteText = pasteText.replace(new RegExp(`\\b${escapeRegex(name)}\\b`, 'g'), newName);
        }
        pasteText = pasteText.replace(
          /@(\w+)\s+at\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)?\s*\)/g,
          (_, n, x, y, sizeSuffix) => {
            const offset = 40 * pasteCounterRef.current;
            return `@${n} at (${Math.round(parseFloat(x) + offset)}, ${Math.round(parseFloat(y) + offset)}${sizeSuffix || ''})`;
          },
        );
        pasteCounterRef.current++;
        updateActiveTab((tab) => {
          let src = insertBeforeAnnotations(tab.source, pasteText.trim());
          src = formatDiagramSource(src);
          return { ...tab, source: src };
        });
      })
      .catch(() => {});
  }, [activeTab, updateActiveTab, pasteCounterRef, formatDiagramSource]);

  return {
    getPlacedItemPosition,
    handleEntityMove,
    handleEntityResize,
    handleRelationVerticalMove,
    handleCopyErrors,
    handleEntityEditRequest,
    handleRelationEditRequest,
    handleTextRenameRequest,
    handleRelationAddRequest,
    handleEntityEdit,
    handleRelationEdit,
    handleDropEntity,
    handleStencilInsert,
    handleExportSVG,
    handleExportPNG,
    executeNewDiagram,
    handleNew,
    handleTransformToCollaboration,
    handleFileOpen,
    handleSaveToCloudSubmit,
    handleSaveToCloud,
    handleExportGIF,
    handleExportMP4,
    toggleHistory,
    confirmRevertHistory,
    handleAddNote,
    handleConfirmDeleteDiagram,
    downloadDiagramFile,
    handleAutoLayout,
    handleContextEntityDelete,
    handleContextEntityDuplicate,
    handleContextEntityCopy,
    handleContextRelationDelete,
    handleContextPaste,
  };
}
