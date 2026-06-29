// ============================================================
// Isomorph — Main Application Component (v3 — SOLID refactor)
// ============================================================
// Orchestrates the IDE shell. Domain logic is delegated to:
//   - src/utils/exporter.ts       (SVG/PNG export)
//   - src/utils/error-formatter.ts (error display strings)
//   - src/data/examples.ts        (built-in snippets)
//   - src/components/Icons.tsx     (icon library)
//   - src/components/ShortcutsOverlay.tsx
// ============================================================

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { IsomorphEditor } from './editor/IsomorphEditor.js';
import type { LintDiagnostic } from './editor/IsomorphEditor.js';
import { DiagramView } from './components/DiagramView.js';
import { SplitPane } from './components/SplitPane.js';
import { ShortcutsOverlay } from './components/ShortcutsOverlay.js';
import { StatusBar } from './components/StatusBar.js';
import { Toolbar } from './components/Toolbar.js';
import { Sidebar } from './components/Sidebar.js';
import { HistoryPane } from './components/HistoryPane.js';
import { SettingsModal } from './components/SettingsModal.js';
import { LibraryModal } from './components/LibraryModal.js';
import { ExportModal } from './components/ExportModal.js';
import { ProjectDetailModal } from './components/ProjectDetailModal.js';
import { ContextMenu } from './components/ContextMenu.js';
import { RenameModal } from './components/RenameModal.js';
import { CommonModals } from './components/CommonModals.js';
import { EditEntityModal } from './components/EditEntityModal.js';
import { EditRelationModal } from './components/EditRelationModal.js';
import { EditTextModal } from './components/EditTextModal.js';
import { NewDiagramModal } from './components/NewDiagramModal.js';
import { SaveToCloudModal } from './components/SaveToCloudModal.js';
import {
  IconCode,
  IconDiagram,
  IconExport,
  IconNew,
  IconOpen,
  IconKeyboard,
  IconSave,
  IconSun,
  IconMoon,
  IconCanvas,
  IconAlertTriangle,
} from './components/Icons.js';
import { parse } from './parser/index.js';
import { analyze } from './semantics/analyzer.js';
import { formatAllErrors } from './utils/error-formatter.js';
import type { IOMDiagram, IOMEntity } from './semantics/iom.js';
import type { ParseError } from './parser/index.js';
import type { DiagramKind, SequenceMessageType, WorkspaceTab } from './types/index.js';
import { LANGUAGE_OPTIONS, getStoredLanguage, setStoredLanguage, tText, type Language } from './i18n.js';
import { useAuth } from './lib/auth-context.js';
import { AuthModal } from './components/AuthModal.js';
import { type Project } from './lib/projects.js';
import { isTelemetryEnabled, setTelemetryEnabled } from './lib/telemetry.js';
import { useCollaboration } from './lib/collaboration.js';
import { ShareModal } from './components/ShareModal.js';
import { AnonymousLoginModal } from './components/AnonymousLoginModal.js';
import { useWorkspace } from './hooks/useWorkspace.js';
import { useCloudSync } from './hooks/useCloudSync.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { useShareLink } from './hooks/useShareLink.js';
import { useCanvasInteractions } from './hooks/useCanvasInteractions.js';

// Types extracted to src/types/index.ts: DiagramKind, WorkspaceTab, SequenceMessageType
import { DIAGRAM_KINDS } from './constants.js';

// Constants extracted to src/constants.ts: DIAGRAM_KINDS, REL_TOKENS_BY_KIND

// SequenceMessageType extracted to src/types/index.ts
import { slugId, toolsetFor } from './utils/source-manipulation.js';

import { getStencilsForKind } from './utils/stencils.js';
import { templateFor } from './utils/templates.js';
import { formatDiagramSource, sequenceToCollaborationSource } from './utils/formatting.js';

// ── App ──────────────────────────────────────────────────────

export default function App() {
  const { session, user, signOut, loading } = useAuth();
  const [language, setLanguage] = useState<Language>(() => getStoredLanguage());
  const {
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
  } = useWorkspace();
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [isUMLCompliant, setIsUMLCompliant] = useState(() => {
    const stored = localStorage.getItem('isomorph-strict-uml');
    return stored ? stored === 'true' : true;
  });
  const [isWatermarkEnabled, setIsWatermarkEnabled] = useState(() => {
    const stored = localStorage.getItem('isomorph-watermark');
    return stored ? stored === 'true' : true;
  });
  const [isAnimationsEnabled, setIsAnimationsEnabled] = useState(() => {
    const stored = localStorage.getItem('isomorph-animations');
    return stored ? stored === 'true' : true;
  });
  const [telemetry, setTelemetry] = useState(() => isTelemetryEnabled());
  const [animationSpeed, setAnimationSpeed] = useState<number>(() => {
    const stored = localStorage.getItem('isomorph-anim-speed');
    return stored ? parseFloat(stored) : 1.0;
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [mobilePane, setMobilePane] = useState<'code' | 'diagram'>('code');
  const [editingEntity, setEditingEntity] = useState<
    (IOMEntity & { bodyText?: string; origName?: string; elseBlocks?: { label?: string }[] }) | null
  >(null);
  const [editingText, setEditingText] = useState<{
    oldName: string;
    newName: string;
    type: 'diagram' | 'package';
  } | null>(null);
  const [editingRelation, setEditingRelation] = useState<{
    relationId: string;
    label: string;
    kind: string;
    direction: 'forward' | 'reverse';
    fromMult?: string;
    toMult?: string;
    seqMessageType?: SequenceMessageType;
  } | null>(null);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' }[]>([]);
  const [collabShowTrail, setCollabShowTrail] = useState(true);
  const [collabShowNameLabel, setCollabShowNameLabel] = useState(true);

  const addToast = useCallback((message: string, type: 'success' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);
  const [pendingMobileDropKeyword, setPendingMobileDropKeyword] = useState<string | null>(null);
  const examplesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryInitialTab, setLibraryInitialTab] = useState<'my' | 'shared' | 'open_folder' | 'examples'>('my');
  const handleOpenLibrary = useCallback((open: boolean) => {
    if (open) {
      setLibraryInitialTab('my');
    }
    setIsLibraryOpen(open);
  }, []);
  const {
    projects,
    setProjects,
    sharedProjects,
    publicProjectIds,
    isCreatingProject,
    setIsCreatingProject,
    isSavingToCloud,
    setIsSavingToCloud,
    saveToCloudModalOpen,
    setSaveToCloudModalOpen,
    selectedProjectId,
    setSelectedProjectId,
    newProjectName,
    setNewProjectName,
    newProjectError,
    setNewProjectError,
    projectToDelete,
    setProjectToDelete,
    libraryCategory,
    setLibraryCategory,
    customCategories,
    setCustomCategories,
    isHistoryOpen,
    setIsHistoryOpen,
    diagramHistoryList,
    setDiagramHistoryList,
    selectedHistoryId,
    setSelectedHistoryId,
    isRevertModalOpen,
    setIsRevertModalOpen,
    refreshPublicProjects,
  } = useCloudSync(user);

  const [isExporting, setIsExporting] = useState(false);
  const [exportTime, setExportTime] = useState<number>(0);
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(() => {
    const val = localStorage.getItem('isomorph-autosave');
    return val ? parseFloat(val) : 0;
  });
  const [newModalTab, setNewModalTab] = useState<'tab' | 'project'>('tab');

  // Staged files and folder drag-and-drop

  // Project details modal states
  const [projectDetailModalOpen, setProjectDetailModalOpen] = useState(false);
  const [projectDetailProject, setProjectDetailProject] = useState<Project | null>(null);
  const [projectDetailDiagrams, setProjectDetailDiagrams] = useState<any[]>([]);
  const [projectDetailAccessMap, setProjectDetailAccessMap] = useState<{
    base: string;
    diagrams: Record<string, string>;
  }>({ base: 'viewer', diagrams: {} });
  const [isLoadingProjectDetail, setIsLoadingProjectDetail] = useState(false);
  const [diagramToDelete, setDiagramToDelete] = useState<any | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    type: 'category' | 'project' | 'diagram';
    id: string;
    x: number;
    y: number;
    extra?: any;
  } | null>(null);

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameType, setRenameType] = useState<'project' | 'category' | 'diagram' | null>(null);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isSavingFlow, setIsSavingFlow] = useState(false);

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const [profile, setProfile] = useState<{
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    tier?: string | null;
    settings?: any;
  } | null>(null);

  // Share and Anonymous states
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      import('./lib/profile.js').then(({ getProfile }) => {
        getProfile(user.id).then(async (data) => {
          if (data) {
            setProfile(data);
            if (data.settings?.projects?.tabs) {
              setCustomCategories(data.settings.projects.tabs);
            }
            if (data.settings?.language) {
              setLanguage(data.settings.language);
              setStoredLanguage(data.settings.language);
            }
            if (typeof data.settings?.auto_save === 'number') {
              setAutoSaveInterval(data.settings.auto_save);
              localStorage.setItem('isomorph-autosave', String(data.settings.auto_save));
            }
            if (typeof data.settings?.telemetry === 'boolean') {
              setTelemetry(data.settings.telemetry);
              setTelemetryEnabled(data.settings.telemetry);
            }
            if (typeof data.settings?.show_trail === 'boolean') {
              setCollabShowTrail(data.settings.show_trail);
            }
            if (typeof data.settings?.show_name_label === 'boolean') {
              setCollabShowNameLabel(data.settings.show_name_label);
            }
            if (typeof data.settings?.strict_uml === 'boolean') {
              setIsUMLCompliant(data.settings.strict_uml);
              localStorage.setItem('isomorph-strict-uml', String(data.settings.strict_uml));
            }
            if (typeof data.settings?.watermark === 'boolean') {
              setIsWatermarkEnabled(data.settings.watermark);
              localStorage.setItem('isomorph-watermark', String(data.settings.watermark));
            }
            if (typeof data.settings?.animations === 'boolean') {
              setIsAnimationsEnabled(data.settings.animations);
              localStorage.setItem('isomorph-animations', String(data.settings.animations));
            }
            if (typeof data.settings?.anim_speed === 'number') {
              setAnimationSpeed(data.settings.anim_speed);
              localStorage.setItem('isomorph-anim-speed', String(data.settings.anim_speed));
            }
          } else {
            // Profile is missing, let's create it automatically
            const { updateProfile } = await import('./lib/profile.js');
            const created = await updateProfile(user.id, {
              username: user.email?.split('@')[0] || 'user_' + user.id.slice(0, 5),
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              avatar_url: user.user_metadata?.avatar_url || null,
            });
            if (created) {
              const fresh = await getProfile(user.id);
              if (fresh) setProfile(fresh);
            }
          }
        });
      });
    } else {
      setProfile(null);
      setProjects([]);
      setCustomCategories(['Favorites', 'Work', 'Personal']);
    }
  }, [user]);

  // ── Share link (delegated to useShareLink hook) ───────────────────

  const handleSignOut = useCallback(async () => {
    await signOut();
    setProjects([]);
    setProfile(null);
    setCustomCategories(['Favorites', 'Work', 'Personal']);
    setLibraryCategory('All Projects');
    setSelectedProjectId('');
    setIsSavingFlow(false);
    setIsSettingsOpen(false);

    const defaultId = `tab-${slugId()}`;
    const defaultSrc = templateFor('class');
    setTabs([
      {
        id: defaultId,
        name: 'untitled.isx',
        source: defaultSrc,
        savedSource: defaultSrc,
        activeDiagramIdx: 0,
        diagramKindFilter: 'all',
      },
    ]);
    setActiveTabId(defaultId);
  }, [signOut]);

  const saveCustomCategoriesToDB = async (cats: string[]) => {
    if (user && profile) {
      const { supabase } = await import('./lib/supabase.js');
      // Fix double saving by not spreading the corrupted top-level "tabs"
      const currentSettings = profile.settings || {};
      const { tabs, ...cleanSettings } = currentSettings as any;
      const { error } = await supabase
        .from('profiles')
        .update({
          settings: {
            ...cleanSettings,
            projects: {
              tabs: cats,
            },
          },
        })
        .eq('id', user.id);
      if (!error) {
        setProfile((p) => (p ? { ...p, settings: { ...cleanSettings, projects: { tabs: cats } } } : null));
      }
    }
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (!trimmed || !renameTargetId || !renameType) return;

    if (renameType === 'project') {
      import('./lib/projects.js').then(({ updateProject }) => {
        if (user) {
          updateProject(user.id, renameTargetId, { name: trimmed }).then((success) => {
            if (success) {
              setProjects((prev) => prev.map((p) => (p.id === renameTargetId ? { ...p, name: trimmed } : p)));
              addToast('Project renamed');
            }
          });
        }
      });
    } else if (renameType === 'category') {
      if (customCategories.includes(trimmed)) {
        addToast('Category already exists', 'info');
        return;
      }
      const oldName = renameTargetId;
      const next = customCategories.map((c) => (c === oldName ? trimmed : c));
      setCustomCategories(next);
      saveCustomCategoriesToDB(next);

      setProjects((prev) =>
        prev.map((p) => {
          if (p.settings?.category === oldName) {
            const newSettings = { ...p.settings, category: trimmed };
            if (user) {
              import('./lib/projects.js').then(({ updateProject }) => {
                updateProject(user.id, p.id, { settings: newSettings });
              });
            }
            return { ...p, settings: newSettings };
          }
          return p;
        }),
      );

      if (libraryCategory === oldName) {
        setLibraryCategory(trimmed);
      }
      addToast('Category renamed');
    } else if (renameType === 'diagram') {
      import('./lib/projects.js').then(({ updateDiagram }) => {
        updateDiagram(renameTargetId, { name: trimmed }).then((success) => {
          if (success) {
            setProjectDetailDiagrams((prev) =>
              prev.map((d) => (d.id === renameTargetId ? { ...d, name: trimmed } : d)),
            );
            setTabs((prev) => prev.map((t) => (t.diagram_id === renameTargetId ? { ...t, name: trimmed } : t)));
            addToast('Diagram renamed');
          }
        });
      });
    }

    setRenameModalOpen(false);
    setRenameType(null);
    setRenameTargetId(null);
    setRenameValue('');
  };

  const handleOpenProjectDetails = async (project: Project) => {
    setIsLoadingProjectDetail(true);
    setProjectDetailProject(project);
    setProjectDetailModalOpen(true);
    try {
      const { getDiagrams } = await import('./lib/projects.js');
      const diagrams = await getDiagrams(project.id);
      setProjectDetailDiagrams(diagrams);

      // Fetch user specific permissions for diagrams in this project
      if (user) {
        const { supabase } = await import('./lib/supabase.js');
        const { data: accessList } = await supabase
          .from('project_access')
          .select('diagram_id, role')
          .eq('project_id', project.id)
          .eq('user_id', user.id);

        const mapping: Record<string, string> = {};
        let projectRole = (project as any).role || 'viewer';
        if (accessList) {
          accessList.forEach((a: any) => {
            if (a.diagram_id === null) {
              projectRole = a.role;
            } else {
              mapping[a.diagram_id] = a.role;
            }
          });
        }
        setProjectDetailAccessMap({
          base: projectRole,
          diagrams: mapping,
        });
      } else {
        setProjectDetailAccessMap({
          base: (project as any).role || 'viewer',
          diagrams: {},
        });
      }
    } catch (error) {
      console.error('Failed to load project files:', error);
      addToast('Failed to load project files', 'info');
    } finally {
      setIsLoadingProjectDetail(false);
    }
  };

  const getDiagramRole = useCallback(
    (diagramId: string) => {
      if (!projectDetailProject || !user) return 'viewer';
      if (projectDetailProject.owner_id === user.id) return 'owner';
      return projectDetailAccessMap.diagrams[diagramId] || projectDetailAccessMap.base || 'viewer';
    },
    [projectDetailProject, user, projectDetailAccessMap],
  );

  const openProjectFile = useCallback((diagram: any, projectId: string, role: string = 'owner') => {
    setTabs((prev) => {
      const existingTab = prev.find((t) => t.diagram_id === diagram.id);
      if (existingTab) {
        setTimeout(() => setActiveTabId(existingTab.id), 0);
        return prev;
      }
      const content = diagram.content as any;
      const sourceText = typeof content === 'string' ? content : content?.source || '';
      const newTab: WorkspaceTab = {
        id: diagram.id,
        name: diagram.name,
        source: sourceText,
        activeDiagramIdx: 0,
        diagramKindFilter: diagram.kind as 'all' | DiagramKind,
        diagram_id: diagram.id,
        project_id: projectId,
        savedSource: sourceText,
        project_role: role,
      };
      setTimeout(() => setActiveTabId(newTab.id), 0);
      return [...prev, newTab];
    });
    setProjectDetailModalOpen(false);
    setIsLibraryOpen(false);
  }, []);

  const openWholeProject = useCallback(
    (diagrams: any[], projectId: string, role: string = 'owner', rolesMap?: Record<string, string>) => {
      if (diagrams.length === 0) {
        const newTabId = `tab-${slugId()}`;
        setTabs([
          {
            id: newTabId,
            name: 'Untitled Diagram',
            source: templateFor('class'),
            activeDiagramIdx: 0,
            diagramKindFilter: 'all',
            project_id: projectId,
            project_role: role,
          },
        ]);
        setActiveTabId(newTabId);
        addToast('Opened empty project', 'info');
        setProjectDetailModalOpen(false);
        setIsLibraryOpen(false);
        return;
      }

      setTabs((prev) => {
        const next: WorkspaceTab[] = [];
        let firstTabIdToSelect: string | null = null;
        diagrams.forEach((d) => {
          const diagramRole = rolesMap?.[d.id] || role;
          const existing = prev.find((t) => t.diagram_id === d.id);
          if (existing) {
            next.push({ ...existing, project_role: diagramRole, project_id: projectId });
            if (!firstTabIdToSelect) firstTabIdToSelect = existing.id;
          } else {
            const content = d.content as any;
            const sourceText = typeof content === 'string' ? content : content?.source || '';
            const newTab: WorkspaceTab = {
              id: d.id,
              name: d.name,
              source: sourceText,
              activeDiagramIdx: 0,
              diagramKindFilter: d.kind as 'all' | DiagramKind,
              diagram_id: d.id,
              project_id: projectId,
              savedSource: sourceText,
              project_role: diagramRole,
            };
            next.push(newTab);
            if (!firstTabIdToSelect) firstTabIdToSelect = newTab.id;
          }
        });
        if (firstTabIdToSelect) {
          setTimeout(() => setActiveTabId(firstTabIdToSelect!), 0);
        }
        return next;
      });

      setProjectDetailModalOpen(false);
      setIsLibraryOpen(false);
    },
    [],
  );

  const {
    isAnonymousLoginOpen,
    setIsAnonymousLoginOpen,
    anonymousName,
    pendingShareToken,
    setPendingShareToken,
    isJoiningShare,
    handleRedeemShareLink,
  } = useShareLink({
    user,
    loading,
    setProjects,
    openWholeProject,
    addToast,
  });

  const autoSaveProfile = async (updates: {
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    settings?: any;
  }) => {
    if (!user || !profile) return;
    const { supabase } = await import('./lib/supabase.js');
    const updatedProfile = { ...profile, ...updates };
    setProfile(updatedProfile);

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: updatedProfile.full_name,
      username: updatedProfile.username,
      avatar_url: updatedProfile.avatar_url,
      settings: updatedProfile.settings || profile.settings || {},
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error auto-saving profile:', error);
      // Revert local state
      setProfile(profile);
      if (error.code === '23505') {
        addToast('Error: Username already taken');
      } else {
        addToast('Error saving profile changes');
      }
    }
  };

  const autoSaveSettings = async (settingsUpdates: any) => {
    if (!user || !profile) return;
    const currentSettings = profile.settings || {};
    const { tabs, ...cleanSettings } = currentSettings as any;
    const newSettings = {
      ...cleanSettings,
      projects: { tabs: customCategories },
      language: language,
      auto_save: autoSaveInterval,
      telemetry: telemetry,
      show_trail: collabShowTrail,
      show_name_label: collabShowNameLabel,
      cursor_colour: profile.settings?.cursor_colour || '#EAB308',
      strict_uml: isUMLCompliant,
      watermark: isWatermarkEnabled,
      animations: isAnimationsEnabled,
      anim_speed: animationSpeed,
      ...settingsUpdates,
    };

    const { supabase } = await import('./lib/supabase.js');
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: profile.full_name,
      username: profile.username,
      avatar_url: profile.avatar_url,
      settings: newSettings,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error auto-saving settings:', error);
    } else {
      setProfile({ ...profile, settings: newSettings });
    }
  };

  const [selectedItems, setSelectedItems] = useState<{ type: 'entity' | 'relation'; id: string }[]>([]);
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => tText(language, key, vars),
    [language],
  );

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId) ?? tabs[0], [tabs, activeTabId]);

  const { awareness, isConnected, isSynced, getSourceText, connectedDiagramId, collaborators } = useCollaboration(
    activeTab?.diagram_id || null,
    profile?.full_name || profile?.username || user?.email || anonymousName || 'Anonymous',
    profile?.settings?.cursor_colour || '#3B82F6',
    profile?.avatar_url || null,
    activeTab?.project_role || 'owner',
    // For authenticated users, pass the JWT access token.
    // For anonymous share-link users (no session), pass 'share:anonymous'
    // so the server recognizes them as allowed share connections.
    session?.access_token || (activeTab?.diagram_id ? 'share:anonymous' : undefined),
    profile?.username || undefined,
  );

  const isCollabActive = !!(activeTab?.diagram_id && connectedDiagramId === activeTab.diagram_id);

  const sortedCollaborators = useMemo(() => {
    if (!collaborators || !awareness) return [];
    const localClientId = awareness.clientID;
    const localUser = collaborators.find((c) => c.clientId === localClientId);
    const otherUsers = collaborators.filter((c) => c.clientId !== localClientId);
    return localUser ? [localUser, ...otherUsers] : otherUsers;
  }, [collaborators, awareness]);

  const source = activeTab?.source ?? '';
  const selectedHistoryItem = diagramHistoryList.find((h) => h.id === selectedHistoryId);
  const displaySource = selectedHistoryItem ? selectedHistoryItem.content?.source || '' : source;
  const fileName = activeTab?.name ?? 'untitled.isx';

  const updateActiveTab = useCallback(
    (update: (tab: WorkspaceTab) => WorkspaceTab, saveHistory = true) => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id === (activeTab?.id ?? '')) {
            const result = update(tab);
            if (saveHistory && result.source !== tab.source) {
              result.undoStack = [...(tab.undoStack || []), tab.source];
              result.redoStack = [];
            }
            return result;
          }
          return tab;
        }),
      );
    },
    [activeTab],
  );

  // ── Paste cascade counter (Feature 15) ──────────────────
  const pasteCounterRef = useRef(1);

  // ── Unsaved-changes guard (Feature 16) ──────────────────
  const hasUnsavedChanges = useMemo(
    () => tabs.some((t) => t.savedSource !== undefined && t.source !== t.savedSource),
    [tabs],
  );

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // ── Keyboard Esc listener for Revert Modal ──────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isRevertModalOpen) {
        setIsRevertModalOpen(false);
      }
    };
    if (isRevertModalOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRevertModalOpen]);

  // ── Close dropdown on outside click ──────────────────────
  useEffect(() => {
    function handleOutsideInteraction(e: Event) {
      if (examplesRef.current && !examplesRef.current.contains(e.target as Node)) {
        setExamplesOpen(false);
      }
    }
    if (examplesOpen) {
      document.addEventListener('click', handleOutsideInteraction);
    }
    return () => {
      document.removeEventListener('click', handleOutsideInteraction);
    };
  }, [examplesOpen]);

  // ── Parse + analyze on every keystroke ───────────────────
  const parseResult = useMemo(() => {
    try {
      return parse(displaySource);
    } catch {
      return null;
    }
  }, [displaySource]);

  const analysisResult = useMemo(() => {
    if (!parseResult) return null;
    try {
      return analyze(parseResult.program);
    } catch {
      return null;
    }
  }, [parseResult]);

  const parseErrors: ParseError[] = parseResult?.errors ?? [];
  const rawSemanticErrors = analysisResult?.errors ?? [];

  // Rules that enforce strict UML semantics
  const strictUmlRules = ['SS-4', 'SS-5', 'SS-6', 'SS-11'];
  const semanticErrors = rawSemanticErrors.filter((e) => isUMLCompliant || !strictUmlRules.includes(e.rule));

  const allErrors: string[] = formatAllErrors(parseErrors, semanticErrors);

  // Combined parse + semantic diagnostics for the editor lint gutter
  const editorDiagnostics: LintDiagnostic[] = [
    ...parseErrors.map((e) => ({ message: e.message, line: e.line, col: e.col, severity: 'error' as const })),
    ...semanticErrors
      .filter((e): e is typeof e & { line: number; col: number } => e.line != null)
      .map((e) => ({ message: `(${e.rule}) ${e.message}`, line: e.line, col: e.col ?? 1, severity: 'error' as const })),
  ];
  const diagrams: IOMDiagram[] = analysisResult?.iom.diagrams ?? [];
  const activeDiagram = diagrams[0] ?? null;

  const handleCreateProjectSubmit = useCallback(async () => {
    if (!user || !newProjectName.trim() || isCreatingProject) return;
    setIsCreatingProject(true);
    const { createProject, createDiagram } = await import('./lib/projects.js');
    try {
      const p = await createProject(user.id, newProjectName.trim());
      if (!p) {
        throw new Error('Failed to create project (empty response).');
      }

      setProjects((prev) => [p, ...prev]);
      addToast('Project created successfully', 'success');

      if (isSavingFlow) {
        const d = await createDiagram(user.id, p.id, activeTab.name, activeDiagram?.kind || 'class', {
          source: activeTab.source,
        });
        if (d) {
          updateActiveTab(
            (tab) => ({ ...tab, project_id: p.id, diagram_id: d.id, savedSource: tab.source, project_role: 'owner' }),
            false,
          );
          addToast('Saved to cloud');
        } else {
          throw new Error('Failed to save the diagram to the new project.');
        }
        setIsSavingFlow(false);
      } else {
        // Simple flow: Create project and a new diagram of newDiagramKind inside it
        const defaultSrc = templateFor(newDiagramKind);
        const d = await createDiagram(user.id, p.id, `diagram.isx`, newDiagramKind, { source: defaultSrc });
        if (d) {
          const tabId = `tab-${slugId()}`;
          setTabs((prev) => [
            ...prev,
            {
              id: tabId,
              name: 'diagram.isx',
              source: defaultSrc,
              savedSource: defaultSrc,
              activeDiagramIdx: 0,
              diagramKindFilter: 'all',
              project_id: p.id,
              diagram_id: d.id,
              project_role: 'owner',
            },
          ]);
          setActiveTabId(tabId);
        } else {
          throw new Error('Failed to create default diagram inside the new project.');
        }
      }

      setIsNewModalOpen(false);
      setNewProjectName('');
      setNewProjectError('');
    } catch (err: any) {
      setNewProjectError(err.message);
    } finally {
      setIsCreatingProject(false);
    }
  }, [
    user,
    newProjectName,
    isSavingFlow,
    activeTab,
    activeDiagram,
    updateActiveTab,
    newDiagramKind,
    isCreatingProject,
  ]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const apply = (matches: boolean) => {
      setIsMobileLayout(matches);
    };
    apply(media.matches);
    const listener = (event: MediaQueryListEvent) => apply(event.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
    media.addListener(listener);
    return () => media.removeListener(listener);
  }, []);

  useEffect(() => {
    setStoredLanguage(language);
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'isomorph-language') return;
      const next = event.newValue;
      if (next === 'en' || next === 'ro' || next === 'ru') {
        setLanguage(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const {
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
  } = useCanvasInteractions({
    activeTab,
    activeDiagram,
    diagrams,
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    updateActiveTab,
    pasteCounterRef,
    selectedItems,
    setSelectedItems,
    addToast,
    t,
    language,
    isUMLCompliant,
    isAnimationsEnabled,
    isWatermarkEnabled,
    animationSpeed,
    user,
    setAuthMode,
    setIsAuthOpen,
    isNewModalOpen,
    setIsNewModalOpen,
    isSavingFlow,
    setIsSavingFlow,
    newDiagramKind,
    setNewProjectName,
    setNewProjectError,
    isCreatingProject,
    setIsCreatingProject,
    setProjects,
    newModalTab,
    selectedProjectId,
    isSavingToCloud,
    setIsSavingToCloud,
    saveToCloudModalOpen,
    setSaveToCloudModalOpen,
    setIsExporting,
    setExportTime,
    setEditingEntity,
    setEditingRelation,
    setEditingText,
    editingEntity,
    editingRelation,
    editingText,
    tabToClose,
    setTabToClose,
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
    selectedHistoryId,
    setSelectedHistoryId,
    selectedHistoryItem,
    setIsRevertModalOpen,
    diagramHistoryList,
    displaySource,
    formatDiagramSource,
    sequenceToCollaborationSource,
    setProjectDetailModalOpen,
    projectDetailProject,
    isLoadingProjectDetail,
    projectDetailDiagrams,
    projectDetailAccessMap,
  });

  useKeyboardShortcuts({
    activeTab,
    activeDiagram,
    selectedItems,
    setSelectedItems,
    updateActiveTab,
    addToast,
    t,
    pasteCounterRef,
    handleNew,
    setIsLibraryOpen: handleOpenLibrary,
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
  });

  useEffect(() => {
    const handleModalEnter = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'TEXTAREA') return;

      if (editingEntity) {
        e.preventDefault();
        const isNameOnlyBoundary =
          editingEntity.kind === 'partition' || editingEntity.kind === 'system' || editingEntity.kind === 'boundary';
        handleEntityEdit(editingEntity.origName || editingEntity.id, {
          name: editingEntity.name,
          stereotype: isNameOnlyBoundary ? undefined : editingEntity.stereotype,
          isAbstract: editingEntity.isAbstract,
          bodyText: editingEntity.bodyText,
          kind: editingEntity.kind,
          elseBlocks: editingEntity.elseBlocks,
        });
        return;
      }

      if (editingRelation) {
        e.preventDefault();
        handleRelationEdit(editingRelation.relationId, {
          label: editingRelation.label,
          kind: editingRelation.kind,
          direction: editingRelation.direction,
          fromMult: editingRelation.fromMult,
          toMult: editingRelation.toMult,
          seqMessageType: editingRelation.seqMessageType,
        });
        return;
      }

      if (isNewModalOpen) {
        e.preventDefault();
        if (newModalTab === 'tab') {
          executeNewDiagram(newDiagramKind);
        } else {
          handleCreateProjectSubmit();
        }
        return;
      }

      if (saveToCloudModalOpen) {
        e.preventDefault();
        handleSaveToCloudSubmit();
        return;
      }

      if (tabToClose) {
        e.preventDefault();
        setTabs((prev) => {
          const next = prev.filter((t) => t.id !== tabToClose);
          if (activeTabId === tabToClose) setActiveTabId(next[Math.max(0, next.length - 1)]?.id ?? '');
          return next;
        });
        setTabToClose(null);
      }
    };

    window.addEventListener('keydown', handleModalEnter);
    return () => window.removeEventListener('keydown', handleModalEnter);
  }, [
    editingEntity,
    editingRelation,
    isNewModalOpen,
    tabToClose,
    newDiagramKind,
    handleEntityEdit,
    handleRelationEdit,
    executeNewDiagram,
    activeTabId,
    newModalTab,
    handleCreateProjectSubmit,
    saveToCloudModalOpen,
    handleSaveToCloudSubmit,
  ]);

  const sourcePane = (
    <div className="iso-panel" style={{ height: '100%' }}>
      <div className="iso-panel-header">
        <IconCode size={11} />
        {t('ui.source')}
        {selectedHistoryItem && (
          <span style={{ marginLeft: 8, color: 'var(--iso-brand)', fontSize: 11 }}>(Viewing History - Read Only)</span>
        )}
        <span className="iso-panel-info" aria-live="polite"></span>
        <span className="iso-panel-spacer" />
      </div>
      <div className="iso-panel-body">
        <IsomorphEditor
          key={activeTab?.id || 'empty'}
          value={displaySource}
          readOnly={
            !!selectedHistoryItem || activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
          }
          onChange={(value) => {
            if (selectedHistoryItem) return;
            updateActiveTab((tab) => ({ ...tab, source: value }));
          }}
          errors={editorDiagnostics}
          yText={isCollabActive ? getSourceText() : null}
          isSynced={isCollabActive ? isSynced : false}
          awareness={isCollabActive ? awareness : null}
        />
      </div>
      {allErrors.length > 0 && (
        <div className="iso-error-panel" role="log" aria-label={t('ui.errors')}>
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}
          >
            <strong
              style={{
                fontSize: '0.78rem',
                color: 'var(--iso-text-muted)',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '4px',
              }}
            >
              <IconAlertTriangle size={14} /> <span style={{ marginLeft: 4 }}>{t('ui.errors')}</span>
            </strong>
            <button
              type="button"
              className="iso-btn"
              onClick={handleCopyErrors}
              style={{ padding: '2px 8px', fontSize: '0.72rem' }}
            >
              {t('ui.copy_errors')}
            </button>
          </div>
          {allErrors.slice(0, 8).map((msg, i) => (
            <div key={`err-${msg.slice(0, 20)}-${i}`} className="iso-error-item">
              <span className="iso-error-icon" aria-hidden="true">
                ✖
              </span>
              <span className="iso-error-msg">{msg}</span>
            </div>
          ))}
          {allErrors.length > 8 && (
            <div className="iso-error-item">
              <span className="iso-error-icon" aria-hidden="true">
                …
              </span>
              <span className="iso-error-msg" style={{ color: 'var(--iso-text-muted)' }}>
                {allErrors.length - 8 > 1
                  ? t('status.more_error_many', { count: allErrors.length - 8 })
                  : t('status.more_error_one', { count: allErrors.length - 8 })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const canvasPane = (
    <div className="iso-panel iso-panel--canvas" style={{ height: '100%' }}>
      <div className="iso-panel-header">
        <IconCanvas size={11} />
        {t('ui.canvas')}
        <span className="iso-panel-spacer" />
        {diagrams.length > 0 && (
          <span style={{ fontSize: 10, color: '#6e7781', fontFamily: 'monospace' }}>{t('ui.drag_reposition')}</span>
        )}
      </div>
      <div className="iso-panel-body">
        <DiagramView
          diagram={activeDiagram}
          isWatermarkEnabled={isWatermarkEnabled}
          isAnimating={isAnimating}
          animationSpeed={animationSpeed}
          language={language}
          onEntityMove={
            activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
              ? undefined
              : handleEntityMove
          }
          onEntityResize={
            activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
              ? undefined
              : handleEntityResize
          }
          onRelationVerticalMove={
            activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
              ? undefined
              : handleRelationVerticalMove
          }
          onEntityEditRequest={(entity) => {
            if (activeTab?.project_role === 'viewer') return;
            if (activeTab?.project_role === 'commenter' && entity.kind !== 'note') return;
            handleEntityEditRequest(entity);
          }}
          onRelationEditRequest={
            activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
              ? undefined
              : handleRelationEditRequest
          }
          onRelationAddRequest={
            activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
              ? undefined
              : handleRelationAddRequest
          }
          onTextRenameRequest={handleTextRenameRequest}
          onExportSVG={handleExportSVG}
          onDropEntity={
            activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
              ? undefined
              : handleDropEntity
          }
          pendingDropKeyword={isMobileLayout ? pendingMobileDropKeyword : null}
          onConsumePendingDrop={() => setPendingMobileDropKeyword(null)}
          availableTools={
            selectedHistoryItem
              ? []
              : activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
                ? ['hand']
                : toolsetFor(activeDiagram?.kind)
          }
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          onAutoLayout={
            activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
              ? undefined
              : handleAutoLayout
          }
          onEntityDelete={
            activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
              ? undefined
              : handleContextEntityDelete
          }
          onEntityDuplicate={
            activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
              ? undefined
              : handleContextEntityDuplicate
          }
          onEntityCopy={
            activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
              ? undefined
              : handleContextEntityCopy
          }
          onRelationDelete={
            activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
              ? undefined
              : handleContextRelationDelete
          }
          onPaste={
            activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
              ? undefined
              : handleContextPaste
          }
          onAddNote={activeTab?.project_role === 'viewer' ? undefined : handleAddNote}
          awareness={awareness}
        />
      </div>
    </div>
  );

  const mobileStencilRail =
    activeDiagram?.kind &&
    activeTab?.project_role !== 'viewer' &&
    activeTab?.project_role !== 'commenter' &&
    getStencilsForKind(activeDiagram.kind).length > 0 ? (
      <div className="iso-mobile-stencil-rail" role="toolbar" aria-label={t('ui.insert_shapes')}>
        {getStencilsForKind(activeDiagram.kind).map((stencil) => (
          <button
            key={stencil.label}
            type="button"
            className="iso-mobile-stencil"
            onClick={() => handleStencilInsert(stencil.keyword)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {stencil.icon && <div style={{ display: 'flex' }}>{stencil.icon}</div>}
            {stencil.label}
          </button>
        ))}
      </div>
    ) : null;

  const mobileCanvasPane = (
    <div className="iso-mobile-canvas-pane">
      {mobileStencilRail}
      {canvasPane}
    </div>
  );

  const renderCommonModals = () => {
    return (
      <>
        {isSettingsOpen && (
          <SettingsModal
            onClose={() => setIsSettingsOpen(false)}
            session={session}
            user={user}
            profile={profile}
            setProfile={setProfile}
            language={language}
            setLanguage={setLanguage}
            isUMLCompliant={isUMLCompliant}
            setIsUMLCompliant={setIsUMLCompliant}
            isWatermarkEnabled={isWatermarkEnabled}
            setIsWatermarkEnabled={setIsWatermarkEnabled}
            isAnimationsEnabled={isAnimationsEnabled}
            setIsAnimationsEnabled={setIsAnimationsEnabled}
            setIsAnimating={setIsAnimating}
            telemetry={telemetry}
            setTelemetry={setTelemetry}
            setTelemetryEnabled={setTelemetryEnabled}
            animationSpeed={animationSpeed}
            setAnimationSpeed={setAnimationSpeed}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            collabShowTrail={collabShowTrail}
            setCollabShowTrail={setCollabShowTrail}
            collabShowNameLabel={collabShowNameLabel}
            setCollabShowNameLabel={setCollabShowNameLabel}
            autoSaveInterval={autoSaveInterval}
            setAutoSaveInterval={setAutoSaveInterval}
            addToast={addToast}
            handleSignOut={handleSignOut}
            setAuthMode={setAuthMode}
            setIsAuthOpen={setIsAuthOpen}
            projects={projects}
            autoSaveProfile={autoSaveProfile}
            autoSaveSettings={autoSaveSettings}
            t={t}
          />
        )}
        {isLibraryOpen && (
          <LibraryModal
            onClose={() => setIsLibraryOpen(false)}
            user={user}
            session={session}
            projects={projects}
            sharedProjects={sharedProjects}
            publicProjectIds={publicProjectIds}
            customCategories={customCategories}
            setCustomCategories={setCustomCategories}
            saveCustomCategoriesToDB={saveCustomCategoriesToDB}
            setTabs={setTabs}
            setActiveTabId={setActiveTabId}
            handleOpenProjectDetails={handleOpenProjectDetails}
            setContextMenu={setContextMenu}
            updateActiveTab={updateActiveTab}
            addToast={addToast}
            t={t}
            initialTab={libraryInitialTab}
          />
        )}
        <ProjectDetailModal
          isOpen={projectDetailModalOpen}
          project={projectDetailProject}
          isLoading={isLoadingProjectDetail}
          diagrams={projectDetailDiagrams}
          accessMap={projectDetailAccessMap}
          user={user}
          t={t}
          onClose={() => setProjectDetailModalOpen(false)}
          openProjectFile={openProjectFile}
          getDiagramRole={getDiagramRole}
          setContextMenu={setContextMenu}
          openWholeProject={openWholeProject}
        />

        <ContextMenu
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          setRenameType={setRenameType}
          setRenameTargetId={setRenameTargetId}
          setRenameValue={setRenameValue}
          setRenameModalOpen={setRenameModalOpen}
          customCategories={customCategories}
          setCustomCategories={setCustomCategories}
          saveCustomCategoriesToDB={saveCustomCategoriesToDB}
          libraryCategory={libraryCategory}
          setLibraryCategory={setLibraryCategory}
          setProjects={setProjects}
          projects={projects}
          user={user}
          addToast={addToast}
          setProjectToDelete={setProjectToDelete}
          setProjectDetailDiagrams={setProjectDetailDiagrams}
          setTabs={setTabs}
          downloadDiagramFile={downloadDiagramFile}
          setDiagramToDelete={setDiagramToDelete}
        />

        <RenameModal
          isOpen={renameModalOpen}
          renameType={renameType}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          onClose={() => {
            setRenameModalOpen(false);
            setRenameType(null);
            setRenameTargetId(null);
            setRenameValue('');
          }}
          onConfirm={handleRenameSubmit}
          t={t}
        />

        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} initialMode={authMode} />

        <SaveToCloudModal
          saveToCloudModalOpen={saveToCloudModalOpen}
          setSaveToCloudModalOpen={setSaveToCloudModalOpen}
          projects={projects}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          isSavingToCloud={isSavingToCloud}
          handleSaveToCloudSubmit={handleSaveToCloudSubmit}
          t={t}
          setNewModalTab={setNewModalTab}
          setIsNewModalOpen={setIsNewModalOpen}
          setIsSavingFlow={setIsSavingFlow}
        />

        {isAnonymousLoginOpen && pendingShareToken && (
          <AnonymousLoginModal
            isLoading={isJoiningShare}
            onJoin={(name) => handleRedeemShareLink(pendingShareToken, name)}
            onCancel={() => {
              setIsAnonymousLoginOpen(false);
              setPendingShareToken(null);
            }}
          />
        )}
        {toasts.length > 0 && (
          <div className="iso-toast-container">
            {toasts.map((t) => (
              <div key={t.id} className="iso-toast">
                {t.type === 'success' && <span style={{ color: 'var(--iso-success, #4caf50)' }}>✓</span>}
                {t.message}
              </div>
            ))}
          </div>
        )}
        <CommonModals
          diagramToDelete={diagramToDelete}
          setDiagramToDelete={setDiagramToDelete}
          handleConfirmDeleteDiagram={handleConfirmDeleteDiagram}
          projectToDelete={projectToDelete}
          setProjectToDelete={setProjectToDelete}
          setProjects={setProjects}
          addToast={addToast}
          isRevertModalOpen={isRevertModalOpen}
          setIsRevertModalOpen={setIsRevertModalOpen}
          confirmRevertHistory={confirmRevertHistory}
          tabToClose={tabToClose}
          setTabToClose={setTabToClose}
          tabs={tabs}
          setTabs={setTabs}
          activeTabId={activeTabId}
          setActiveTabId={setActiveTabId}
          t={t}
        />
      </>
    );
  };
  if (tabs.length === 0) {
    const isRedeeming = pendingShareToken || isJoiningShare || isAnonymousLoginOpen;
    return (
      <div className="iso-shell">
        <header className="iso-header">
          <button type="button" className="iso-logo" aria-label={t('ui.isomorph_home')}>
            <span className="iso-logo-name">Isomorph</span>
          </button>
        </header>
        {isRedeeming ? (
          <div
            className="iso-empty-state"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '60vh',
            }}
          >
            <div
              className="iso-spinner"
              style={{ width: '40px', height: '40px', borderWidth: '3px', marginBottom: '16px' }}
            />
            <p style={{ color: 'var(--iso-text-muted)', fontSize: '14px' }}>
              {t('share.loading') || 'Loading shared diagram...'}
            </p>
          </div>
        ) : (
          <div className="iso-empty-state">
            <h1 className="iso-empty-title">{t('welcome.title')}</h1>
            <p className="iso-empty-copy">{t('welcome.description')}</p>
            <div className="iso-empty-actions">
              <div className="iso-empty-group">
                <select
                  className="iso-modal-select"
                  style={{ marginBottom: 0, padding: '8px 12px' }}
                  value={newDiagramKind}
                  onChange={(e) => setNewDiagramKind(e.target.value as DiagramKind)}
                >
                  {DIAGRAM_KINDS.filter((k) => k !== 'all').map((k) => (
                    <option key={k} value={k}>
                      {t(`diagram_type.${k}`)}
                    </option>
                  ))}
                </select>
                <button
                  className="iso-btn iso-btn--primary"
                  style={{ padding: '8px 16px', justifyContent: 'center' }}
                  onClick={() => executeNewDiagram(newDiagramKind)}
                >
                  {t('welcome.create_new')}
                </button>
              </div>
              <div className="iso-empty-divider" aria-hidden="true"></div>
              <div className="iso-empty-group iso-empty-group--secondary">
                <button
                  className="iso-btn"
                  style={{ padding: '8px 16px', minHeight: '36px', justifyContent: 'center' }}
                  onClick={() => {
                    setLibraryInitialTab('open_folder');
                    setIsLibraryOpen(true);
                  }}
                >
                  {t('welcome.open_existing')}
                </button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".isx"
              onChange={handleFileOpen}
              style={{ display: 'none' }}
              tabIndex={-1}
            />
          </div>
        )}

        {/* ──────────────── MODALS (Empty State) ───────────────── */}
        {isNewModalOpen && (
          <div className="iso-modal-overlay" onClick={() => setIsNewModalOpen(false)}>
            <div className="iso-modal" onClick={(e) => e.stopPropagation()}>
              <h2 className="iso-modal-title">{t('welcome.create_new')}</h2>
              <p className="iso-modal-desc">{t("Select the type of diagram you'd like to create.")}</p>
              <select
                className="iso-modal-select"
                value={newDiagramKind}
                onChange={(e) => setNewDiagramKind(e.target.value as DiagramKind)}
              >
                {DIAGRAM_KINDS.filter((k) => k !== 'all').map((k) => (
                  <option key={k} value={k}>
                    {t(`diagram_type.${k}`)}
                  </option>
                ))}
              </select>
              <div className="iso-modal-actions">
                <button className="iso-modal-btn cancel" onClick={() => setIsNewModalOpen(false)}>
                  {t('ui.cancel')}
                </button>
                <button className="iso-modal-btn confirm" onClick={() => executeNewDiagram(newDiagramKind)}>
                  {t('ui.create')}
                </button>
              </div>
            </div>
          </div>
        )}
        {renderCommonModals()}
      </div>
    );
  }
  return (
    <div className="iso-shell">
      {/* ──────────────── HEADER ──────────────────────────── */}
      <Toolbar
        activeTab={activeTab}
        activeDiagram={activeDiagram}
        projects={projects}
        setProjects={setProjects}
        renamingTabId={renamingTabId}
        setRenamingTabId={setRenamingTabId}
        user={user}
        session={session}
        isMobileLayout={isMobileLayout}
        fileName={fileName}
        tabs={tabs}
        setTabs={setTabs}
        setActiveTabId={setActiveTabId}
        setTabToClose={setTabToClose}
        isConnected={isConnected}
        sortedCollaborators={sortedCollaborators}
        awareness={awareness}
        t={t}
        handleNew={handleNew}
        setIsLibraryOpen={handleOpenLibrary}
        setIsShareModalOpen={setIsShareModalOpen}
        handleTransformToCollaboration={handleTransformToCollaboration}
        isHistoryOpen={isHistoryOpen}
        toggleHistory={toggleHistory}
        isExporting={isExporting}
        exportTime={exportTime}
        exportMenuOpen={exportMenuOpen}
        setExportMenuOpen={setExportMenuOpen}
        handleExportPNG={handleExportPNG}
        handleExportSVG={handleExportSVG}
        handleExportGIF={handleExportGIF}
        handleExportMP4={handleExportMP4}
        isAnimationsEnabled={isAnimationsEnabled}
        setIsAnimating={setIsAnimating}
        isAnimating={isAnimating}
        setShortcutsOpen={setShortcutsOpen}
        fileInputRef={fileInputRef}
        handleFileOpen={handleFileOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        addToast={addToast}
      />

      {isMobileLayout && (
        <>
          <div className="iso-mobile-meta">
            {activeDiagram && <div className="iso-kind-badge iso-kind-badge--mobile">{activeDiagram.kind}</div>}
          </div>

          {tabs.length > 1 && (
            <div className="iso-mobile-strip">
              <nav className="iso-tabs" aria-label={t('tabs.open_files')}>
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`iso-tab${tab.id === activeTab?.id ? ' iso-tab--active' : ''}`}
                    onClick={() => {
                      setActiveTabId(tab.id);
                    }}
                    onDoubleClick={() => {
                      if (!tab.project_role || tab.project_role === 'owner') setRenamingTabId(tab.id);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {renamingTabId === tab.id ? (
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          autoFocus
                          defaultValue={
                            tab.name.includes('.') ? tab.name.substring(0, tab.name.lastIndexOf('.')) : tab.name
                          }
                          className="iso-tab-rename-input"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'inherit',
                            fontFamily: 'inherit',
                            fontSize: 'inherit',
                            outline: 'none',
                            width: '80px',
                            borderBottom: '1px solid currentColor',
                          }}
                          onBlur={(e) => {
                            const ext = tab.name.includes('.') ? tab.name.substring(tab.name.lastIndexOf('.')) : '';
                            const newName = e.target.value ? e.target.value + ext : tab.name;
                            setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, name: newName } : t)));
                            setRenamingTabId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') setRenamingTabId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span>{tab.name.includes('.') ? tab.name.substring(tab.name.lastIndexOf('.')) : ''}</span>
                      </span>
                    ) : (
                      <>
                        <span
                          style={{ cursor: activeTab?.project_id ? 'pointer' : 'default' }}
                          data-tooltip={activeTab?.project_id ? 'Double click to rename project' : undefined}
                        >
                          {tab.name}
                        </span>
                        {tabs.length > 1 && (
                          <button
                            type="button"
                            aria-label={t('tabs.close_name', { name: tab.name })}
                            style={{
                              all: 'unset',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 16,
                              height: 16,
                              borderRadius: 4,
                              opacity: 0.75,
                              fontSize: 13,
                              lineHeight: 1,
                              cursor: 'pointer',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTabToClose(tab.id);
                            }}
                          >
                            ×
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          )}

          <div className="iso-mobile-actions">
            <div className="iso-mobile-actions-group">
              {(!activeTab?.project_id || activeTab?.project_role === 'owner') && (
                <>
                  <button type="button" className="iso-btn" onClick={handleNew}>
                    <IconNew />
                    {t('menu.new')}
                  </button>
                  <button
                    type="button"
                    className="iso-btn"
                    onClick={() => {
                      setLibraryInitialTab('my');
                      setIsLibraryOpen(true);
                    }}
                  >
                    <IconOpen />
                    {t('menu.open')}
                  </button>
                </>
              )}

              {activeDiagram?.kind === 'sequence' && (
                <button type="button" className="iso-btn" onClick={handleTransformToCollaboration}>
                  <IconDiagram />
                  {t('menu.transform')}
                </button>
              )}
              {isAnimationsEnabled && activeDiagram && (
                <button
                  type="button"
                  className="iso-btn"
                  onClick={() => setIsAnimating((a) => !a)}
                  style={{ color: isAnimating ? 'var(--iso-accent)' : 'inherit' }}
                >
                  {isAnimating ? '⏸' : '▶'} {isAnimating ? t('ui.pause') : t('ui.play')}
                </button>
              )}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="iso-btn"
                  onClick={() => setExportMenuOpen((o) => !o)}
                  disabled={!activeDiagram}
                >
                  <IconExport />
                  {t('ui.export')}
                </button>
                <ExportModal
                  isOpen={exportMenuOpen && !!activeDiagram}
                  onClose={() => setExportMenuOpen(false)}
                  position="bottom"
                  handleExportPNG={handleExportPNG}
                  handleExportSVG={handleExportSVG}
                  handleExportGIF={handleExportGIF}
                  handleExportMP4={handleExportMP4}
                  isAnimationsEnabled={isAnimationsEnabled}
                  t={t}
                />
              </div>
            </div>
            <div className="iso-mobile-actions-group iso-mobile-actions-group--secondary">
              <button
                type="button"
                className="iso-btn"
                onClick={() => {
                  if (!activeTab) return;
                  const blob = new Blob([activeTab.source], { type: 'application/octet-stream' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = activeTab.name || 'diagram.isx';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={!activeTab}
              >
                <IconSave />
                {t('menu.save')}
              </button>
              <button
                type="button"
                className="iso-btn iso-btn--icon"
                onClick={() => setShortcutsOpen((o) => !o)}
                aria-label={t('ui.shortcuts')}
              >
                <IconKeyboard />
              </button>
              <select
                className="iso-select"
                aria-label={t('ui.language')}
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                style={{ width: 'auto', minHeight: 32 }}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="iso-btn iso-btn--icon"
                onClick={() => {
                  const next = themeMode === 'light' ? 'dark' : 'light';
                  setThemeMode(next);
                  document.documentElement.setAttribute('data-theme', next);
                  localStorage.setItem('isomorph-theme', next);
                }}
                aria-label={t('ui.toggle_theme')}
              >
                {themeMode === 'light' ? <IconMoon /> : <IconSun />}
              </button>
              <label className="iso-mobile-toggle">
                <input type="checkbox" checked={isUMLCompliant} onChange={(e) => setIsUMLCompliant(e.target.checked)} />
                {t('ui.strict_uml')}
              </label>
            </div>
          </div>
        </>
      )}

      {isMobileLayout && (
        <div className="iso-mobile-bar">
          <button
            type="button"
            className={`iso-mobile-tab${mobilePane === 'code' ? ' iso-mobile-tab--active' : ''}`}
            onClick={() => setMobilePane('code')}
          >
            {t('ui.source')}
          </button>
          <button
            type="button"
            className={`iso-mobile-tab${mobilePane === 'diagram' ? ' iso-mobile-tab--active' : ''}`}
            onClick={() => setMobilePane('diagram')}
          >
            {t('ui.canvas')}
          </button>
        </div>
      )}

      {/* ──────────────── MAIN ────────────────────────────── */}
      <main className="iso-main">
        {isMobileLayout ? (
          <div className="iso-mobile-main">
            {mobilePane === 'code' && sourcePane}
            {mobilePane === 'diagram' && mobileCanvasPane}
          </div>
        ) : (
          <>
            <div
              style={{
                width:
                  isHistoryOpen || activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
                    ? 0
                    : 'var(--iso-sidebar-width, 200px)',
                overflow: 'hidden',
                transition: 'width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.3s ease',
                opacity:
                  isHistoryOpen || activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'
                    ? 0
                    : 1,
                flexShrink: 0,
              }}
            >
              {activeTab?.project_role !== 'viewer' && activeTab?.project_role !== 'commenter' && (
                <Sidebar activeDiagram={activeDiagram} activeTab={activeTab} t={t} />
              )}
            </div>
            <SplitPane left={sourcePane} right={canvasPane} separatorLabel={t('tool.resize_panels')} />
            <div
              style={{
                width: isHistoryOpen ? 'var(--iso-sidebar-width, 200px)' : 0,
                overflow: 'hidden',
                transition: 'width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.3s ease',
                opacity: isHistoryOpen ? 1 : 0,
                flexShrink: 0,
                borderLeft: isHistoryOpen ? '1px solid var(--iso-border)' : 'none',
                background: 'var(--iso-bg-sidebar)',
              }}
            >
              <HistoryPane
                diagramHistoryList={diagramHistoryList}
                selectedHistoryId={selectedHistoryId}
                setSelectedHistoryId={setSelectedHistoryId}
                user={user}
                setIsRevertModalOpen={setIsRevertModalOpen}
              />
            </div>
          </>
        )}
      </main>

      <EditEntityModal
        editingEntity={editingEntity}
        setEditingEntity={setEditingEntity}
        handleEntityEdit={handleEntityEdit}
        t={t}
        isMobileLayout={isMobileLayout}
        activeDiagram={activeDiagram}
      />

      <EditRelationModal
        editingRelation={editingRelation}
        setEditingRelation={setEditingRelation}
        activeDiagram={activeDiagram}
        t={t}
        isMobileLayout={isMobileLayout}
        handleRelationEdit={handleRelationEdit}
        updateActiveTab={updateActiveTab}
        formatDiagramSource={formatDiagramSource}
      />

      <EditTextModal
        editingText={editingText}
        setEditingText={setEditingText}
        updateActiveTab={updateActiveTab}
        t={t}
        isMobileLayout={isMobileLayout}
      />

      {/* ──────────────── STATUS BAR ──────────────────────── */}
      <StatusBar source={source} activeDiagram={activeDiagram} t={t} />

      {/* ──────────────── SHORTCUTS OVERLAY ───────────────── */}
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} t={t} />

      {/* ──────────────── MODALS ───────────────── */}
      <NewDiagramModal
        isNewModalOpen={isNewModalOpen}
        setIsNewModalOpen={setIsNewModalOpen}
        setIsSavingFlow={setIsSavingFlow}
        newModalTab={newModalTab}
        setNewModalTab={setNewModalTab}
        newDiagramKind={newDiagramKind}
        setNewDiagramKind={setNewDiagramKind}
        executeNewDiagram={executeNewDiagram}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        newProjectError={newProjectError}
        setNewProjectError={setNewProjectError}
        isCreatingProject={isCreatingProject}
        handleCreateProjectSubmit={handleCreateProjectSubmit}
        user={user}
        t={t}
      />

      {renderCommonModals()}

      {isShareModalOpen && activeTab?.project_id && (
        <ShareModal
          projectId={activeTab.project_id}
          diagramId={activeTab.diagram_id || undefined}
          diagramName={activeTab.name || undefined}
          onClose={() => setIsShareModalOpen(false)}
          onToast={addToast}
          language={language}
          onShareChange={refreshPublicProjects}
        />
      )}
    </div>
  );
}
