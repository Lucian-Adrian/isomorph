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
import { IconCode, IconDiagram, IconExport, IconNew, IconOpen, IconKeyboard, IconSave, IconSun, IconMoon, IconShapes, IconCanvas, IconTransform, IconSettings, IconAlertTriangle, IconFileImage, IconImage, IconVideo, IconGif } from './components/Icons.js';
import { parse } from './parser/index.js';
import { analyze } from './semantics/analyzer.js';
import { formatAllErrors } from './utils/error-formatter.js';
import { exportSVG, exportPNG } from './utils/exporter.js';
import { EXAMPLES } from './data/examples.js';
import type { IOMDiagram, IOMEntity } from './semantics/iom.js';
import type { ParseError } from './parser/index.js';
import type { DiagramKind, SequenceMessageType, WorkspaceTab } from './types/index.js';
import { LANGUAGE_OPTIONS, getStoredLanguage, setStoredLanguage, tText, type Language } from './i18n.js';
import { computeLayout } from './utils/auto-layout.js';
import { useAuth } from './lib/auth-context.js';
import { AuthModal } from './components/AuthModal.js';
import { getProjects, getSharedProjects, getPublicProjectIds, type Project, getDiagramHistory, deleteDiagramHistoryAfter, type DiagramHistory } from './lib/projects.js';
import { isTelemetryEnabled, setTelemetryEnabled, logEvent } from './lib/telemetry.js';
import { useCollaboration } from './lib/collaboration.js';
import { ShareModal } from './components/ShareModal.js';
import { AnonymousLoginModal } from './components/AnonymousLoginModal.js';
import { useWorkspace } from './hooks/useWorkspace.js';

// Types extracted to src/types/index.ts: DiagramKind, WorkspaceTab, SequenceMessageType
import { DIAGRAM_KINDS, ENTITY_KINDS_RX } from './constants.js';

// Constants extracted to src/constants.ts: DIAGRAM_KINDS, REL_TOKENS_BY_KIND

// SequenceMessageType extracted to src/types/index.ts
import {
  slugId,
  escapeRegex,
  inferSequenceMessageType,
  toolsetFor,
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
  insertSequenceLifecycleAfterRelation,
  hasEntityDeclaration,
  ensureUseCaseBoundaryDeclaration,
  extractEntityBody,
  extractEntityDeclaration,
  removeEntityDeclaration,
  replaceEntityBody,
  entitySupportsBody,
  entitySupportsStereotype,
  updateEntityDeclaration,
  normalizePartitionDeclaration,
  normalizeBoundaryDeclaration
} from './utils/source-manipulation.js';

import { getStencilsForKind } from './utils/stencils.js';
import { templateFor } from './utils/templates.js';
import { formatDiagramSource, sequenceToCollaborationSource } from './utils/formatting.js';

// ── App ──────────────────────────────────────────────────────

export default function App() {
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
  const [editingEntity, setEditingEntity] = useState<(IOMEntity & { bodyText?: string; origName?: string; elseBlocks?: { label?: string }[] }) | null>(null);
  const [editingText, setEditingText] = useState<{ oldName: string, newName: string, type: 'diagram' | 'package' } | null>(null);
  const [editingRelation, setEditingRelation] = useState<{ relationId: string, label: string, kind: string, direction: 'forward' | 'reverse', fromMult?: string, toMult?: string, seqMessageType?: SequenceMessageType } | null>(null);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' }[]>([]);
  const [collabShowTrail, setCollabShowTrail] = useState(true);
  const [collabShowNameLabel, setCollabShowNameLabel] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0);

  const addToast = useCallback((message: string, type: 'success' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);
  const [pendingMobileDropKeyword, setPendingMobileDropKeyword] = useState<string | null>(null);
  const examplesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'collab' | 'storage' | 'app'>('profile');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [diagramHistoryList, setDiagramHistoryList] = useState<DiagramHistory[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [isRevertModalOpen, setIsRevertModalOpen] = useState(false);

  const [libraryTab, setLibraryTab] = useState<'my' | 'shared' | 'open_folder' | 'examples'>('my');
  const [isExporting, setIsExporting] = useState(false);
  const [exportTime, setExportTime] = useState<number>(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
  const [publicProjectIds, setPublicProjectIds] = useState<Set<string>>(new Set());
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [saveToCloudModalOpen, setSaveToCloudModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectError, setNewProjectError] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [libraryVisibilityFilter, setLibraryVisibilityFilter] = useState('all');
  const [librarySort, setLibrarySort] = useState('accessed');
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(() => {
    const val = localStorage.getItem('isomorph-autosave');
    return val ? parseFloat(val) : 0;
  });
  const [newModalTab, setNewModalTab] = useState<'tab' | 'project'>('tab');
  const [libraryCategory, setLibraryCategory] = useState<string>('All Projects');
  const [customCategories, setCustomCategories] = useState<string[]>(['Favorites', 'Work', 'Personal']);
  const [newCategoryPrompt, setNewCategoryPrompt] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Staged files and folder drag-and-drop
  const [localStagedFiles, setLocalStagedFiles] = useState<Array<{ name: string; source: string; id: string }>>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const localFileInputRef = useRef<HTMLInputElement>(null);

  // Project details modal states
  const [projectDetailModalOpen, setProjectDetailModalOpen] = useState(false);
  const [projectDetailProject, setProjectDetailProject] = useState<Project | null>(null);
  const [projectDetailDiagrams, setProjectDetailDiagrams] = useState<any[]>([]);
  const [projectDetailAccessMap, setProjectDetailAccessMap] = useState<{ base: string; diagrams: Record<string, string> }>({ base: 'viewer', diagrams: {} });
  const [isLoadingProjectDetail, setIsLoadingProjectDetail] = useState(false);
  const [diagramToDelete, setDiagramToDelete] = useState<any | null>(null);

  const [contextMenu, setContextMenu] = useState<{ type: 'category' | 'project' | 'diagram', id: string, x: number, y: number, extra?: any } | null>(null);

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameType, setRenameType] = useState<'project' | 'category' | 'diagram' | null>(null);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isSavingFlow, setIsSavingFlow] = useState(false);

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const { session, user, signOut, loading } = useAuth();

  const [profile, setProfile] = useState<{ full_name?: string | null, username?: string | null, avatar_url?: string | null, tier?: string | null, settings?: any } | null>(null);

  // Share and Anonymous states
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isAnonymousLoginOpen, setIsAnonymousLoginOpen] = useState(false);
  const [anonymousName, setAnonymousName] = useState<string | null>(() => localStorage.getItem('isomorph-anon-name'));
  const [pendingShareToken, setPendingShareToken] = useState<string | null>(null);
  const [urlShareToken, setUrlShareToken] = useState<string | null>(null);
  const [isJoiningShare, setIsJoiningShare] = useState(false);

  useEffect(() => {
    if (user) {
      import('./lib/profile.js').then(({ getProfile }) => {
        getProfile(user.id).then(async data => {
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

  // 1. Read share token from URL on mount only
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareToken = params.get('share');
    if (shareToken) {
      setUrlShareToken(shareToken);
      // Remove token from URL immediately to keep it clean
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // 2. Process the share link after auth loading settles
  useEffect(() => {
    if (loading) return;
    if (urlShareToken) {
      setPendingShareToken(urlShareToken);
      if (user) {
        handleRedeemShareLink(urlShareToken);
      } else {
        const savedAnonName = localStorage.getItem('isomorph-anon-name');
        if (savedAnonName) {
          handleRedeemShareLink(urlShareToken, savedAnonName);
        } else {
          setIsAnonymousLoginOpen(true);
        }
      }
      setUrlShareToken(null); // Mark as processed
    }
  }, [loading, urlShareToken, user]);

  const handleRedeemShareLink = async (token: string, anonName?: string) => {
    setIsJoiningShare(true);
    const { supabase } = await import('./lib/supabase.js');
    if (user) {
      // Logged in: redeem via RPC
      const { data: success, error } = await supabase.rpc('redeem_share_link', { p_token: token });
      if (success && !error) {
        addToast('Project access granted!', 'success');
        // Let's fetch the project and open it
        const { data: projData } = await supabase.rpc('get_shared_project_data', { p_token: token });
        if (projData && projData.project && projData.diagrams) {
          // Log audit: share link redeemed
          const { logAudit } = await import('./lib/audit.js');
          await logAudit('share_link_redeemed', 'share_link', undefined, { token, projectId: projData.project.id });

          // Add project to projects list so its name resolves in the breadcrumbs
          setProjects(prev => {
            if (!prev.some(p => p.id === projData.project.id)) {
              return [projData.project, ...prev];
            }
            return prev;
          });
          openWholeProject(projData.diagrams, projData.project.id, projData.role || 'editor');
        }
      } else {
        addToast('Invalid or expired share link', 'info');
      }
    } else {
      // Anonymous
      const { data: projData, error } = await supabase.rpc('get_shared_project_data', { p_token: token });
      if (projData && projData.project && projData.diagrams && !error) {
        // Log audit: share link redeemed
        const { logAudit } = await import('./lib/audit.js');
        await logAudit('share_link_redeemed', 'share_link', undefined, { token, projectId: projData.project.id, anonymous: true });

        if (anonName) {
          setAnonymousName(anonName);
          localStorage.setItem('isomorph-anon-name', anonName);
        }
        setIsAnonymousLoginOpen(false);
        addToast(`Joined project ${projData.project.name} anonymously`);
        // Add project to projects list so its name resolves in the breadcrumbs
        setProjects(prev => {
          if (!prev.some(p => p.id === projData.project.id)) {
            return [projData.project, ...prev];
          }
          return prev;
        });
        openWholeProject(projData.diagrams, projData.project.id, projData.role || 'viewer');
      } else {
        addToast('Invalid or expired share link', 'info');
      }
    }
    setIsJoiningShare(false);
    setPendingShareToken(null);
  };

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
      }
    ]);
    setActiveTabId(defaultId);
  }, [signOut]);

  const handleResetPassword = async (pass: string) => {
    if (!pass || pass.length < 6) {
      addToast('Password must be at least 6 characters long', 'info');
      return;
    }
    const { supabase } = await import('./lib/supabase.js');
    const { error } = await supabase.auth.updateUser({ password: pass });
    if (error) {
      addToast(error.message, 'info');
    } else {
      setNewPassword('');
      addToast('Password updated successfully');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    const { logAudit } = await import('./lib/audit.js');
    await logAudit('account_deleted');

    const { supabase } = await import('./lib/supabase.js');
    const { error } = await supabase.rpc('delete_user');
    if (error) {
      console.warn('RPC delete failed, falling back to profile row delete:', error);
      const { error: deleteError } = await supabase.from('profiles').delete().eq('id', user.id);
      if (deleteError) {
        addToast('Failed to delete account', 'info');
        return;
      }
    }
    await handleSignOut();
    setIsDeleteModalOpen(false);
    setDeleteStep(0);
    addToast('Account deleted successfully');
  };

  const saveCustomCategoriesToDB = async (cats: string[]) => {
    if (user && profile) {
      const { supabase } = await import('./lib/supabase.js');
      // Fix double saving by not spreading the corrupted top-level "tabs"
      const currentSettings = profile.settings || {};
      const { tabs, ...cleanSettings } = currentSettings as any;
      const { error } = await supabase.from('profiles').update({
        settings: {
          ...cleanSettings,
          projects: {
            tabs: cats
          }
        }
      }).eq('id', user.id);
      if (!error) {
        setProfile(p => p ? { ...p, settings: { ...cleanSettings, projects: { tabs: cats } } } : null);
      }
    }
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (!trimmed || !renameTargetId || !renameType) return;

    if (renameType === 'project') {
      import('./lib/projects.js').then(({ updateProject }) => {
        if (user) {
          updateProject(user.id, renameTargetId, { name: trimmed }).then(success => {
            if (success) {
              setProjects(prev => prev.map(p => p.id === renameTargetId ? { ...p, name: trimmed } : p));
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
      const next = customCategories.map(c => c === oldName ? trimmed : c);
      setCustomCategories(next);
      saveCustomCategoriesToDB(next);

      setProjects(prev => prev.map(p => {
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
      }));

      if (libraryCategory === oldName) {
        setLibraryCategory(trimmed);
      }
      addToast('Category renamed');
    } else if (renameType === 'diagram') {
      import('./lib/projects.js').then(({ updateDiagram }) => {
        updateDiagram(renameTargetId, { name: trimmed }).then(success => {
          if (success) {
            setProjectDetailDiagrams(prev => prev.map(d => d.id === renameTargetId ? { ...d, name: trimmed } : d));
            setTabs(prev => prev.map(t => t.diagram_id === renameTargetId ? { ...t, name: trimmed } : t));
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
          diagrams: mapping
        });
      } else {
        setProjectDetailAccessMap({
          base: (project as any).role || 'viewer',
          diagrams: {}
        });
      }
    } catch (error) {
      console.error('Failed to load project files:', error);
      addToast('Failed to load project files', 'info');
    } finally {
      setIsLoadingProjectDetail(false);
    }
  };

  const getDiagramRole = useCallback((diagramId: string) => {
    if (!projectDetailProject || !user) return 'viewer';
    if (projectDetailProject.owner_id === user.id) return 'owner';
    return projectDetailAccessMap.diagrams[diagramId] || projectDetailAccessMap.base || 'viewer';
  }, [projectDetailProject, user, projectDetailAccessMap]);

  const openProjectFile = useCallback((diagram: any, projectId: string, role: string = 'owner') => {
    setTabs(prev => {
      const existingTab = prev.find(t => t.diagram_id === diagram.id);
      if (existingTab) {
        setTimeout(() => setActiveTabId(existingTab.id), 0);
        return prev;
      }
      const content = diagram.content as any;
      const sourceText = typeof content === 'string' ? content : (content?.source || '');
      const newTab: WorkspaceTab = {
        id: diagram.id,
        name: diagram.name,
        source: sourceText,
        activeDiagramIdx: 0,
        diagramKindFilter: diagram.kind as 'all' | DiagramKind,
        diagram_id: diagram.id,
        project_id: projectId,
        savedSource: sourceText,
        project_role: role
      };
      setTimeout(() => setActiveTabId(newTab.id), 0);
      return [...prev, newTab];
    });
    setProjectDetailModalOpen(false);
    setIsLibraryOpen(false);
  }, []);

  const openWholeProject = useCallback((diagrams: any[], projectId: string, role: string = 'owner', rolesMap?: Record<string, string>) => {
    if (diagrams.length === 0) {
      const newTabId = `tab-${slugId()}`;
      setTabs([{
        id: newTabId,
        name: 'Untitled Diagram',
        source: templateFor('class'),
        activeDiagramIdx: 0,
        diagramKindFilter: 'all',
        project_id: projectId,
        project_role: role
      }]);
      setActiveTabId(newTabId);
      addToast('Opened empty project', 'info');
      setProjectDetailModalOpen(false);
      setIsLibraryOpen(false);
      return;
    }

    setTabs(prev => {
      const next: WorkspaceTab[] = [];
      let firstTabIdToSelect: string | null = null;
      diagrams.forEach(d => {
        const diagramRole = rolesMap?.[d.id] || role;
        const existing = prev.find(t => t.diagram_id === d.id);
        if (existing) {
          next.push({ ...existing, project_role: diagramRole, project_id: projectId });
          if (!firstTabIdToSelect) firstTabIdToSelect = existing.id;
        } else {
          const content = d.content as any;
          const sourceText = typeof content === 'string' ? content : (content?.source || '');
          const newTab: WorkspaceTab = {
            id: d.id,
            name: d.name,
            source: sourceText,
            activeDiagramIdx: 0,
            diagramKindFilter: d.kind as 'all' | DiagramKind,
            diagram_id: d.id,
            project_id: projectId,
            savedSource: sourceText,
            project_role: diagramRole
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
  }, []);

  const handleLoadedFiles = (files: File[]) => {
    const isxFiles = files.filter(f => f.name.endsWith('.isx'));
    if (isxFiles.length === 0) {
      addToast('No valid .isx files found', 'info');
      return;
    }

    let loadedCount = 0;
    const newStagedFiles: Array<{ name: string; source: string; id: string }> = [];

    isxFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          newStagedFiles.push({
            id: `staged-${slugId()}`,
            name: file.name,
            source: reader.result
          });
        }
        loadedCount++;
        if (loadedCount === isxFiles.length) {
          setLocalStagedFiles(prev => [...prev, ...newStagedFiles]);
          addToast(`Loaded ${newStagedFiles.length} file(s) for preview`);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) {
      handleLoadedFiles(files);
    }
  };

  const handleConfirmDeleteDiagram = () => {
    if (!diagramToDelete) return;
    import('./lib/projects.js').then(({ deleteDiagram }) => {
      deleteDiagram(diagramToDelete.id).then(success => {
        if (success) {
          // Remove from details modal list
          setProjectDetailDiagrams(prev => prev.filter(d => d.id !== diagramToDelete.id));
          // Close workspace tab if open
          setTabs(prev => {
            const next = prev.filter(t => t.diagram_id !== diagramToDelete.id);
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
    const sourceText = typeof content === 'string' ? content : (content?.source || '');
    const blob = new Blob([sourceText], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = diagram.name.endsWith('.isx') ? diagram.name : `${diagram.name}.isx`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Diagram downloaded');
  };

  const autoSaveProfile = async (updates: { full_name?: string | null; username?: string | null; avatar_url?: string | null; settings?: any }) => {
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
      updated_at: new Date().toISOString()
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
      ...settingsUpdates
    };

    const { supabase } = await import('./lib/supabase.js');
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: profile.full_name,
      username: profile.username,
      avatar_url: profile.avatar_url,
      settings: newSettings,
      updated_at: new Date().toISOString()
    });

    if (error) {
      console.error('Error auto-saving settings:', error);
    } else {
      setProfile({ ...profile, settings: newSettings });
    }
  };


  const refreshPublicProjects = useCallback(() => {
    getPublicProjectIds().then(data => setPublicProjectIds(data));
  }, []);

  useEffect(() => {
    if (user) {
      getProjects(user.id).then(data => setProjects(data));
      getSharedProjects(user.id).then(data => setSharedProjects(data));
      refreshPublicProjects();
    } else {
      setProjects([]);
      setSharedProjects([]);
      setPublicProjectIds(new Set());
    }
  }, [user, refreshPublicProjects]);

  const [selectedItems, setSelectedItems] = useState<{ type: 'entity' | 'relation', id: string }[]>([]);
  const t = useCallback((key: string, vars?: Record<string, string | number>) => tText(language, key, vars), [language]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) ?? tabs[0], [tabs, activeTabId]);

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
    profile?.username || undefined
  );

  const isCollabActive = !!(activeTab?.diagram_id && connectedDiagramId === activeTab.diagram_id);
  const [isCollabDropdownOpen, setIsCollabDropdownOpen] = useState(false);
  const collabRef = useRef<HTMLDivElement>(null);

  const getInitials = useCallback((name: string) => {
    const clean = name.trim();
    if (!clean) return '?';
    const parts = clean.split(/\s+/);
    if (parts.length > 1) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }, []);

  const sortedCollaborators = useMemo(() => {
    if (!collaborators || !awareness) return [];
    const localClientId = awareness.clientID;
    const localUser = collaborators.find(c => c.clientId === localClientId);
    const otherUsers = collaborators.filter(c => c.clientId !== localClientId);
    return localUser ? [localUser, ...otherUsers] : otherUsers;
  }, [collaborators, awareness]);

  const source = activeTab?.source ?? '';
  const selectedHistoryItem = diagramHistoryList.find(h => h.id === selectedHistoryId);
  const displaySource = selectedHistoryItem ? selectedHistoryItem.content?.source || '' : source;
  const fileName = activeTab?.name ?? 'untitled.isx';

  const updateActiveTab = useCallback((update: (tab: WorkspaceTab) => WorkspaceTab, saveHistory = true) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id === (activeTab?.id ?? '')) {
        const result = update(tab);
        if (saveHistory && result.source !== tab.source) {
          result.undoStack = [...(tab.undoStack || []), tab.source];
          result.redoStack = [];
        }
        return result;
      }
      return tab;
    }));
  }, [activeTab]);

  // ── Paste cascade counter (Feature 15) ──────────────────
  const pasteCounterRef = useRef(1);

  // ── Unsaved-changes guard (Feature 16) ──────────────────
  const hasUnsavedChanges = useMemo(() => tabs.some(t => t.savedSource !== undefined && t.source !== t.savedSource), [tabs]);

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

  // ── Close collaboration dropdown on outside click or Escape ──
  useEffect(() => {
    function handleOutsideCollabClick(e: Event) {
      if (collabRef.current && !collabRef.current.contains(e.target as Node)) {
        setIsCollabDropdownOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsCollabDropdownOpen(false);
      }
    }
    if (isCollabDropdownOpen) {
      document.addEventListener('click', handleOutsideCollabClick);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('click', handleOutsideCollabClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isCollabDropdownOpen]);

  // ── Parse + analyze on every keystroke ───────────────────
  const parseResult = useMemo(() => {
    try { return parse(displaySource); } catch { return null; }
  }, [displaySource]);

  const analysisResult = useMemo(() => {
    if (!parseResult) return null;
    try { return analyze(parseResult.program); } catch { return null; }
  }, [parseResult]);

  const parseErrors: ParseError[] = parseResult?.errors ?? [];
  const rawSemanticErrors = analysisResult?.errors ?? [];

  // Rules that enforce strict UML semantics
  const strictUmlRules = ['SS-4', 'SS-5', 'SS-6', 'SS-11'];
  const semanticErrors = rawSemanticErrors.filter(e => isUMLCompliant || !strictUmlRules.includes(e.rule));

  const allErrors: string[] = formatAllErrors(parseErrors, semanticErrors);

  // Combined parse + semantic diagnostics for the editor lint gutter
  const editorDiagnostics: LintDiagnostic[] = [
    ...parseErrors.map(e => ({ message: e.message, line: e.line, col: e.col, severity: 'error' as const })),
    ...semanticErrors
      .filter((e): e is typeof e & { line: number; col: number } => e.line != null)
      .map(e => ({ message: `(${e.rule}) ${e.message}`, line: e.line, col: e.col ?? 1, severity: 'error' as const })),
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

      setProjects(prev => [p, ...prev]);
      addToast('Project created successfully', 'success');

      if (isSavingFlow) {
        const d = await createDiagram(user.id, p.id, activeTab.name, activeDiagram?.kind || 'class', { source: activeTab.source });
        if (d) {
          updateActiveTab(tab => ({ ...tab, project_id: p.id, diagram_id: d.id, savedSource: tab.source, project_role: 'owner' }), false);
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
          setTabs(prev => [
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
  }, [user, newProjectName, isSavingFlow, activeTab, activeDiagram, updateActiveTab, newDiagramKind, isCreatingProject]);

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



  const getPlacedItemPosition = useCallback((name: string) => {
    const partitionPos = activeDiagram?.partitions.find(p => p.name === name)?.position;
    if (partitionPos) return partitionPos;
    const fragmentPos = activeDiagram?.fragments?.find(f => f.id === name)?.position;
    if (fragmentPos) return fragmentPos;
    return activeDiagram?.entities.get(name)?.position;
  }, [activeDiagram]);

  // ── Bidirectional: drag entity → update @Entity at ───────
  const handleEntityMove = useCallback((name: string, x: number, y: number, dragDx?: number, dragDy?: number, seedPositions?: Record<string, { x: number; y: number; w?: number; h?: number }>) => {
    updateActiveTab(tab => {
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
        const pkg = activeDiagram.packages.find(p => p.name === name);
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
                src = updateEntityPosition(src, eName, Math.round(ent.position.x + dx), Math.round(ent.position.y + dy), ent.position.w, ent.position.h);
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
  }, [updateActiveTab, activeDiagram, getPlacedItemPosition]);

  const handleEntityResize = useCallback((name: string, w: number, h: number, x?: number, y?: number) => {
    updateActiveTab(tab => {
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
        source: formatDiagramSource(updateEntityPosition(src, targetName, resizeX, resizeY, Math.round(w), Math.round(h))),
      };
    });
  }, [updateActiveTab, getPlacedItemPosition, activeDiagram]);

  const handleRelationVerticalMove = useCallback((relationId: string, y: number, seedRelationYs?: Record<string, number>) => {
    updateActiveTab(tab => {
      let src = tab.source;
      if (seedRelationYs && Object.keys(seedRelationYs).length > 0) {
        src = updateRelationVerticalPositions(src, seedRelationYs);
      }
      src = updateRelationVerticalPosition(src, relationId, y);
      return { ...tab, source: formatDiagramSource(src) };
    });
  }, [updateActiveTab]);

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
  }, [allErrors]);

  const handleEntityEditRequest = useCallback((entity: IOMEntity) => {
    let body = '';
    if (activeTab) {
      body = extractEntityBody(activeTab.source, entity.name) ?? '';
    }
    // Strip leading uniform indentation and tabs from body for display
    if (body) {
      body = body.replace(/\t/g, '  ');
      const bodyLines = body.split('\n');
      // Find minimum leading spaces
      const minIndent = bodyLines.filter(l => l.trim()).reduce((min, l) => {
        const match = l.match(/^(\s*)/);
        return match ? Math.min(min, match[1].length) : min;
      }, Infinity);
      if (minIndent > 0 && minIndent < Infinity) {
        body = bodyLines.map(l => l.slice(minIndent)).join('\n');
      }
    }
    setEditingEntity({ ...entity, bodyText: body, origName: entity.name });
  }, [activeTab]);

  const handleRelationEditRequest = useCallback((relationId: string, label: string, kind: string) => {
    // Also extract multiplicities from the source for editing
    const rel = activeDiagram?.relations.find(r => r.id === relationId);
    setEditingRelation({
      relationId,
      label,
      kind,
      direction: 'forward',
      fromMult: rel?.fromMult || '',
      toMult: rel?.toMult || '',
      seqMessageType: activeDiagram?.kind === 'sequence' ? inferSequenceMessageType(kind, rel?.from, rel?.to) : undefined,
    });
  }, [activeDiagram]);

  const handleTextRenameRequest = useCallback((oldName: string, _newName: string, type: 'diagram' | 'package') => { setEditingText({ oldName, newName: oldName, type }); }, []);
  const handleRelationAddRequest = useCallback((fromEntity: string, toEntity: string, y?: number) => {
    updateActiveTab(tab => {
      const relationLine = activeDiagram?.kind === 'sequence' && y !== undefined
        ? `  ${fromEntity} --> ${toEntity} [y="${y}"]`
        : `  ${fromEntity} --> ${toEntity}`;
      let newSource = insertRelation(tab.source, relationLine);
      newSource = formatDiagramSource(newSource);
      return { ...tab, source: newSource };
    });
  }, [updateActiveTab, activeDiagram]);

  const handleEntityEdit = useCallback((entityName: string, updates: { name?: string; stereotype?: string; isAbstract?: boolean; bodyText?: string; kind?: string; elseBlocks?: { label?: string }[] }) => {
    updateActiveTab(tab => {
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
                if (id === entityName) { foundFrag = item; }
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
  }, [updateActiveTab]);

  const handleRelationEdit = useCallback((
    relationId: string,
    updates: { label?: string; kind?: string; direction?: 'forward' | 'reverse'; fromMult?: string; toMult?: string; seqMessageType?: SequenceMessageType },
  ) => {
    updateActiveTab(tab => {
      let src = updateRelationById(tab.source, relationId, updates, activeDiagram?.kind);
      src = formatDiagramSource(src);
      return { ...tab, source: src };
    });
    setEditingRelation(null);
  }, [updateActiveTab, activeDiagram]);

  const handleDropEntity = useCallback((keyword: string, x: number, y: number, targetPackage?: string) => {
    updateActiveTab(tab => {
      let src = tab.source.trim();
      if (!src || src.lastIndexOf('}') < 0) {
        const dk = tab.diagramKindFilter === 'all' ? 'class' : (tab.diagramKindFilter || 'class');
        src = `diagram NewDiagram : ${dk} {\n\n}\n`;
      }

      const baseName = keyword.split(' ')[0]; // for "node <<device>>", baseName is "node"

      let index = 1;
      const prefixName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
      let name = `${prefixName}${index}`;
      while (new RegExp(`${ENTITY_KINDS_RX}[ \\t]+${name}\\b`).test(src)) {
        index++;
        name = `${prefixName}${index}`;
      }

      const BRACE_KINDS = ['class', 'interface', 'component', 'node', 'state', 'usecase', 'package', 'composite', 'concurrent', 'environment', 'artifact', 'device', 'enum', 'note'];
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
        if (targetPackage) { src = insertIntoPackage(src, targetPackage, declaration); } else { src = insertBeforeAnnotations(src, declaration); }
        src = insertAtEnd(src, `  @${name} at (${Math.round(x)}, ${Math.round(y)})`);
      }
      src = formatDiagramSource(src);
      return { ...tab, source: src };
    });
  }, [updateActiveTab]);

  const handleStencilInsert = useCallback((keyword: string) => {
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
  }, [activeDiagram, handleDropEntity, isMobileLayout]);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const clickHandler = () => setExportMenuOpen(false);
    window.addEventListener('click', clickHandler);
    return () => window.removeEventListener('click', clickHandler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip Escape handling here, handled in the other useEffect

      // Skip if user is focused on CodeMirror editor or an input/textarea
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
                // Wipe entity block properly considering nested braces
                nextSource = removeEntityDeclaration(nextSource, item.id);
                // Wipe annotations
                const rxAnno = new RegExp(`^[ \\t]*@${escapeRegex(item.id)}[ \\t]+at[ \\t]*\\([^)]+\\)[ \\t]*\\n?`, 'gm');
                nextSource = nextSource.replace(rxAnno, '');
                // Wipe relations connected to this
                const rxRel = new RegExp(`^[ \\t]*(?:${escapeRegex(item.id)}[ \\t]+(?:--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|<\\.\\.|o--|\\*--|-->|->|\\.\\.>|--o|--\\*|--x|--)[ \\t]+[A-Za-z_][\\w]*|[A-Za-z_][\\w]*[ \\t]+(?:--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|<\\.\\.|o--|\\*--|-->|->|\\.\\.>|--o|--\\*|--x|--)[ \\t]+${escapeRegex(item.id)})(?:[ \\t]*\\[[^\\]]*\\])?[ \\t]*\\n?`, 'gm');
                nextSource = nextSource.replace(rxRel, '');
              } else if (item.type === 'relation') {
                const idxRaw = item.id.replace('rel_', '');
                const relationIdx = Number.parseInt(idxRaw, 10);
                if (Number.isInteger(relationIdx) && relationIdx >= 0) {
                  const relRegex = /^([ \t]*)([A-Za-z_][\w]*)[ \t]+(--\|>|\.\.\|>|<\|--|<\|\.\.|<\.\.|o--|\*--|-->|->|\.\.>|--o|--\*|--x|--)[ \t]+([A-Za-z_][\w]*)([ \t]*\[[^\]]*\])?[ \t]*$/gm;
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

      // Undo / Redo (skip when CodeMirror has focus — it has its own undo/redo)
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
              if (!activeDiagram.entities.has(item.id) && !activeDiagram.packages.find(p => p.name === item.id)) continue;
              // Reconstruct the entity declaration from the source using exact boundaries
              const extracted = extractEntityDeclaration(activeTab!.source, item.id);
              if (extracted) snippets.push(extracted.trim());

              // Also copy annotations
              const annoRx = new RegExp(`^\\s*@${escapeRegex(item.id)}\\s+at\\s*\\([^)]+\\)`, 'gm');
              const annoMatches = activeTab?.source.match(annoRx);
              if (annoMatches) snippets.push(...annoMatches);
            }
          }
          if (snippets.length > 0) {
            const textToCopy = snippets.join('\n');
            if (e.key === 'c') {
              navigator.clipboard.writeText(textToCopy).then(() => addToast(t('ui.copied') || 'Copied')).catch(() => { });
              pasteCounterRef.current = 1; // Reset cascade on copy
            } else if (e.key === 'd') {
              // Re-use paste logic for duplicate
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
            // Auto-rename pasted entities to avoid collisions
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
            // Offset positions by cascading amount
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
                if (!activeDiagram.entities.has(item.id) && !activeDiagram.packages.find(p => p.name === item.id)) continue;

                const extracted = extractEntityDeclaration(nextSource, item.id);
                if (extracted) snippets.push(extracted.trim());

                // Wipe entity block properly considering nested braces
                nextSource = removeEntityDeclaration(nextSource, item.id);

                // Also copy & wipe annotations
                const annoRx = new RegExp(`^[ \\t]*@${escapeRegex(item.id)}[ \\t]+at[ \\t]*\\([^)]+\\)[ \\t]*\\n?`, 'gm');
                const annoMatches = nextSource.match(annoRx);
                if (annoMatches) snippets.push(...annoMatches.map(s => s.trim()));
                nextSource = nextSource.replace(annoRx, '');

                // Wipe relations connected to this
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
  }, [selectedItems, updateActiveTab, activeDiagram, activeTab]);

  // ── Export callbacks (delegated to exporter module) ───────
  const handleExportSVG = useCallback(() => {
    logEvent('diagram_exported', { format: 'svg', kind: activeDiagram?.kind });
    exportSVG(activeDiagram?.name ?? 'diagram');
  }, [activeDiagram]);

  const handleExportPNG = useCallback(() => {
    logEvent('diagram_exported', { format: 'png', kind: activeDiagram?.kind });
    exportPNG(activeDiagram?.name ?? 'diagram');
  }, [activeDiagram]);

  // ── New file ──────────────────────────────────────────────
  const executeNewDiagram = useCallback((kind: DiagramKind) => {
    const id = `tab-${slugId()}`;
    const src = templateFor(kind);
    logEvent('diagram_created', { kind });
    setTabs(prev => [
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
  }, []);

  const handleNew = useCallback(() => {
    setIsNewModalOpen(true);
  }, []);

  const handleTransformToCollaboration = useCallback(() => {
    if (!activeDiagram || activeDiagram.kind !== 'sequence') return;
    const id = `tab-${slugId()}`;
    const baseName = activeTab?.name?.replace(/\.(isx|iso|txt)$/i, '') || activeDiagram.name || 'diagram';
    const nextName = `${baseName}-collaboration.isx`;
    const transformedSource = sequenceToCollaborationSource(activeDiagram);

    setTabs(prev => [
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
  }, [activeDiagram, activeTab?.name]);

  // ── Open file from disk ───────────────────────────────────
  const handleFileOpen = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const text = reader.result;
        const id = `tab-${slugId()}`;
        setTabs(prev => [
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
  }, []);

  const handleSaveToCloudSubmit = useCallback(async () => {
    if (!selectedProjectId || !user || isSavingToCloud) return;
    setIsSavingToCloud(true);
    try {
      const { createDiagram } = await import('./lib/projects.js');
      const diagram = await createDiagram(user.id, selectedProjectId, activeTab.name, activeDiagram?.kind || 'class', { source: activeTab.source });
      if (diagram) {
        updateActiveTab(tab => ({ ...tab, diagram_id: diagram.id, project_id: selectedProjectId, savedSource: tab.source, project_role: 'owner' }), false);
        setSaveToCloudModalOpen(false);
        addToast('Saved to cloud');
      }
    } catch (e: any) {
      alert(e.message || 'Error saving to cloud');
    } finally {
      setIsSavingToCloud(false);
    }
  }, [user, selectedProjectId, isSavingToCloud, activeTab, activeDiagram, updateActiveTab]);

  const handleSaveToCloud = useCallback(async (projectName?: string) => {
    if (!user) {
      setAuthMode('login');
      setIsAuthOpen(true);
      return;
    }
    if (activeTab.diagram_id) {
      setIsSavingToCloud(true);
      logEvent('diagram_saved', { project_id: activeTab.project_id, diagram_id: activeTab.diagram_id });
      const { updateDiagramContent, saveDiagramHistory } = await import('./lib/projects.js');
      await updateDiagramContent(activeTab.diagram_id, { source: activeTab.source });
      await saveDiagramHistory(activeTab.diagram_id, { source: activeTab.source }, user.id);
      const { logAudit } = await import('./lib/audit.js');
      await logAudit('diagram_saved', 'diagram', activeTab.diagram_id, { project_id: activeTab.project_id });
      setIsSavingToCloud(false);
      updateActiveTab(tab => ({ ...tab, savedSource: tab.source }), false);
    } else {
      if (projectName) {
        setIsSavingToCloud(true);
        const { createProject, createDiagram } = await import('./lib/projects.js');
        const p = await createProject(user.id, projectName);
        if (p) {
          const kind = activeTab.diagramKindFilter === 'all' ? (activeDiagram?.kind || 'class') : activeTab.diagramKindFilter;
          const d = await createDiagram(user.id, p.id, activeTab.name, kind, { source: activeTab.source });
          if (d) {
            updateActiveTab(tab => ({ ...tab, project_id: p.id, diagram_id: d.id, savedSource: tab.source, project_role: 'owner' }), false);
            addToast('Saved to cloud');
          }
        }
        setIsSavingToCloud(false);
      } else {
        setSaveToCloudModalOpen(true);
      }
    }
  }, [user, activeTab, activeDiagram, updateActiveTab]);

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
        if (isDeleteModalOpen) { setIsDeleteModalOpen(false); return; }
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
  }, [handleNew, handleExportSVG, handleExportPNG, handleSaveToCloud, shortcutsOpen, editingEntity, editingRelation, editingText, isNewModalOpen, tabToClose, user, isSavingFlow, isDeleteModalOpen, renameModalOpen, isRevertModalOpen, saveToCloudModalOpen, projectDetailModalOpen, isHistoryOpen, isAuthOpen, isSettingsOpen, isLibraryOpen, exportMenuOpen, activeTab]);


  const handleExportGIF = useCallback(async () => {
    if (!activeDiagram) return;
    setIsExporting(true);
    setExportTime(0);
    const timer = setInterval(() => setExportTime(t => t + 1), 1000);
    try {
      const m = await import('./utils/exporter');
      await m.exportGIF(activeDiagram, activeTab?.name ? activeTab.name.replace('.isx', '') : 'diagram', { isWatermarkEnabled, animationSpeed });
    } finally {
      clearInterval(timer);
      setIsExporting(false);
    }
  }, [activeDiagram, activeTab, isWatermarkEnabled, animationSpeed]);

  const handleExportMP4 = useCallback(async () => {
    if (!activeDiagram) return;
    setIsExporting(true);
    setExportTime(0);
    const timer = setInterval(() => setExportTime(t => t + 1), 1000);
    try {
      const m = await import('./utils/exporter');
      await m.exportVideo(activeDiagram, activeTab?.name ? activeTab.name.replace('.isx', '') : 'diagram', { isWatermarkEnabled, animationSpeed });
    } finally {
      clearInterval(timer);
      setIsExporting(false);
    }
  }, [activeDiagram, activeTab, isWatermarkEnabled, animationSpeed]);

  useEffect(() => {
    const handleModalEnter = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'TEXTAREA') return;

      if (editingEntity) {
        e.preventDefault();
        const isNameOnlyBoundary = editingEntity.kind === 'partition' || editingEntity.kind === 'system' || editingEntity.kind === 'boundary';
        handleEntityEdit(editingEntity.origName || editingEntity.id, {
          name: editingEntity.name,
          stereotype: isNameOnlyBoundary ? undefined : editingEntity.stereotype,
          isAbstract: editingEntity.isAbstract,
          bodyText: editingEntity.bodyText,
          kind: editingEntity.kind,
          elseBlocks: editingEntity.elseBlocks
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
        setTabs(prev => {
          const next = prev.filter(t => t.id !== tabToClose);
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

  const applyExample = useCallback((ex: (typeof EXAMPLES)[number]) => {
    updateActiveTab(tab => ({
      ...tab,
      source: ex.source,
      activeDiagramIdx: 0,
      diagramKindFilter: ex.kind as DiagramKind,
    }));
    setExamplesOpen(false);
  }, [updateActiveTab]);


  const shapesPane = activeDiagram?.kind && getStencilsForKind(activeDiagram.kind).length > 0 ? (
    <div className="iso-sidebar">
      <div className="iso-panel-header" style={{ borderBottom: '1px solid var(--iso-divider)', padding: '0 12px' }}>
        <IconShapes size={11} /> {t('ui.shapes')}
      </div>
      <div className="iso-sidebar-body">
        {getStencilsForKind(activeDiagram.kind).map(stencil => (
          <div
            key={stencil.label}
            draggable
            onDragStart={e => {
              const baseName = stencil.keyword.split(' ')[0];
              const prefixName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
              
              let index = 1;
              let name = `${prefixName}${index}`;
              const src = activeTab?.source || '';
              while (new RegExp(`${ENTITY_KINDS_RX}[ \\t]+${name}\\b`).test(src)) {
                index++;
                name = `${prefixName}${index}`;
              }

              let expandedCode = stencil.keyword;
              const BRACE_KINDS = ['class', 'interface', 'component', 'node', 'state', 'usecase', 'package', 'composite', 'concurrent', 'environment', 'artifact', 'device', 'enum', 'note'];
              const FRAGMENT_KINDS = ['alt', 'loop', 'opt', 'par', 'break', 'critical'];
              
              if (BRACE_KINDS.includes(baseName)) {
                expandedCode = `${stencil.keyword} ${name} {\n\n}`;
              } else if (FRAGMENT_KINDS.includes(baseName)) {
                if (baseName === 'alt') {
                  expandedCode = `${stencil.keyword} ${name} {\n\n} else {\n\n}`;
                } else {
                  expandedCode = `${stencil.keyword} ${name} {\n\n}`;
                }
              } else if (['start', 'stop', 'fork', 'join', 'decision', 'merge'].includes(baseName)) {
                expandedCode = `${stencil.keyword} ${name}`;
              } else if (baseName === 'action') {
                expandedCode = `action ${name}`;
              } else {
                expandedCode = `${stencil.keyword} ${name}`;
              }

              e.dataTransfer.setData('text/plain', expandedCode);
              e.dataTransfer.setData('application/x-isomorph-stencil', stencil.keyword);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            className="iso-stencil"
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: '12px', padding: '10px 12px', width: '100%', boxSizing: 'border-box' }}
          >
            {stencil.icon && <div style={{ color: 'var(--iso-text)', display: 'flex' }}>{stencil.icon}</div>}
            <div style={{ fontSize: '12px', fontWeight: 500 }}>{stencil.label}</div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const historyPane = (
    <div className="iso-sidebar" style={{ width: 'var(--iso-sidebar-width, 200px)', flexShrink: 0 }}>
      <div className="iso-panel-header" style={{ borderBottom: '1px solid var(--iso-divider)', padding: '0 12px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        History
      </div>
      <div className="iso-sidebar-body" style={{ padding: '8px', overflowY: 'auto' }}>
        {diagramHistoryList.length === 0 ? (
          <div style={{ color: 'var(--iso-text-muted)', fontSize: '12px', padding: '16px', textAlign: 'center' }}>No history available.</div>
        ) : (
          diagramHistoryList.map(h => (
            <button
              key={h.id}
              className="iso-btn"
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                marginBottom: '8px',
                background: selectedHistoryId === h.id ? 'var(--iso-bg-active)' : 'transparent',
                border: selectedHistoryId === h.id ? '1px solid var(--iso-brand)' : '1px solid transparent',
              }}
              onClick={() => setSelectedHistoryId(selectedHistoryId === h.id ? null : h.id)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{new Date(h.created_at).toLocaleString()}</span>
                </div>
                {h.user_id && <span style={{ fontSize: '11px', color: 'var(--iso-text-muted)' }}>Saved by {h.user_id === user?.id ? 'you' : 'collaborator'}</span>}
                {selectedHistoryId === h.id && (
                   <button 
                     className="iso-btn" 
                     style={{ marginTop: 8, padding: '4px 8px', fontSize: 11, width: '100%', background: 'transparent', color: 'var(--iso-error)', border: '1px solid var(--iso-error)' }} 
                     onClick={(e) => { e.stopPropagation(); setIsRevertModalOpen(true); }}
                   >
                     Revert snapshot
                   </button>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

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
    updateActiveTab(tab => ({ ...tab, source: selectedHistoryItem.content?.source || '' }));
    setDiagramHistoryList(prev => prev.filter(h => h.created_at <= selectedHistoryItem.created_at));
    setSelectedHistoryId(null);
    setIsHistoryOpen(false);
    setIsRevertModalOpen(false);
    addToast('Reverted to snapshot and deleted newer history');
  };

  const sourcePane = (
    <div className="iso-panel" style={{ height: '100%' }}>
      <div className="iso-panel-header">
        <IconCode size={11} />
        {t('ui.source')}
        {selectedHistoryItem && (
          <span style={{ marginLeft: 8, color: 'var(--iso-brand)', fontSize: 11 }}>(Viewing History - Read Only)</span>
        )}
        <span className="iso-panel-info" aria-live="polite">
        </span>
        <span className="iso-panel-spacer" />
      </div>
      <div className="iso-panel-body">
        <IsomorphEditor
          key={activeTab?.id || 'empty'}
          value={displaySource}
          readOnly={!!selectedHistoryItem || activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter'}
          onChange={value => {
            if (selectedHistoryItem) return;
            updateActiveTab(tab => ({ ...tab, source: value }))
          }}
          errors={editorDiagnostics}
          yText={isCollabActive ? getSourceText() : null}
          isSynced={isCollabActive ? isSynced : false}
          awareness={isCollabActive ? awareness : null}
        />
      </div>
      {allErrors.length > 0 && (
        <div className="iso-error-panel" role="log" aria-label={t('ui.errors')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <strong style={{ fontSize: '0.78rem', color: 'var(--iso-text-muted)', display: 'flex', alignItems: 'center', paddingLeft: '4px' }}>
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
              <span className="iso-error-icon" aria-hidden="true">✖</span>
              <span className="iso-error-msg">{msg}</span>
            </div>
          ))}
          {allErrors.length > 8 && (
            <div className="iso-error-item">
              <span className="iso-error-icon" aria-hidden="true">…</span>
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

  // ── Auto Layout handler (Feature 17) ─────────────────────
  const handleAutoLayout = useCallback((mode: 'left-right' | 'snowflake' | 'compact') => {
    if (!activeDiagram || !activeTab) return;
    const entities = [...activeDiagram.entities.values()];
    if (entities.length === 0) return;

    const layoutEntities = entities.map(e => ({ name: e.name }));
    const layoutRelations = activeDiagram.relations.map(r => ({ from: r.from, to: r.to }));
    const { positions } = computeLayout(mode, layoutEntities, layoutRelations);

    // Apply positions to source by rewriting/adding @Entity at (...) annotations
    updateActiveTab(tab => {
      let src = tab.source;
      // Remove all existing position annotations
      src = src.replace(/^\s*@\w+\s+at\s*\([^)]+\)\s*$/gm, '');
      // Clean up resulting blank lines in annotation area
      src = src.replace(/\n{3,}/g, '\n\n');
      // Build new annotations
      const annotations = [...positions.entries()]
        .map(([name, pos]) => `  @${name} at (${pos.x}, ${pos.y})`)
        .join('\n');
      // Insert before closing brace
      const block = findDiagramBlock(src);
      if (block) {
        const before = src.slice(0, block.closeBrace);
        const after = src.slice(block.closeBrace);
        src = before.trimEnd() + '\n\n' + annotations + '\n' + after;
      }
      return { ...tab, source: src };
    });
  }, [activeDiagram, activeTab, updateActiveTab]);

  // ── Context menu callbacks (Feature 19) ─────────────────
  const handleContextEntityDelete = useCallback((entityName: string) => {
    if (!activeTab) return;
    updateActiveTab(tab => {
      let src = tab.source;
      // Remove entity declaration
      const extracted = extractEntityDeclaration(src, entityName);
      if (extracted) {
        src = src.replace(extracted, '');
      }
      // Remove annotations for this entity
      const annoRx = new RegExp(`^\\s*@${escapeRegex(entityName)}\\s+at\\s*\\([^)]+\\)\\s*$`, 'gm');
      src = src.replace(annoRx, '');
      // Remove relations involving this entity
      const relRx = new RegExp(`^\\s*${escapeRegex(entityName)}\\s+(?:--|\\.\\.)[^\\n]*$|^\\s*\\S+\\s+(?:--|\\.\\.)[^\\n]*${escapeRegex(entityName)}[^\\n]*$`, 'gm');
      src = src.replace(relRx, '');
      src = src.replace(/\n{3,}/g, '\n\n');
      return { ...tab, source: src };
    });
    setSelectedItems(prev => prev.filter(i => i.id !== entityName));
  }, [activeTab, updateActiveTab]);

  const handleContextEntityDuplicate = useCallback((entityName: string) => {
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
    const namesToReplace = [...new Set([...pasteText.matchAll(entityNameRx)].map(m => m[1]))];
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
      while (isNameTaken(newName) && emergencyBreak < 1000) { newName = baseStr + i; i++; emergencyBreak++; }
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
  }, [activeTab, activeDiagram, updateActiveTab]);

  const handleContextEntityCopy = useCallback((entityName: string) => {
    if (!activeTab) return;
    const snippets: string[] = [];
    const extracted = extractEntityDeclaration(activeTab.source, entityName);
    if (extracted) snippets.push(extracted.trim());
    const annoRx = new RegExp(`^\\s*@${escapeRegex(entityName)}\\s+at\\s*\\([^)]+\\)`, 'gm');
    const annoMatches = activeTab.source.match(annoRx);
    if (annoMatches) snippets.push(...annoMatches);
    if (snippets.length > 0) {
      navigator.clipboard.writeText(snippets.join('\n')).then(() => addToast(t('ui.copied') || 'Copied')).catch(() => { });
      pasteCounterRef.current = 1;
    }
  }, [activeTab]);

  const handleContextRelationDelete = useCallback((relationId: string) => {
    if (!activeTab || !activeDiagram) return;
    const rel = activeDiagram.relations.find(r => r.id === relationId);
    if (!rel) return;
    updateActiveTab(tab => {
      let src = tab.source;
      // Find and remove the relation line by matching from -> to with the token
      const patterns = [
        new RegExp(`^\\s*${escapeRegex(rel.from)}\\s+\\S+\\s+${escapeRegex(rel.to)}[^\\n]*$`, 'gm'),
      ];
      for (const rx of patterns) {
        const match = src.match(rx);
        if (match) { src = src.replace(match[0], ''); break; }
      }
      src = src.replace(/\n{3,}/g, '\n\n');
      return { ...tab, source: src };
    });
    setSelectedItems(prev => prev.filter(i => i.id !== relationId));
  }, [activeTab, activeDiagram, updateActiveTab]);

  const handleContextPaste = useCallback(() => {
    navigator.clipboard.readText().then(text => {
      if (!text.trim() || !activeTab) return;
      let pasteText = text;
      const entityNameRx = new RegExp(`${ENTITY_KINDS_RX}\\s+([A-Za-z_]\\w*)`, 'g');
      const namesToReplace = [...new Set([...pasteText.matchAll(entityNameRx)].map(m => m[1]))];
      for (const name of namesToReplace) {
        const baseMatch = name.match(/^([A-Za-z_]+)(\d*)$/);
        const baseStr = baseMatch ? baseMatch[1] : name;
        let newName = baseStr + '1'; let i = 2;
        const isNameTaken = (n: string) => {
          const rx = new RegExp(`\\b${escapeRegex(n)}\\b`);
          return rx.test(activeTab.source) || rx.test(pasteText);
        };
        let emergencyBreak = 0;
        while (isNameTaken(newName) && emergencyBreak < 1000) { newName = baseStr + i; i++; emergencyBreak++; }
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
  }, [activeTab, updateActiveTab]);

  const handleAddNote = useCallback((_x: number, _y: number, attachToEntity?: string) => {
    if (!activeTab) return;
    updateActiveTab(tab => {
      let src = tab.source;
      // Generate a unique note name
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
  }, [activeTab, updateActiveTab]);

  const canvasPane = (
    <div className="iso-panel iso-panel--canvas" style={{ height: '100%' }}>
      <div className="iso-panel-header">
        <IconCanvas size={11} />
        {t('ui.canvas')}
        <span className="iso-panel-spacer" />
        {diagrams.length > 0 && (
          <span style={{ fontSize: 10, color: '#6e7781', fontFamily: 'monospace' }}>
            {t('ui.drag_reposition')}
          </span>
        )}
      </div>
      <div className="iso-panel-body">
        <DiagramView
          diagram={activeDiagram}
          isWatermarkEnabled={isWatermarkEnabled}
          isAnimating={isAnimating}
          animationSpeed={animationSpeed}
          language={language}
          onEntityMove={(activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? undefined : handleEntityMove}
          onEntityResize={(activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? undefined : handleEntityResize}
          onRelationVerticalMove={(activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? undefined : handleRelationVerticalMove}
          onEntityEditRequest={(entity) => {
            if (activeTab?.project_role === 'viewer') return;
            if (activeTab?.project_role === 'commenter' && entity.kind !== 'note') return;
            handleEntityEditRequest(entity);
          }}
          onRelationEditRequest={(activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? undefined : handleRelationEditRequest}
          onRelationAddRequest={(activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? undefined : handleRelationAddRequest}
          onTextRenameRequest={handleTextRenameRequest}
          onExportSVG={handleExportSVG}
          onDropEntity={(activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? undefined : handleDropEntity}
          pendingDropKeyword={isMobileLayout ? pendingMobileDropKeyword : null}
          onConsumePendingDrop={() => setPendingMobileDropKeyword(null)}
          availableTools={selectedHistoryItem ? [] : (activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? ['hand'] : toolsetFor(activeDiagram?.kind)}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          onAutoLayout={(activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? undefined : handleAutoLayout}
          onEntityDelete={(activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? undefined : handleContextEntityDelete}
          onEntityDuplicate={(activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? undefined : handleContextEntityDuplicate}
          onEntityCopy={(activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? undefined : handleContextEntityCopy}
          onRelationDelete={(activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? undefined : handleContextRelationDelete}
          onPaste={(activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? undefined : handleContextPaste}
          onAddNote={activeTab?.project_role === 'viewer' ? undefined : handleAddNote}
          awareness={awareness}
        />
      </div>
    </div>
  );

  const mobileStencilRail = activeDiagram?.kind && 
    activeTab?.project_role !== 'viewer' && 
    activeTab?.project_role !== 'commenter' && 
    getStencilsForKind(activeDiagram.kind).length > 0 ? (
    <div className="iso-mobile-stencil-rail" role="toolbar" aria-label={t('ui.insert_shapes')}>
      {getStencilsForKind(activeDiagram.kind).map(stencil => (
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
          <div className="iso-modal-overlay" onClick={() => setIsSettingsOpen(false)}>
            <div className="iso-modal iso-modal-large" onClick={e => e.stopPropagation()}>
              <div className="iso-modal-sidebar">
                <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>{t('ui.settings')}</h2>
                <button className={`iso-modal-sidebar-tab ${settingsTab === 'profile' ? 'active' : ''}`} onClick={() => setSettingsTab('profile')}>{t('ui.profile')}</button>
                <button className={`iso-modal-sidebar-tab ${settingsTab === 'collab' ? 'active' : ''}`} onClick={() => setSettingsTab('collab')}>{t('ui.collab_settings')}</button>
                <button className={`iso-modal-sidebar-tab ${settingsTab === 'storage' ? 'active' : ''}`} onClick={() => setSettingsTab('storage')}>{t('ui.storage')}</button>
                <button className={`iso-modal-sidebar-tab ${settingsTab === 'app' ? 'active' : ''}`} onClick={() => setSettingsTab('app')}>{t('ui.app_settings')}</button>
              </div>
              <div className="iso-modal-content" style={{ position: 'relative', overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}>
                <button className="iso-modal-close-btn" style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }} onClick={() => setIsSettingsOpen(false)}>×</button>
                <div style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>

                {settingsTab === 'profile' && (
                  <div>
                    <h3 style={{ marginBottom: '24px', fontSize: '20px' }}>{t('ui.profile')}</h3>
                    {session ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                        
                        {/* Section 1: Personal Info */}
                        <div className="iso-settings-section">
                          <div className="iso-settings-section-title">Personal Information</div>
                          <div className="iso-settings-grid" style={{ gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
                            {/* Profile Photo Card */}
                            <div className="iso-settings-card" style={{ display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'center', justifyContent: 'flex-start' }}>
                              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--iso-divider)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--iso-border-strong)', flexShrink: 0 }}>
                                {profile?.avatar_url ? (
                                  <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--iso-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                  <div className="iso-settings-label" style={{ marginBottom: '2px' }}>{t('ui.profile_photo')}</div>
                                  <div className="iso-settings-desc">Upload a custom profile photo. Supports JPG, PNG, and GIF.</div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    className="iso-btn"
                                    style={{ padding: '4px 12px', fontSize: '12px' }}
                                    onClick={() => {
                                      const input = document.createElement('input');
                                      input.type = 'file';
                                      input.accept = 'image/*';
                                      input.onchange = async (e: any) => {
                                        const file = e.target.files?.[0];
                                        if (file && user) {
                                          addToast('Uploading photo...', 'info');
                                          const { uploadAvatar } = await import('./lib/profile.js');
                                          const url = await uploadAvatar(user.id, file);
                                          if (url && profile) {
                                            const updated = { ...profile, avatar_url: url };
                                            setProfile(updated);
                                            await autoSaveProfile({ avatar_url: url });
                                            addToast('Photo uploaded successfully');
                                          }
                                        }
                                      };
                                      input.click();
                                    }}
                                  >
                                    Upload Photo
                                  </button>
                                  {profile?.avatar_url && (
                                    <button
                                      className="iso-btn"
                                      style={{ padding: '4px 12px', fontSize: '12px', color: 'var(--iso-danger)', borderColor: 'var(--iso-danger)' }}
                                      onClick={async () => {
                                        if (profile && user) {
                                          const { updateProfile } = await import('./lib/profile.js');
                                          await updateProfile(user.id, { avatar_url: null });
                                          const updated = { ...profile, avatar_url: null };
                                          setProfile(updated);
                                          await autoSaveProfile({ avatar_url: null });
                                          addToast('Photo removed');
                                        }
                                      }}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="iso-settings-grid">
                            
                            {/* Display Name Card */}
                            <div className="iso-settings-card">
                              <div className="iso-settings-info">
                                <div className="iso-settings-label">Display Name</div>
                                <div className="iso-settings-desc">What name should we display in comments and live previews?</div>
                              </div>
                              <div className="iso-settings-control" style={{ width: '100%', marginTop: '8px' }}>
                                <input
                                  type="text"
                                  placeholder="Alice"
                                  value={profile?.full_name || ''}
                                  onChange={e => setProfile(p => p ? { ...p, full_name: e.target.value } : null)}
                                  onBlur={e => autoSaveProfile({ full_name: e.target.value })}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      autoSaveProfile({ full_name: (e.target as HTMLInputElement).value });
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="iso-input"
                                />
                              </div>
                            </div>

                            {/* Username Card */}
                            <div className="iso-settings-card">
                              <div className="iso-settings-info">
                                <div className="iso-settings-label">{t('ui.username')}</div>
                                <div className="iso-settings-desc">Your unique identifier used for mentions and sharing.</div>
                              </div>
                              <div className="iso-settings-control" style={{ width: '100%', marginTop: '8px' }}>
                                <input
                                  type="text"
                                  placeholder="alice_wonder"
                                  value={profile?.username || ''}
                                  onChange={e => setProfile(p => p ? { ...p, username: e.target.value } : null)}
                                  onBlur={e => autoSaveProfile({ username: e.target.value })}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      autoSaveProfile({ username: (e.target as HTMLInputElement).value });
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="iso-input"
                                />
                              </div>
                            </div>

                            {/* Email Card */}
                            <div className="iso-settings-card iso-settings-card-horizontal" style={{ gridColumn: 'span 2' }}>
                              <div className="iso-settings-info">
                                <div className="iso-settings-label">{t('ui.email')}</div>
                                <div className="iso-settings-desc">The primary email associated with your login account.</div>
                              </div>
                              <div className="iso-settings-control" style={{ width: '280px', flexShrink: 0 }}>
                                <input
                                  type="email"
                                  value={user?.email || ''}
                                  disabled
                                  className="iso-input"
                                  style={{ opacity: 0.6, cursor: 'not-allowed', width: '100%' }}
                                />
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* Section 2: Account Status & Actions */}
                        <div className="iso-settings-section">
                          <div className="iso-settings-section-title">Account Actions</div>
                          <div className="iso-settings-grid" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
                            {/* Reset Password Card */}
                            <div className="iso-settings-card iso-settings-card-horizontal">
                              <div className="iso-settings-info">
                                <div className="iso-settings-label">Update Password</div>
                                <div className="iso-settings-desc">Choose a new, secure password for your account.</div>
                              </div>
                              <div className="iso-settings-control" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="password"
                                  placeholder="New Password"
                                  value={newPassword}
                                  onChange={e => setNewPassword(e.target.value)}
                                  className="iso-input"
                                  style={{ width: '180px' }}
                                />
                                <button className="iso-btn" onClick={() => handleResetPassword(newPassword)}>
                                  Update
                                </button>
                              </div>
                            </div>

                            {/* Sign Out Card */}
                            <div className="iso-settings-card iso-settings-card-horizontal">
                              <div className="iso-settings-info">
                                <div className="iso-settings-label">Sign Out</div>
                                <div className="iso-settings-desc">Log out of your session on this browser.</div>
                              </div>
                              <div className="iso-settings-control">
                                <button className="iso-btn" onClick={handleSignOut}>
                                  Sign Out
                                </button>
                              </div>
                            </div>

                            {/* Delete Account Card */}
                            <div className="iso-settings-card iso-settings-card-horizontal" style={{ borderColor: 'rgba(255, 95, 87, 0.2)', background: 'rgba(255, 95, 87, 0.02)' }}>
                              <div className="iso-settings-info">
                                <div className="iso-settings-label" style={{ color: 'var(--iso-danger)' }}>Delete Account</div>
                                <div className="iso-settings-desc">Permanently erase your account, all projects, and custom diagrams.</div>
                              </div>
                              <div className="iso-settings-control">
                                <button 
                                  className="iso-btn" 
                                  style={{ color: 'var(--iso-danger)', borderColor: 'var(--iso-danger)' }} 
                                  onClick={() => {
                                    setDeleteStep(0);
                                    setIsDeleteModalOpen(true);
                                  }}
                                >
                                  Delete Account
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
                        <p style={{ color: 'var(--iso-text-muted)' }}>You are not logged in.</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="iso-btn iso-btn--primary" onClick={() => { setAuthMode('login'); setIsAuthOpen(true); setIsSettingsOpen(false); }}>{t('ui.login')}</button>
                          <button className="iso-btn" onClick={() => { setAuthMode('register'); setIsAuthOpen(true); setIsSettingsOpen(false); }}>{t('auth.title_register')}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {settingsTab === 'collab' && (
                  <div>
                    <h3 style={{ marginBottom: '24px', fontSize: '20px' }}>{t('ui.collab_settings')}</h3>
                    {!session ? (
                      <p style={{ color: 'var(--iso-text-muted)' }}>{t('ui.collab_login_needed')}</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                        
                        {/* Section 1: Live Cursor Options */}
                        <div className="iso-settings-section">
                          <div className="iso-settings-section-title">Live Cursor Options</div>
                          <div className="iso-settings-grid">
                            
                            {/* Cursor Color Card */}
                            <div className="iso-settings-card">
                              <div className="iso-settings-info">
                                <div className="iso-settings-label">Cursor Color</div>
                                <div className="iso-settings-desc">Choose a custom color that represents your cursor on shared canvas boards.</div>
                              </div>
                              <div className="iso-settings-control" style={{ flexDirection: 'column', gap: '16px', width: '100%', marginTop: '8px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                  {['#EF4444', '#22C55E', '#3B82F6', '#EAB308', '#EC4899', '#F97316', '#F8FAFC', '#1E293B'].map(color => (
                                    <button
                                      key={color}
                                      onClick={() => {
                                        setProfile(p => p ? { ...p, settings: { ...(p.settings || {}), cursor_colour: color } } : null);
                                        autoSaveSettings({ cursor_colour: color });
                                      }}
                                      style={{
                                        width: '32px', height: '32px', borderRadius: '50%', background: color,
                                        border: profile?.settings?.cursor_colour === color ? '2px solid var(--iso-bg-app)' : '2px solid transparent',
                                        boxShadow: profile?.settings?.cursor_colour === color ? `0 0 0 2px ${color}` : (color === '#F8FAFC' ? '0 0 0 1px #E2E8F0' : '0 0 0 1px var(--iso-border)'),
                                        outline: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                      }}
                                      aria-label={`Select color ${color}`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Cursor Preview Card */}
                            <div className="iso-settings-card">
                              <div className="iso-settings-info">
                                <div className="iso-settings-label">Live Preview</div>
                                <div className="iso-settings-desc">How other developers will see your active cursor live.</div>
                              </div>
                              <div className="iso-settings-control" style={{ width: '100%', height: '80px', background: 'var(--iso-bg-canvas)', borderRadius: '8px', border: '1px solid var(--iso-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
                                    <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.84c.45 0 .67-.54.35-.85L5.5 3.21z" fill={profile?.settings?.cursor_colour || '#3B82F6'} stroke={profile?.settings?.cursor_colour === '#F8FAFC' ? '#CBD5E1' : 'white'} strokeWidth="1.5" />
                                  </svg>
                                  {collabShowNameLabel && (
                                    <div style={{
                                      background: profile?.settings?.cursor_colour || '#3B82F6',
                                      color: profile?.settings?.cursor_colour === '#F8FAFC' ? '#1E293B' : 'white',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      marginTop: '4px',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }}>
                                      {profile?.full_name || profile?.username || 'You'}
                                    </div>
                                  )}
                                </div>
                                {collabShowTrail && (
                                  <>
                                    <div className="iso-particle-trail" style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: profile?.settings?.cursor_colour || '#3B82F6', opacity: 0.5, transform: 'translate(-12px, 12px)', zIndex: 1 }} />
                                    <div className="iso-particle-trail" style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: profile?.settings?.cursor_colour || '#3B82F6', opacity: 0.3, transform: 'translate(-20px, 20px)', zIndex: 1 }} />
                                    <div className="iso-particle-trail" style={{ position: 'absolute', width: 4, height: 4, borderRadius: '50%', background: profile?.settings?.cursor_colour || '#3B82F6', opacity: 0.15, transform: 'translate(-26px, 26px)', zIndex: 1 }} />
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Show Name Label Card */}
                            <div className="iso-settings-card iso-settings-card-horizontal">
                              <div className="iso-settings-info">
                                <div className="iso-settings-label">Display Name Label</div>
                                <div className="iso-settings-desc">Show your name badge alongside your live cursor indicator to others.</div>
                              </div>
                              <div className="iso-settings-control">
                                <label className="iso-switch">
                                  <input 
                                    type="checkbox" 
                                    checked={collabShowNameLabel} 
                                    onChange={e => {
                                      const next = e.target.checked;
                                      setCollabShowNameLabel(next);
                                      autoSaveSettings({ show_name_label: next });
                                    }} 
                                  />
                                  <span className="iso-switch-slider"></span>
                                </label>
                              </div>
                            </div>

                            {/* Cursor Trail Card */}
                            <div className="iso-settings-card iso-settings-card-horizontal">
                              <div className="iso-settings-info">
                                <div className="iso-settings-label">Cursor Particle Trails</div>
                                <div className="iso-settings-desc">Draw a subtle particle trail behind your cursor when in active motion.</div>
                              </div>
                              <div className="iso-settings-control">
                                <label className="iso-switch">
                                  <input 
                                    type="checkbox" 
                                    checked={collabShowTrail} 
                                    onChange={e => {
                                      const next = e.target.checked;
                                      setCollabShowTrail(next);
                                      autoSaveSettings({ show_trail: next });
                                    }} 
                                  />
                                  <span className="iso-switch-slider"></span>
                                </label>
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* Section 2: Future Collaboration Features */}
                        <div className="iso-settings-section">
                          <div className="iso-settings-section-title">Collaboration Status</div>
                          <div className="iso-settings-grid">
                            <div className="iso-settings-card">
                              <div className="iso-settings-info">
                                <div className="iso-settings-label">Multiplayer Canvas</div>
                                <div className="iso-settings-desc">{t('ui.collab_future')}</div>
                              </div>
                              <div className="iso-settings-control" style={{ marginTop: '8px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--iso-brand)', background: 'var(--iso-bg-active)', padding: '4px 8px', borderRadius: '12px', fontWeight: 600 }}>Coming Soon</span>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                )}
                {settingsTab === 'storage' && (
                  <div>
                    <h3 style={{ marginBottom: '24px', fontSize: '20px' }}>{t('ui.storage')}</h3>
                    {!session ? (
                      <p style={{ color: 'var(--iso-text-muted)' }}>{t('ui.storage_login_needed')}</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                        
                        {/* Section 1: Resource Usage */}
                        <div className="iso-settings-section">
                          <div className="iso-settings-section-title">Resource Usage</div>
                          <div className="iso-settings-grid">
                            
                            {/* Subscription Tier Card */}
                            <div className="iso-settings-card">
                              <div className="iso-settings-info">
                                <div className="iso-settings-label">Subscription Tier</div>
                                <div className="iso-settings-desc">Your active user plan. Multi-device cloud backup limits apply.</div>
                              </div>
                              <div className="iso-settings-control" style={{ marginTop: '8px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--iso-brand)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  {profile?.tier || 'Basic'}
                                </span>
                              </div>
                            </div>

                            {/* Projects Limit Card */}
                            <div className="iso-settings-card">
                              <div className="iso-settings-info">
                                <div className="iso-settings-label">Cloud Projects Usage</div>
                                <div className="iso-settings-desc">Percentage of your workspace allowance stored in the cloud.</div>
                              </div>
                              <div className="iso-settings-control" style={{ flexDirection: 'column', width: '100%', gap: '8px', marginTop: '12px' }}>
                                {(() => {
                                  const maxLimit = profile?.tier === 'enterprise' ? 100 : profile?.tier === 'power' ? 25 : 5;
                                  const count = projects.length;
                                  const ratio = count / maxLimit;
                                  let color = 'var(--iso-brand)';
                                  if (ratio >= 0.9) color = 'var(--iso-error)';
                                  else if (ratio >= 0.75) color = 'var(--iso-warning)';
                                  return (
                                    <>
                                      <div style={{ display: 'flex', gap: '4px', width: '100%', height: '8px' }}>
                                        {Array.from({ length: maxLimit }).map((_, i) => (
                                          <div key={i} style={{ flex: 1, background: i < count ? color : 'var(--iso-divider)', borderRadius: '4px', transition: 'background 0.3s ease' }} />
                                        ))}
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '12px', color: 'var(--iso-text-muted)' }}>
                                        <span>{count} created</span>
                                        <span>{maxLimit} max projects</span>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* Section 2: Storage Tiers & Billing */}
                        <div className="iso-settings-section">
                          <div className="iso-settings-section-title">Upgrade Plan</div>
                          <div className="iso-settings-grid">
                            
                            {/* Plans Card */}
                            <div className="iso-settings-card" style={{ gridColumn: 'span 2' }}>
                              <div className="iso-settings-info" style={{ marginBottom: '12px' }}>
                                <div className="iso-settings-label">Available Subscriptions</div>
                                <div className="iso-settings-desc">{t('ui.storage_future')} Upgrade to scale your projects.</div>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', width: '100%' }}>
                                <div style={{ background: 'var(--iso-bg-app)', border: '1px solid var(--iso-border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <strong style={{ fontSize: '14px', color: 'var(--iso-text)' }}>Basic (Free)</strong>
                                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--iso-text)' }}>$0 <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--iso-text-muted)' }}>/ month</span></span>
                                  <span style={{ fontSize: '12px', color: 'var(--iso-text-muted)' }}>Ideal for starting out. Up to 5 projects stored securely in the cloud.</span>
                                </div>
                                <div style={{ background: 'var(--iso-bg-active)', border: '1px solid var(--iso-brand)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', transform: 'scale(1.02)' }}>
                                  <strong style={{ fontSize: '14px', color: 'var(--iso-text)' }}>Power Plan</strong>
                                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--iso-brand)' }}>$5 <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--iso-text-muted)' }}>/ month</span></span>
                                  <span style={{ fontSize: '12px', color: 'var(--iso-text-muted)' }}>For power users. Up to 25 projects and advanced sharing options.</span>
                                </div>
                                <div style={{ background: 'var(--iso-bg-app)', border: '1px solid var(--iso-border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <strong style={{ fontSize: '14px', color: 'var(--iso-text)' }}>Enterprise</strong>
                                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--iso-text)' }}>Custom <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--iso-text-muted)' }}>pricing</span></span>
                                  <span style={{ fontSize: '12px', color: 'var(--iso-text-muted)' }}>For large teams. Up to 100+ projects and enterprise SSO authentication.</span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '16px' }}>
                                <button className="iso-btn iso-btn--primary" onClick={() => window.open('https://isomorph.ro/pricing', '_blank')}>
                                  View Detailed Plans
                                </button>
                              </div>
                            </div>

                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                )}
                {settingsTab === 'app' && (
                  <div>
                    <h3 style={{ marginBottom: '24px', fontSize: '20px' }}>{t('ui.app_settings')}</h3>
                    
                    {/* Section 1: Appearance & Interface */}
                    <div className="iso-settings-section">
                      <div className="iso-settings-section-title">Appearance & Interface</div>
                      <div className="iso-settings-grid">
                        
                        {/* Theme Card */}
                        <div className="iso-settings-card">
                          <div className="iso-settings-info">
                            <div className="iso-settings-label">{t('ui.theme')}</div>
                            <div className="iso-settings-desc">Choose between a light theme or dark theme for the editor and panels.</div>
                          </div>
                          <div className="iso-settings-control">
                            <div className="iso-theme-options">
                              <button
                                type="button"
                                className={`iso-theme-option-card ${themeMode === 'light' ? 'active' : ''}`}
                                onClick={() => {
                                  setThemeMode('light');
                                  document.documentElement.setAttribute('data-theme', 'light');
                                  localStorage.setItem('isomorph-theme', 'light');
                                  autoSaveSettings({ theme: 'light' });
                                }}
                              >
                                <IconSun size={16} />
                                <span>{t('ui.light_mode')}</span>
                              </button>
                              <button
                                type="button"
                                className={`iso-theme-option-card ${themeMode === 'dark' ? 'active' : ''}`}
                                onClick={() => {
                                  setThemeMode('dark');
                                  document.documentElement.setAttribute('data-theme', 'dark');
                                  localStorage.setItem('isomorph-theme', 'dark');
                                  autoSaveSettings({ theme: 'dark' });
                                }}
                              >
                                <IconMoon size={16} />
                                <span>{t('ui.dark_mode')}</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Language Card */}
                        <div className="iso-settings-card">
                          <div className="iso-settings-info">
                            <div className="iso-settings-label">{t('ui.language')}</div>
                            <div className="iso-settings-desc">Set the translation for menus, stencils, and error messages.</div>
                          </div>
                          <div className="iso-settings-control">
                            <select
                              className="iso-select"
                              value={language}
                              onChange={e => {
                                const next = e.target.value as Language;
                                setLanguage(next);
                                setStoredLanguage(next);
                                autoSaveSettings({ language: next });
                              }}
                              style={{ width: '100%' }}
                            >
                              {LANGUAGE_OPTIONS.map(option => (
                                <option key={option.code} value={option.code}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Section 2: Editor & Workspace */}
                    <div className="iso-settings-section">
                      <div className="iso-settings-section-title">Editor & Workspace</div>
                      <div className="iso-settings-grid">

                        {/* Strict UML Card */}
                        <div className="iso-settings-card iso-settings-card-horizontal">
                          <div className="iso-settings-info">
                            <div className="iso-settings-label">{t('ui.strict_uml')}</div>
                            <div className="iso-settings-desc">{t('ui.strict_uml_desc')}</div>
                          </div>
                          <div className="iso-settings-control">
                            <label className="iso-switch">
                              <input
                                type="checkbox"
                                checked={isUMLCompliant}
                                onChange={e => {
                                  const next = e.target.checked;
                                  setIsUMLCompliant(next);
                                  localStorage.setItem('isomorph-strict-uml', String(next));
                                  autoSaveSettings({ strict_uml: next });
                                }}
                              />
                              <span className="iso-switch-slider"></span>
                            </label>
                          </div>
                        </div>

                        {/* Auto Save Card */}
                        {session && (
                          <div className="iso-settings-card">
                            <div className="iso-settings-info">
                              <div className="iso-settings-label">Auto Save</div>
                              <div className="iso-settings-desc">Configure the interval for automatically saving changes to the cloud.</div>
                            </div>
                            <div className="iso-settings-control" style={{ width: '100%' }}>
                              <div className="iso-settings-slider-wrap">
                                <div className="iso-settings-slider-header">
                                  <span style={{ fontSize: '12px', color: 'var(--iso-text-muted)' }}>Interval</span>
                                  <span className="iso-settings-slider-value">
                                    {autoSaveInterval === 0 ? 'Never' : (autoSaveInterval === 0.5 ? '30 seconds' : `${autoSaveInterval} min`)}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min="0" max="5" step="0.5"
                                  value={autoSaveInterval}
                                  className="iso-settings-slider"
                                  onChange={e => {
                                    const val = parseFloat(e.target.value);
                                    setAutoSaveInterval(val);
                                    localStorage.setItem('isomorph-autosave', String(val));
                                    autoSaveSettings({ auto_save: val });
                                  }}
                                />
                                <div className="iso-settings-slider-labels">
                                  <span>Never</span>
                                  <span>5 min</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>

                    {/* Section 3: Visuals & Export */}
                    <div className="iso-settings-section">
                      <div className="iso-settings-section-title">Visuals & Exports</div>
                      <div className="iso-settings-grid">

                        {/* Output Watermark Card */}
                        <div className="iso-settings-card iso-settings-card-horizontal">
                          <div className="iso-settings-info">
                            <div className="iso-settings-label">Output Watermark</div>
                            <div className="iso-settings-desc">{t('ui.watermark')}</div>
                          </div>
                          <div className="iso-settings-control">
                            <label className="iso-switch">
                              <input
                                type="checkbox"
                                checked={isWatermarkEnabled}
                                onChange={e => {
                                  const next = e.target.checked;
                                  setIsWatermarkEnabled(next);
                                  localStorage.setItem('isomorph-watermark', String(next));
                                  autoSaveSettings({ watermark: next });
                                }}
                              />
                              <span className="iso-switch-slider"></span>
                            </label>
                          </div>
                        </div>

                        {/* Enable Animations Card */}
                        <div className="iso-settings-card iso-settings-card-horizontal">
                          <div className="iso-settings-info">
                            <div className="iso-settings-label">{t('ui.enable_animations')}</div>
                            <div className="iso-settings-desc">Animate transitions and steps in sequence diagrams.</div>
                          </div>
                          <div className="iso-settings-control">
                            <label className="iso-switch">
                              <input
                                type="checkbox"
                                checked={isAnimationsEnabled}
                                onChange={e => {
                                  const next = e.target.checked;
                                  setIsAnimationsEnabled(next);
                                  if (!next) setIsAnimating(false);
                                  localStorage.setItem('isomorph-animations', String(next));
                                  autoSaveSettings({ animations: next });
                                }}
                              />
                              <span className="iso-switch-slider"></span>
                            </label>
                          </div>
                        </div>

                        {/* Animation Speed Card */}
                        <div className="iso-settings-card">
                          <div className="iso-settings-info">
                            <div className="iso-settings-label">{t('ui.export_speed')}</div>
                            <div className="iso-settings-desc">Choose the playback rate for diagram animations.</div>
                          </div>
                          <div className="iso-settings-control">
                            <select
                              className="iso-select"
                              value={animationSpeed}
                              disabled={!isAnimationsEnabled}
                              onChange={e => {
                                const speed = parseFloat(e.target.value);
                                setAnimationSpeed(speed);
                                localStorage.setItem('isomorph-anim-speed', String(speed));
                                autoSaveSettings({ anim_speed: speed });
                              }}
                              style={{ width: '100%' }}
                            >
                              <option value={0.5}>0.5x</option>
                              <option value={1.0}>1.0x</option>
                              <option value={1.5}>1.5x</option>
                              <option value={2.0}>2.0x</option>
                            </select>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Section 4: Privacy & Telemetry */}
                    <div className="iso-settings-section">
                      <div className="iso-settings-section-title">Privacy & Data</div>
                      <div className="iso-settings-grid">

                        {/* Telemetry Card */}
                        <div className="iso-settings-card iso-settings-card-horizontal">
                          <div className="iso-settings-info">
                            <div className="iso-settings-label">Anonymous Telemetry</div>
                            <div className="iso-settings-desc">Send anonymous telemetry data to help improve Isomorph.</div>
                          </div>
                          <div className="iso-settings-control">
                            <label className="iso-switch">
                              <input
                                type="checkbox"
                                checked={telemetry}
                                onChange={e => {
                                  const next = e.target.checked;
                                  setTelemetry(next);
                                  setTelemetryEnabled(next);
                                  autoSaveSettings({ telemetry: next });
                                }}
                              />
                              <span className="iso-switch-slider"></span>
                            </label>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isLibraryOpen && (
          <div className="iso-modal-overlay" onClick={() => setIsLibraryOpen(false)}>
            <div className="iso-modal iso-modal-large" onClick={e => e.stopPropagation()}>
              <div className="iso-modal-sidebar">
                <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>{t('ui.library')}</h2>
                <button className={`iso-modal-sidebar-tab ${libraryTab === 'my' ? 'active' : ''}`} onClick={() => setLibraryTab('my')}>{t('ui.my_works')}</button>
                <button className={`iso-modal-sidebar-tab ${libraryTab === 'shared' ? 'active' : ''}`} onClick={() => setLibraryTab('shared')}>{t('ui.shared_works')}</button>
                <button className={`iso-modal-sidebar-tab ${libraryTab === 'open_folder' ? 'active' : ''}`} onClick={() => setLibraryTab('open_folder')}>{t('ui.open_folder')}</button>
                <button className={`iso-modal-sidebar-tab ${libraryTab === 'examples' ? 'active' : ''}`} onClick={() => setLibraryTab('examples')}>{t('ui.examples')}</button>
              </div>
              <div className="iso-modal-content" style={{ position: 'relative', overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}>
                <button className="iso-modal-close-btn" style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }} onClick={() => setIsLibraryOpen(false)}>×</button>
                <div style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>

                {libraryTab === 'my' && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                      <h3 style={{ margin: 0, fontSize: '20px' }}>{t('ui.my_works')}</h3>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: '10px', color: 'var(--iso-text-muted)', pointerEvents: 'none' }}>
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                          </svg>
                          <input
                            type="text"
                            placeholder={t('ui.search') || 'Search projects...'}
                            value={librarySearchQuery}
                            onChange={(e) => setLibrarySearchQuery(e.target.value)}
                            style={{ width: '200px', padding: '6px 12px 6px 32px', borderRadius: '20px', background: 'var(--iso-bg-app)', border: '1px solid transparent', outline: 'none', color: 'inherit', fontSize: '13px' }}
                          />
                        </div>
                        <select className="iso-select" value={libraryVisibilityFilter} onChange={e => setLibraryVisibilityFilter(e.target.value)} style={{ width: '120px', borderRadius: '20px', background: 'var(--iso-bg-app)' }} aria-label="Filter visibility">
                          <option value="all">All</option>
                          <option value="public">Public</option>
                          <option value="private">Private</option>
                        </select>
                        <select className="iso-select" value={librarySort} onChange={e => setLibrarySort(e.target.value)} style={{ width: '150px', borderRadius: '20px', background: 'var(--iso-bg-app)' }} aria-label="Sort projects">
                          <option value="accessed">Last Accessed</option>
                          <option value="name">Name</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
                      {['All Projects', ...customCategories].map(cat => (
                        <button
                          key={cat}
                          className={libraryCategory === cat ? "iso-btn iso-btn--primary" : "iso-btn"}
                          style={{ borderRadius: '20px', padding: '4px 12px', background: libraryCategory === cat ? undefined : 'var(--iso-bg-header)' }}
                          onClick={() => setLibraryCategory(cat)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            const isProtected = cat.toLowerCase() === 'all projects' || cat.toLowerCase() === 'favorites' || cat.toLowerCase() === 'favourites';
                            if (!isProtected) {
                              setContextMenu({ type: 'category', id: cat, x: e.clientX, y: e.clientY });
                            }
                          }}
                        >{cat}</button>
                      ))}
                      <button className="iso-btn" style={{ borderRadius: '20px', padding: '4px 12px', background: 'var(--iso-bg-header)' }} onClick={() => {
                        setNewCategoryName('');
                        setNewCategoryPrompt(true);
                      }}>+</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', overflowY: 'auto' }}>
                      {!user ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--iso-text-muted)' }}>
                          {t('ui.projects_login_needed')}
                        </div>
                      ) : (() => {
                        let filtered = projects.filter(p => p.name.toLowerCase().includes(librarySearchQuery.toLowerCase()));

                        if (libraryVisibilityFilter === 'public') {
                          filtered = filtered.filter(p => publicProjectIds.has(p.id));
                        } else if (libraryVisibilityFilter === 'private') {
                          filtered = filtered.filter(p => !publicProjectIds.has(p.id));
                        }

                        const isFavTab = libraryCategory.toLowerCase() === 'favorites' || libraryCategory.toLowerCase() === 'favourites';
                        if (isFavTab) {
                          filtered = filtered.filter(p => p.settings?.is_favorite);
                        } else if (libraryCategory !== 'All Projects') {
                          filtered = filtered.filter(p => p.settings?.category === libraryCategory);
                        }

                        filtered = filtered.sort((a, b) => {
                          if (librarySort === 'name') return a.name.localeCompare(b.name);
                          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                        });

                        if (filtered.length === 0) {
                          return (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--iso-text-muted)' }}>
                              No projects found matching these filters.
                            </div>
                          );
                        }

                        return filtered.map(p => (
                          <div key={p.id} onClick={() => handleOpenProjectDetails(p)} onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({ type: 'project', id: p.id, x: e.clientX, y: e.clientY });
                          }} style={{ height: '140px', background: 'var(--iso-bg-header)', borderRadius: '8px', border: '1px solid var(--iso-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--iso-text)', cursor: 'pointer', padding: '16px', textAlign: 'center' }}>
                            <strong style={{ marginBottom: '8px' }}>{p.name}</strong>
                            <span style={{ fontSize: '12px', color: 'var(--iso-text-muted)' }}>{new Date(p.updated_at).toLocaleDateString()}</span>
                          </div>
                        ))
                      })()
                      }
                    </div>
                  </div>
                )}
                {libraryTab === 'shared' && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {!session ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--iso-text-muted)', minHeight: '200px' }}>
                        {t('ui.shared_login_needed')}
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                          <h3 style={{ margin: 0, fontSize: '20px' }}>{t('ui.shared_works')}</h3>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: '10px', color: 'var(--iso-text-muted)', pointerEvents: 'none' }}>
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                              </svg>
                              <input
                                type="text"
                                placeholder={t('ui.search') || 'Search projects...'}
                                value={librarySearchQuery}
                                onChange={(e) => setLibrarySearchQuery(e.target.value)}
                                style={{ width: '200px', padding: '6px 12px 6px 32px', borderRadius: '20px', background: 'var(--iso-bg-app)', border: '1px solid transparent', outline: 'none', color: 'inherit', fontSize: '13px' }}
                              />
                            </div>
                            <select className="iso-select" value={librarySort} onChange={e => setLibrarySort(e.target.value)} style={{ width: '150px', borderRadius: '20px', background: 'var(--iso-bg-app)' }} aria-label="Sort projects">
                              <option value="accessed">Last Accessed</option>
                              <option value="name">Name</option>
                            </select>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', overflowY: 'auto' }}>
                          {(() => {
                            let filtered = sharedProjects.filter(p => p.name.toLowerCase().includes(librarySearchQuery.toLowerCase()));
                            
                            filtered = filtered.sort((a, b) => {
                              if (librarySort === 'name') return a.name.localeCompare(b.name);
                              return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                            });

                            if (filtered.length === 0) {
                              return (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--iso-text-muted)' }}>
                                  {t('ui.shared_future')}
                                </div>
                              );
                            }

                            return filtered.map(p => (
                              <div
                                key={p.id}
                                onClick={() => handleOpenProjectDetails(p)}
                                style={{
                                  height: '140px',
                                  background: 'var(--iso-bg-header)',
                                  borderRadius: '8px',
                                  border: '1px solid var(--iso-border)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--iso-text)',
                                  cursor: 'pointer',
                                  padding: '16px',
                                  textAlign: 'center',
                                  position: 'relative'
                                }}
                                onMouseOver={e => {
                                  e.currentTarget.style.borderColor = 'var(--iso-accent)';
                                  e.currentTarget.style.background = 'var(--iso-bg-hover)';
                                }}
                                onMouseOut={e => {
                                  e.currentTarget.style.borderColor = 'var(--iso-border)';
                                  e.currentTarget.style.background = 'var(--iso-bg-header)';
                                }}
                              >
                                <span style={{
                                  position: 'absolute',
                                  top: '8px',
                                  right: '8px',
                                  fontSize: '10px',
                                  background: 'var(--iso-bg-app)',
                                  border: '1px solid var(--iso-border)',
                                  padding: '2px 6px',
                                  borderRadius: '12px',
                                  textTransform: 'capitalize',
                                  color: 'var(--iso-text-muted)',
                                  fontWeight: 500
                                }}>
                                  {t(`share.${(p as any).role}`) || (p as any).role}
                                </span>
                                <strong style={{ marginBottom: '8px', marginTop: '12px' }}>{p.name}</strong>
                                <span style={{ fontSize: '12px', color: 'var(--iso-text-muted)' }}>{new Date(p.updated_at).toLocaleDateString()}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {libraryTab === 'open_folder' && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
                    <input
                      ref={localFileInputRef}
                      type="file"
                      accept=".isx"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files ? Array.from(e.target.files) : [];
                        if (files.length > 0) {
                          handleLoadedFiles(files);
                        }
                        if (localFileInputRef.current) localFileInputRef.current.value = '';
                      }}
                      style={{ display: 'none' }}
                    />

                    {localStagedFiles.length === 0 ? (
                      <div
                        onClick={() => localFileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '48px 32px',
                          borderRadius: '16px',
                          border: isDraggingOver ? '2px dashed var(--iso-accent)' : '2px dashed var(--iso-border)',
                          background: isDraggingOver ? 'var(--iso-bg-canvas)' : 'var(--iso-bg-header)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease-in-out',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Drag and drop files here</h3>
                        <p style={{ margin: '8px 0 16px', fontSize: '13px', color: 'var(--iso-text-muted)', maxWidth: '280px', lineHeight: '1.5' }}>
                          Drop your <strong>.isx</strong> files here, or click to browse.
                        </p>
                        <button
                          className="iso-btn iso-btn--primary"
                          style={{ padding: '8px 24px', borderRadius: '20px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            localFileInputRef.current?.click();
                          }}
                        >
                          Browse Files
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Selected Files ({localStagedFiles.length})</h3>
                          <button className="iso-btn" style={{ fontSize: '12px', padding: '4px 12px' }} onClick={() => localFileInputRef.current?.click()}>
                            + Add More
                          </button>
                        </div>

                        <div
                          style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                        >
                          {localStagedFiles.map(f => (
                            <div
                              key={f.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',

                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                background: 'var(--iso-bg-header)',
                                border: '1px solid var(--iso-border)'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                <span style={{ fontSize: '18px' }}>📄</span>
                                <span style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--iso-text)' }} title={f.name}>
                                  {f.name}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  className="iso-btn"
                                  style={{ fontSize: '12px', padding: '4px 10px', background: 'var(--iso-bg-hover)' }}
                                  onClick={() => {
                                    const id = `tab-${slugId()}`;
                                    setTabs(prev => [
                                      ...prev,
                                      {
                                        id,
                                        name: f.name,
                                        source: f.source,
                                        savedSource: f.source,
                                        activeDiagramIdx: 0,
                                        diagramKindFilter: 'all'
                                      }
                                    ]);
                                    setActiveTabId(id);
                                    setLocalStagedFiles(prev => prev.filter(item => item.id !== f.id));
                                    if (localStagedFiles.length === 1) {
                                      setIsLibraryOpen(false);
                                    }
                                  }}
                                >
                                  Open
                                </button>
                                <button
                                  className="iso-btn"
                                  style={{ fontSize: '12px', padding: '4px 10px', color: 'var(--iso-error)', background: 'var(--iso-bg-hover)' }}
                                  onClick={() => setLocalStagedFiles(prev => prev.filter(item => item.id !== f.id))}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--iso-border)', paddingTop: '16px' }}>
                          <button
                            className="iso-btn"
                            style={{ flex: 1, justifyContent: 'center' }}
                            onClick={() => setLocalStagedFiles([])}
                          >
                            Clear All
                          </button>
                          <button
                            className="iso-btn iso-btn--primary"
                            style={{ flex: 2, justifyContent: 'center' }}
                            onClick={() => {
                              const newTabs: WorkspaceTab[] = localStagedFiles.map(f => {
                                const tabId = `tab-${slugId()}`;
                                return {
                                  id: tabId,
                                  name: f.name,
                                  source: f.source,
                                  savedSource: f.source,
                                  activeDiagramIdx: 0,
                                  diagramKindFilter: 'all'
                                };
                              });
                              setTabs(prev => [...prev, ...newTabs]);
                              if (newTabs.length > 0) {
                                setActiveTabId(newTabs[0].id);
                              }
                              setLocalStagedFiles([]);
                              setIsLibraryOpen(false);
                            }}
                          >
                            Open All Files
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {libraryTab === 'examples' && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                      <h3 style={{ margin: 0, fontSize: '20px' }}>{t('ui.examples')}</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', overflowY: 'auto' }}>
                      {EXAMPLES.map(ex => (
                        <div key={ex.label} onClick={() => {
                          applyExample(ex);
                          setIsLibraryOpen(false);
                        }} style={{ height: '140px', background: 'var(--iso-bg-header)', borderRadius: '8px', border: '1px solid var(--iso-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--iso-text)', cursor: 'pointer', padding: '16px', textAlign: 'center' }}>
                          <strong style={{ marginBottom: '8px' }}>{ex.label}</strong>
                          <span style={{ fontSize: '12px', color: 'var(--iso-text-muted)' }}>{ex.kind}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isDeleteModalOpen && (
          <div className="iso-modal-overlay" style={{ zIndex: 3000 }} onClick={() => setIsDeleteModalOpen(false)}>
            <div className="iso-modal" style={{ width: '400px', maxWidth: '90%', padding: '24px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
              
              {deleteStep === 0 && (
                <>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--iso-text)' }}>Are you sure?</h3>
                  <p style={{ fontSize: '13px', color: 'var(--iso-text-muted)', marginBottom: '24px', lineHeight: '1.5' }}>
                    Do you really want to delete your account? This will wipe your profile configuration.
                  </p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="iso-btn" style={{ flex: 1 }} onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
                    <button className="iso-btn" style={{ flex: 1, background: 'var(--iso-danger)', color: '#fff', border: 'none' }} onClick={() => setDeleteStep(1)}>Yes, I am sure</button>
                  </div>
                </>
              )}

              {deleteStep === 1 && (
                <>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--iso-text)' }}>Are you sure sure?</h3>
                  <p style={{ fontSize: '13px', color: 'var(--iso-text-muted)', marginBottom: '24px', lineHeight: '1.5' }}>
                    All of your custom projects and shared cloud diagrams will be permanently erased. There is no way to recover them.
                  </p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="iso-btn" style={{ flex: 1 }} onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
                    <button className="iso-btn" style={{ flex: 1, background: 'var(--iso-danger)', color: '#fff', border: 'none' }} onClick={() => setDeleteStep(2)}>Yes, delete everything</button>
                  </div>
                </>
              )}

              {deleteStep === 2 && (
                <>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--iso-error)' }}>Are you sure sure sure?</h3>
                  <p style={{ fontSize: '13px', color: 'var(--iso-text-muted)', marginBottom: '24px', lineHeight: '1.5' }}>
                    This action is final and irreversible. This will delete your authentication record from our database.
                  </p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="iso-btn" style={{ flex: 1 }} onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
                    <button className="iso-btn" style={{ flex: 1, background: 'var(--iso-danger)', color: '#fff', border: 'none', fontWeight: 700 }} onClick={handleDeleteAccount}>Yes, permanently delete my account</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {projectDetailModalOpen && projectDetailProject && (
          <div className="iso-modal-overlay" style={{ zIndex: 2100 }} onClick={() => setProjectDetailModalOpen(false)}>
            <div className="iso-modal" style={{ width: '480px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '24px' }} onClick={e => e.stopPropagation()}>
              <div className="iso-modal-header" style={{ marginBottom: '16px' }}>
                <h3 className="iso-modal-title" style={{ fontSize: '18px', fontWeight: 600 }}>{projectDetailProject.name}</h3>
                <button className="iso-modal-close" onClick={() => setProjectDetailModalOpen(false)}>×</button>
              </div>

              <p className="iso-modal-desc" style={{ marginBottom: '16px' }}>
                Select a file to open, or open the entire project.
              </p>

              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '120px', maxHeight: '300px', paddingRight: '4px' }}>
                {isLoadingProjectDetail ? (
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--iso-text-muted)' }}>
                    <div className="iso-spinner" style={{ marginRight: '8px' }} /> Loading files...
                  </div>
                ) : projectDetailDiagrams.length === 0 ? (
                  <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--iso-text-muted)', padding: '24px', textAlign: 'center', background: 'var(--iso-bg-header)', borderRadius: '8px', border: '1px dashed var(--iso-border)' }}>
                    <span style={{ fontSize: '24px', marginBottom: '8px' }}>📂</span>
                    <span>This project has no files.</span>
                  </div>
                ) : (
                  projectDetailDiagrams.map(d => (
                    <div
                      key={d.id}
                      onClick={() => openProjectFile(d, projectDetailProject.id, getDiagramRole(d.id))}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          type: 'diagram',
                          id: d.id,
                          x: e.clientX,
                          y: e.clientY,
                          extra: {
                            projectId: projectDetailProject.id,
                            diagramName: d.name,
                            diagram: d
                          }
                        });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: 'var(--iso-bg-header)',
                        border: '1px solid var(--iso-border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-in-out',
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.borderColor = 'var(--iso-accent)';
                        e.currentTarget.style.background = 'var(--iso-bg-hover)';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.borderColor = 'var(--iso-border)';
                        e.currentTarget.style.background = 'var(--iso-bg-header)';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '14px', color: 'var(--iso-text)' }}>{d.name}</strong>
                          {projectDetailProject.owner_id !== user?.id && (
                            <span style={{
                              fontSize: '10px',
                              background: 'var(--iso-bg-app)',
                              border: '1px solid var(--iso-border)',
                              padding: '1px 5px',
                              borderRadius: '8px',
                              textTransform: 'capitalize',
                              color: 'var(--iso-text-muted)',
                              fontWeight: 500
                            }}>
                              {t(`share.${getDiagramRole(d.id)}`) || getDiagramRole(d.id)}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--iso-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{d.kind}</span>
                      </div>
                      <span style={{ fontSize: '18px', color: 'var(--iso-text-muted)' }}>→</span>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="iso-btn" style={{ flex: 1 }} onClick={() => setProjectDetailModalOpen(false)}>
                  {t('ui.cancel')}
                </button>
                <button
                  className="iso-btn iso-btn--primary"
                  style={{ flex: 1 }}
                  disabled={isLoadingProjectDetail || projectDetailDiagrams.length === 0}
                  onClick={() => {
                    const rolesMap: Record<string, string> = {};
                    projectDetailDiagrams.forEach(d => {
                      rolesMap[d.id] = getDiagramRole(d.id);
                    });
                    openWholeProject(
                      projectDetailDiagrams,
                      projectDetailProject.id,
                      projectDetailProject.owner_id === user?.id ? 'owner' : (projectDetailAccessMap.base || 'viewer'),
                      rolesMap
                    );
                  }}
                >
                  Open Whole Project
                </button>
              </div>
            </div>
          </div>
        )}

        {diagramToDelete && (
          <div className="iso-modal-overlay" style={{ zIndex: 2200 }} onClick={() => setDiagramToDelete(null)}>
            <div className="iso-modal" onClick={e => e.stopPropagation()} style={{ width: '400px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', marginBottom: '16px' }}>Delete Diagram</h3>
              <p style={{ color: 'var(--iso-text-muted)', marginBottom: '24px' }}>
                Are you sure you want to delete "{diagramToDelete.name}"? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button className="iso-btn" onClick={() => setDiagramToDelete(null)}>{t('ui.cancel')}</button>
                <button className="iso-btn" style={{ background: 'var(--iso-danger)', color: '#fff', border: 'none' }} onClick={handleConfirmDeleteDiagram}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {newCategoryPrompt && (
          <div className="iso-modal-overlay" onClick={() => setNewCategoryPrompt(false)}>
            <div className="iso-modal" onClick={e => e.stopPropagation()}>
              <button className="iso-modal-close-btn" onClick={() => setNewCategoryPrompt(false)}>×</button>
              <h2 className="iso-modal-title">New Category Name</h2>
              <div className="iso-modal-field">
                <input type="text" className="iso-input" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} autoFocus onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCategoryName.trim()) {
                    const name = newCategoryName.trim();
                    if (!customCategories.includes(name)) {
                      const next = [...customCategories, name];
                      setCustomCategories(next);
                      setLibraryCategory(name);
                      saveCustomCategoriesToDB(next);
                    }
                    setNewCategoryPrompt(false);
                  }
                }} />
              </div>
              <div className="iso-modal-actions">
                <button className="iso-modal-btn cancel" onClick={() => setNewCategoryPrompt(false)}>{t('ui.cancel')}</button>
                <button className="iso-modal-btn" onClick={() => {
                  const name = newCategoryName.trim();
                  if (name && !customCategories.includes(name)) {
                    const next = [...customCategories, name];
                    setCustomCategories(next);
                    setLibraryCategory(name);
                    saveCustomCategoriesToDB(next);
                  }
                  setNewCategoryPrompt(false);
                }}>Add Category</button>
              </div>
            </div>
          </div>
        )}

        {contextMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}></div>
            <div className="iso-context-menu" style={{ left: contextMenu.x, top: contextMenu.y, zIndex: 99999 }}>
              {contextMenu.type === 'category' && (
                <>
                  <button className="iso-context-menu-item" onClick={() => {
                    setRenameType('category');
                    setRenameTargetId(contextMenu.id);
                    setRenameValue(contextMenu.id);
                    setRenameModalOpen(true);
                    setContextMenu(null);
                  }}>Rename</button>
                  <div className="iso-context-menu-sep" />
                  <button className="iso-context-menu-item iso-context-menu-item--danger" onClick={() => {
                    const next = customCategories.filter(c => c !== contextMenu.id);
                    setCustomCategories(next);
                    saveCustomCategoriesToDB(next);
                    if (libraryCategory === contextMenu.id) setLibraryCategory('All Projects');

                    setProjects(prev => prev.map(p => {
                      if (p.settings?.category === contextMenu.id) {
                        const newSettings = { ...p.settings, category: null };
                        if (user) {
                          import('./lib/projects.js').then(({ updateProject }) => {
                            updateProject(user.id, p.id, { settings: newSettings });
                          });
                        }
                        return { ...p, settings: newSettings };
                      }
                      return p;
                    }));

                    setContextMenu(null);
                  }}>Delete Category</button>
                </>
              )}
              {contextMenu.type === 'project' && (() => {
                const project = projects.find(p => p.id === contextMenu.id);
                const isFav = project?.settings?.is_favorite;
                const currentFolder = project?.settings?.category;

                return (
                  <>
                    <button className="iso-context-menu-item" onClick={() => {
                      setRenameType('project');
                      setRenameTargetId(contextMenu.id);
                      setRenameValue(project?.name || '');
                      setRenameModalOpen(true);
                      setContextMenu(null);
                    }}>Rename</button>
                    <button className="iso-context-menu-item" onClick={() => {
                      if (project) {
                        const currentSettings = project.settings || {};
                        const nextFav = !currentSettings.is_favorite;
                        const newSettings = { ...currentSettings, is_favorite: nextFav };
                        import('./lib/projects.js').then(({ updateProject }) => {
                          if (user) {
                            updateProject(user.id, contextMenu.id, { settings: newSettings }).then(success => {
                              if (success) {
                                setProjects(prev => prev.map(p => p.id === contextMenu.id ? { ...p, settings: newSettings } : p));
                                addToast(nextFav ? 'Added to Favorites' : 'Removed from Favorites');
                              }
                            });
                          }
                        });
                      }
                      setContextMenu(null);
                    }}>{isFav ? 'Remove from Favorites' : 'Add to Favorites'}</button>
                    <div style={{ position: 'relative' }} className="iso-menu-dropdown-wrapper">
                      <button className="iso-context-menu-item" style={{ justifyContent: 'space-between', display: 'flex' }}>
                        Add to Folder <span>▶</span>
                      </button>
                      <div className="iso-menu-dropdown-submenu" style={{ position: 'absolute', left: '100%', top: 0, background: 'var(--white)', border: '1px solid var(--iso-border-strong)', borderRadius: 'var(--iso-radius-lg)', padding: '4px', display: 'none', flexDirection: 'column', minWidth: '120px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)' }}>
                        {customCategories
                          .filter(cat => cat.toLowerCase() !== 'favorites' && cat.toLowerCase() !== 'favourites')
                          .map(cat => {
                            const isCurrent = currentFolder === cat;
                            return (
                              <button
                                key={cat}
                                className="iso-context-menu-item"
                                style={{ fontWeight: isCurrent ? 'bold' : 'normal' }}
                                onClick={() => {
                                  if (project) {
                                    const currentSettings = project.settings || {};
                                    const newSettings = { ...currentSettings, category: isCurrent ? null : cat };
                                    import('./lib/projects.js').then(({ updateProject }) => {
                                      if (user) {
                                        updateProject(user.id, contextMenu.id, { settings: newSettings }).then(success => {
                                          if (success) {
                                            setProjects(prev => prev.map(p => p.id === contextMenu.id ? { ...p, settings: newSettings } : p));
                                            addToast(isCurrent ? `Removed from ${cat}` : `Added to ${cat}`);
                                          }
                                        });
                                      }
                                    });
                                  }
                                  setContextMenu(null);
                                }}
                              >
                                {cat} {isCurrent && '✓'}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                    <div className="iso-context-menu-sep" />
                    <button className="iso-context-menu-item iso-context-menu-item--danger" onClick={() => {
                      setProjectToDelete(contextMenu.id);
                      setContextMenu(null);
                    }}>Delete Project</button>
                  </>
                );
              })()}
              {contextMenu.type === 'diagram' && (
                <>
                  <button className="iso-context-menu-item" onClick={() => {
                    setRenameType('diagram');
                    setRenameTargetId(contextMenu.id);
                    setRenameValue(contextMenu.extra?.diagramName || '');
                    setRenameModalOpen(true);
                    setContextMenu(null);
                  }}>Rename</button>

                  <div style={{ position: 'relative' }} className="iso-menu-dropdown-wrapper">
                    <button className="iso-context-menu-item" style={{ justifyContent: 'space-between', display: 'flex' }}>
                      Move to Project <span>▶</span>
                    </button>
                    <div className="iso-menu-dropdown-submenu" style={{ position: 'absolute', left: '100%', top: 0, background: 'var(--iso-bg-panel)', border: '1px solid var(--iso-border)', borderRadius: '4px', padding: '4px', display: 'none', flexDirection: 'column', minWidth: '160px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)' }}>
                      {projects
                        .filter(proj => proj.id !== contextMenu.extra?.projectId)
                        .map(proj => (
                          <button
                            key={proj.id}
                            className="iso-context-menu-item"
                            onClick={() => {
                              import('./lib/projects.js').then(({ updateDiagram }) => {
                                updateDiagram(contextMenu.id, { project_id: proj.id }).then(success => {
                                  if (success) {
                                    setProjectDetailDiagrams(prev => prev.filter(d => d.id !== contextMenu.id));
                                    setTabs(prev => prev.map(t => t.diagram_id === contextMenu.id ? { ...t, project_id: proj.id } : t));
                                    addToast(`Moved to project ${proj.name}`);
                                  } else {
                                    addToast('Failed to move diagram', 'info');
                                  }
                                });
                              });
                              setContextMenu(null);
                            }}
                          >
                            {proj.name}
                          </button>
                        ))}
                      {projects.filter(proj => proj.id !== contextMenu.extra?.projectId).length === 0 && (
                        <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--iso-text-muted)', fontStyle: 'italic' }}>
                          No other projects
                        </div>
                      )}
                    </div>
                  </div>

                  <button className="iso-context-menu-item" onClick={() => {
                    downloadDiagramFile(contextMenu.extra?.diagram);
                    setContextMenu(null);
                  }}>Download</button>

                  <div className="iso-context-menu-sep" />

                  <button className="iso-context-menu-item iso-context-menu-item--danger" onClick={() => {
                    setDiagramToDelete(contextMenu.extra?.diagram);
                    setContextMenu(null);
                  }}>Delete</button>
                </>
              )}
            </div>
          </>
        )}

        {projectToDelete && (
          <div className="iso-modal-overlay" onClick={() => setProjectToDelete(null)}>
            <div className="iso-modal" onClick={e => e.stopPropagation()} style={{ width: '400px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', marginBottom: '16px' }}>Delete Project</h3>
              <p style={{ color: 'var(--iso-text-muted)', marginBottom: '24px' }}>Are you sure you want to delete this project? This action cannot be undone.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button className="iso-btn" onClick={() => setProjectToDelete(null)}>{t('ui.cancel')}</button>
                <button className="iso-btn" style={{ background: 'var(--iso-danger)', color: '#fff', border: 'none' }} onClick={() => {
                  import('./lib/supabase.js').then(({ supabase }) => {
                    supabase.from('projects').delete().eq('id', projectToDelete).then(() => {
                      setProjects(prev => prev.filter(p => p.id !== projectToDelete));
                      setProjectToDelete(null);
                      addToast('Project deleted successfully');
                    });
                  });
                }}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {renameModalOpen && (
          <div className="iso-modal-overlay" onClick={() => { setRenameModalOpen(false); setRenameType(null); setRenameTargetId(null); setRenameValue(''); }}>
            <div className="iso-modal" onClick={e => e.stopPropagation()} style={{ width: '400px' }}>
              <button className="iso-modal-close-btn" onClick={() => { setRenameModalOpen(false); setRenameType(null); setRenameTargetId(null); setRenameValue(''); }}>×</button>
              <h3 style={{ margin: 0, fontSize: '18px', marginBottom: '16px' }}>
                Rename {renameType === 'project' ? 'Project' : (renameType === 'category' ? 'Category' : 'Diagram')}
              </h3>
              <div className="iso-modal-field">
                <label>New Name</label>
                <input
                  type="text"
                  className="iso-input"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  placeholder={renameType === 'project' ? 'Project name...' : (renameType === 'category' ? 'Category name...' : 'Diagram name...')}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && renameValue.trim()) {
                      handleRenameSubmit();
                    }
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button className="iso-btn" onClick={() => { setRenameModalOpen(false); setRenameType(null); setRenameTargetId(null); setRenameValue(''); }}>{t('ui.cancel')}</button>
                <button className="iso-btn iso-btn--primary" disabled={!renameValue.trim()} onClick={handleRenameSubmit}>
                  Rename
                </button>
              </div>
            </div>
          </div>
        )}

        {isRevertModalOpen && (
          <div className="iso-modal-overlay" onClick={() => setIsRevertModalOpen(false)}>
            <div className="iso-modal" onClick={e => e.stopPropagation()}>
              <form onSubmit={e => { e.preventDefault(); confirmRevertHistory(); }}>
                <h2 className="iso-modal-title">Revert to snapshot</h2>
                <p className="iso-modal-desc" style={{ color: 'var(--iso-text-muted)' }}>
                  Are you sure you want to revert to this snapshot? This will permanently delete all newer saves.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button type="button" className="iso-btn" onClick={() => setIsRevertModalOpen(false)}>{t('ui.cancel')}</button>
                  <button type="submit" className="iso-btn" style={{ background: 'var(--iso-error)', color: 'white', borderColor: 'var(--iso-error)' }} autoFocus>Revert</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} initialMode={authMode} />

        {saveToCloudModalOpen && (
          <div className="iso-modal-overlay" onClick={() => setSaveToCloudModalOpen(false)}>
            <div className="iso-modal" onClick={e => e.stopPropagation()}>
              <h2 className="iso-modal-title">Save to Cloud</h2>
              <p className="iso-modal-desc">Select a project to save this diagram into.</p>
              <div className="iso-modal-field">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="iso-select"
                    style={{ flex: 1 }}
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSaveToCloudSubmit();
                      }
                    }}
                  >
                    <option value="">-- Select Project --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button className="iso-btn" onClick={() => {
                    setNewModalTab('project');
                    setIsNewModalOpen(true);
                    setSaveToCloudModalOpen(false);
                    setIsSavingFlow(true);
                  }}>New Project</button>
                </div>
              </div>
              <div className="iso-modal-actions">
                <button className="iso-modal-btn cancel" onClick={() => setSaveToCloudModalOpen(false)}>{t('ui.cancel')}</button>
                <button className="iso-modal-btn confirm" disabled={!selectedProjectId || isSavingToCloud} onClick={handleSaveToCloudSubmit}>{isSavingToCloud ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

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
            {toasts.map(t => (
              <div key={t.id} className="iso-toast">
                {t.type === 'success' && <span style={{ color: 'var(--iso-success, #4caf50)' }}>✓</span>}
                {t.message}
              </div>
            ))}
          </div>
        )}
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
          <div className="iso-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="iso-spinner" style={{ width: '40px', height: '40px', borderWidth: '3px', marginBottom: '16px' }} />
            <p style={{ color: 'var(--iso-text-muted)', fontSize: '14px' }}>{t('share.loading') || 'Loading shared diagram...'}</p>
          </div>
        ) : (
          <div className="iso-empty-state">
            <h1 className="iso-empty-title">{t('welcome.title')}</h1>
            <p className="iso-empty-copy">{t('welcome.description')}</p>
            <div className="iso-empty-actions">
              <div className="iso-empty-group">
                <select className="iso-modal-select" style={{ marginBottom: 0, padding: '8px 12px' }} value={newDiagramKind} onChange={e => setNewDiagramKind(e.target.value as DiagramKind)}>
                  {DIAGRAM_KINDS.filter(k => k !== 'all').map(k => (
                    <option key={k} value={k}>{t(`diagram_type.${k}`)}</option>
                  ))}
                </select>
                <button className="iso-btn iso-btn--primary" style={{ padding: '8px 16px', justifyContent: 'center' }} onClick={() => executeNewDiagram(newDiagramKind)}>
                  {t('welcome.create_new')}
                </button>
              </div>
              <div className="iso-empty-divider" aria-hidden="true"></div>
              <div className="iso-empty-group iso-empty-group--secondary">
                <button className="iso-btn" style={{ padding: '8px 16px', minHeight: '36px', justifyContent: 'center' }} onClick={() => { setLibraryTab('open_folder'); setIsLibraryOpen(true); }}>
                  {t('welcome.open_existing')}
                </button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".isx" onChange={handleFileOpen} style={{ display: 'none' }} tabIndex={-1} />
          </div>
        )}

        {/* ──────────────── MODALS (Empty State) ───────────────── */}
        {isNewModalOpen && (
          <div className="iso-modal-overlay" onClick={() => setIsNewModalOpen(false)}>
            <div className="iso-modal" onClick={e => e.stopPropagation()}>
              <h2 className="iso-modal-title">{t('welcome.create_new')}</h2>
              <p className="iso-modal-desc">{t('Select the type of diagram you\'d like to create.')}</p>
              <select className="iso-modal-select" value={newDiagramKind} onChange={e => setNewDiagramKind(e.target.value as DiagramKind)}>
                {DIAGRAM_KINDS.filter(k => k !== 'all').map(k => (
                  <option key={k} value={k}>{t(`diagram_type.${k}`)}</option>
                ))}
              </select>
              <div className="iso-modal-actions">
                <button className="iso-modal-btn cancel" onClick={() => setIsNewModalOpen(false)}>{t('ui.cancel')}</button>
                <button className="iso-modal-btn confirm" onClick={() => executeNewDiagram(newDiagramKind)}>{t('ui.create')}</button>
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
      <header className="iso-header">
        {/* Logo */}
        <button type="button" className="iso-logo" aria-label={t('ui.isomorph_home')} onClick={e => e.preventDefault()}>
          <span className="iso-logo-name">Isomorph</span>
        </button>

        <div className="iso-header-sep iso-mobile-hide" aria-hidden="true" />

        {/* File breadcrumb */}
        <div className="iso-breadcrumb iso-mobile-hide" onDoubleClick={() => {
          if (activeTab?.project_id && (!activeTab.project_role || activeTab.project_role === 'owner')) {
            setRenamingTabId('project-' + activeTab.project_id);
          }
        }}>
          {renamingTabId === 'project-' + activeTab?.project_id ? (
            <input
              autoFocus
              defaultValue={projects.find(p => p.id === activeTab?.project_id)?.name || 'Local Project'}
              className="iso-tab-rename-input"
              style={{ background: "transparent", border: "none", color: "inherit", fontFamily: "inherit", fontSize: "inherit", outline: "none", width: "100%", borderBottom: "1px solid currentColor" }}
              onBlur={() => setRenamingTabId(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const newName = e.currentTarget.value;
                  if (activeTab?.project_id && user && newName) {
                    setProjects(prev => prev.map(p => p.id === activeTab.project_id ? { ...p, name: newName } : p));
                    import('./lib/projects.js').then(m => m.updateProject(user.id, activeTab.project_id!, { name: newName }));
                    addToast('Project renamed');
                  }
                  setRenamingTabId(null);
                }
                if (e.key === "Escape") setRenamingTabId(null);
              }}
            />
          ) : (
            <span
              className="iso-breadcrumb-name"
              style={{ cursor: (activeTab?.project_id && (!activeTab.project_role || activeTab.project_role === 'owner')) ? 'pointer' : 'default' }}
              data-tooltip={(activeTab?.project_id && (!activeTab.project_role || activeTab.project_role === 'owner')) ? "Double click to rename project" : undefined}
            >
              {projects.find(p => p.id === activeTab?.project_id)?.name || 'Local Project'}
            </span>
          )}
        </div>

        {isMobileLayout && (
          <div
            className="iso-mobile-title"
            title={fileName}
            onPointerDown={e => {
              e.preventDefault();
              e.stopPropagation();
              setRenamingTabId(activeTab?.id ?? null);
            }}
            onDoubleClick={() => setRenamingTabId(activeTab?.id ?? null)}
            onClick={() => setRenamingTabId(activeTab?.id ?? null)}
          >
            {renamingTabId === activeTab?.id ? (
              <span style={{ display: "flex", alignItems: "center" }}>
                <input
                  autoFocus
                  defaultValue={fileName.includes(".") ? fileName.substring(0, fileName.lastIndexOf(".")) : fileName}
                  className="iso-tab-rename-input"
                  style={{ background: "transparent", border: "none", color: "inherit", fontFamily: "inherit", fontSize: "inherit", outline: "none", width: "100%", borderBottom: "1px solid currentColor" }}
                  onBlur={(e) => {
                    if (isMobileLayout) return;
                    const ext = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : "";
                    const newName = e.target.value ? e.target.value + ext : fileName;
                    if (activeTab) setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, name: newName } : t));
                    setRenamingTabId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const ext = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : "";
                      const newName = e.currentTarget.value ? e.currentTarget.value + ext : fileName;
                      if (activeTab) setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, name: newName } : t));
                      setRenamingTabId(null);
                    }
                    if (e.key === "Escape") setRenamingTabId(null);
                  }}
                  onClick={e => e.stopPropagation()}
                />
                <span>{fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : ""}</span>
              </span>
            ) : (
              fileName
            )}
          </div>
        )}

        <div className="iso-header-sep iso-mobile-hide" aria-hidden="true" />



        <div className="iso-mobile-hide" style={{ display: 'flex', alignItems: 'center', flex: '0 1 auto', minWidth: 0, overflow: 'hidden', marginLeft: '12px' }}>
          <button
            type="button"
            style={{ background: 'transparent', border: 'none', color: 'var(--iso-text)', cursor: 'pointer', padding: '0 4px', opacity: 0.6 }}
            onClick={e => e.currentTarget.nextElementSibling?.scrollBy({ left: -150, behavior: 'smooth' })}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
          >
            ◀
          </button>
          <nav className="iso-tabs" aria-label={t('tabs.open_files')} style={{ flex: '1 1 auto', overflowX: 'auto', display: 'flex', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {tabs.map((tab, idx) => (
              <div
                key={tab.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', idx.toString());
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                  if (isNaN(fromIdx) || fromIdx === idx) return;
                  setTabs(prev => {
                    const next = [...prev];
                    const [moved] = next.splice(fromIdx, 1);
                    next.splice(idx, 0, moved);
                    return next;
                  });
                }}
                className={`iso-tab${tab.id === activeTab?.id ? ' iso-tab--active' : ''}`}
                onClick={() => setActiveTabId(tab.id)}
                onDoubleClick={() => { if (!tab.project_role || tab.project_role === 'owner') setRenamingTabId(tab.id); }}
                aria-label={t('tabs.open_name', { name: tab.name })}
                style={{ paddingRight: tabs.length > 1 ? '4px' : '10px', cursor: 'grab' }}
              >
                {renamingTabId === tab.id ? (
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      autoFocus
                      defaultValue={tab.name.includes('.') ? tab.name.substring(0, tab.name.lastIndexOf('.')) : tab.name}
                      className="iso-tab-rename-input"
                      style={{ background: 'transparent', border: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', outline: 'none', width: '80px', borderBottom: '1px solid currentColor' }}
                      onBlur={(e) => {
                        const ext = tab.name.includes('.') ? tab.name.substring(tab.name.lastIndexOf('.')) : '';
                        const newName = e.target.value ? e.target.value + ext : tab.name;
                        setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, name: newName } : t));
                        setRenamingTabId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setRenamingTabId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                    <span>{tab.name.includes('.') ? tab.name.substring(tab.name.lastIndexOf('.')) : ''}</span>
                  </span>
                ) : (
                  tab.name
                )}
                {tabs.length > 1 && (
                  <button
                    type="button"
                    style={{ all: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '4px', marginLeft: '4px', cursor: 'pointer', opacity: 0.6 }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'transparent'; }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTabToClose(tab.id);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </nav>
          <button
            type="button"
            style={{ background: 'transparent', border: 'none', color: 'var(--iso-text)', cursor: 'pointer', padding: '0 4px', opacity: 0.6 }}
            onClick={e => e.currentTarget.previousElementSibling?.scrollBy({ left: 150, behavior: 'smooth' })}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
          >
            ▶
          </button>
        </div>

        <div className="iso-header-spacer" />

        {activeDiagram && (
          <div className={isMobileLayout ? 'iso-kind-badge iso-kind-badge--mobile iso-mobile-hide' : 'iso-kind-badge'}>
            {activeDiagram.kind}
          </div>
        )}

        {activeTab?.diagram_id && isConnected && (
          <div ref={collabRef} className="iso-avatar-stack">
            {sortedCollaborators.slice(0, 2).map((collab) => (
              <div
                key={collab.clientId}
                className="iso-avatar"
                style={{ backgroundColor: collab.avatarUrl ? 'transparent' : collab.color, border: `2px solid ${collab.color}` }}
                title={collab.clientId === awareness?.clientID ? `${collab.name} (${t('ui.you')})` : collab.name}
                onClick={() => setIsCollabDropdownOpen(prev => !prev)}
              >
                {collab.avatarUrl ? (
                  <img
                    src={collab.avatarUrl}
                    alt={collab.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      display: 'block'
                    }}
                  />
                ) : (
                  getInitials(collab.name)
                )}
              </div>
            ))}
            {sortedCollaborators.length > 2 && (
              <div
                className="iso-avatar iso-avatar-more"
                title={t('ui.connected_users')}
                onClick={() => setIsCollabDropdownOpen(prev => !prev)}
              >
                ...
              </div>
            )}
            {isCollabDropdownOpen && (
              <div className="iso-collab-dropdown">
                <div className="iso-collab-dropdown-title">
                  {t('ui.connected_users')} ({sortedCollaborators.length})
                </div>
                {sortedCollaborators.map((c) => (
                  <div key={c.clientId} className="iso-collab-user-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {c.avatarUrl ? (
                      <img
                        src={c.avatarUrl}
                        alt={c.name}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          flexShrink: 0,
                          border: `2px solid ${c.color}`
                        }}
                      />
                    ) : (
                      <span className="iso-collab-user-dot" style={{ backgroundColor: c.color }} />
                    )}
                    <div className="iso-collab-user-name" title={c.name} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.name}
                        {c.clientId === awareness?.clientID && ` (${t('ui.you')})`}
                      </span>
                      {c.username && (
                        <span style={{ fontSize: '10px', color: 'var(--iso-text-muted)', lineHeight: 1 }}>
                          @{c.username}
                        </span>
                      )}
                    </div>
                    <span
                      className="iso-collab-user-role"
                      style={{
                        fontSize: '10px',
                        color: 'var(--iso-text-muted)',
                        textTransform: 'capitalize',
                        border: '1px solid var(--iso-border)',
                        borderRadius: '4px',
                        padding: '1px 5px',
                        backgroundColor: 'var(--iso-bg-app)',
                        lineHeight: 1.2
                      }}
                    >
                      {c.role === 'owner' ? 'editor' : c.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isMobileLayout && (
          <div className="iso-header-actions">
            {(!activeTab?.project_id || activeTab?.project_role === 'owner') && (
              <>
                <button type="button" className="iso-btn" onClick={handleNew} aria-label={t('menu.new_diagram')} data-tooltip={t('menu.new_shortcut')}>
                  <IconNew />
                  {t('menu.new')}
                </button>

                <button type="button" className="iso-btn" onClick={() => setIsLibraryOpen(true)} aria-label={t('menu.open_isx')} data-tooltip={t('menu.open_shortcut')}>
                  <IconOpen />
                  {t('menu.open')}
                </button>
              </>
            )}

            {activeTab?.project_role === 'owner' && (
              <button type="button" className="iso-btn" onClick={() => setIsShareModalOpen(true)} aria-label="Share Project" data-tooltip="Share Project">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ marginRight: 4 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {t('ui.share')}
              </button>
            )}



            {activeDiagram?.kind === 'sequence' && (
              <button
                type="button"
                className="iso-btn"
                onClick={handleTransformToCollaboration}
                aria-label={t('menu.transform_seq_collab')}
                data-tooltip={t('menu.transform_collab')}
              >
                <IconTransform />
                {t('menu.transform')}
              </button>
            )}

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
              aria-label={t('menu.export_source')}
              data-tooltip={t('menu.save_isx')}
            >
              <IconSave />
              {t('menu.save_isx_ext')}
            </button>

            {session && (
              <button
                type="button"
                className={`iso-btn${isHistoryOpen ? ' iso-btn--active' : ''}`}
                onClick={toggleHistory}
                aria-label="Toggle History"
                data-tooltip="View History"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                History
              </button>
            )}

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="iso-btn"
                onClick={(e) => { e.stopPropagation(); setExportMenuOpen(o => !o); }}
                disabled={!activeDiagram || isExporting}
                aria-label={t('ui.export')}
                data-tooltip={t('ui.export')}
              >
                {isExporting ? <div className="iso-spinner" /> : <IconExport />}
                {isExporting ? `${t('ui.exporting') || 'Exporting...'} (${exportTime}s)` : t('ui.export')}
              </button>
              {exportMenuOpen && activeDiagram && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'var(--iso-bg-panel)', border: '1px solid var(--iso-border)', borderRadius: '4px', padding: '4px', zIndex: 100, display: 'flex', flexDirection: 'column', minWidth: '160px', boxShadow: '0 4px 12px var(--iso-glass-shadow)' }} onClick={e => e.stopPropagation()}>
                  <button className="iso-dropdown-item" style={{ border: 'none', textAlign: 'left', padding: '6px 12px', cursor: 'pointer', color: 'var(--iso-text)', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { setExportMenuOpen(false); handleExportPNG(); }}><IconImage /> {t('ui.export_png')}</button>
                  <button className="iso-dropdown-item" style={{ border: 'none', textAlign: 'left', padding: '6px 12px', cursor: 'pointer', color: 'var(--iso-text)', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { setExportMenuOpen(false); handleExportSVG(); }}><IconFileImage /> {t('ui.export_svg')}</button>
                  {isAnimationsEnabled && (
                    <>
                      <button className="iso-dropdown-item" style={{ border: 'none', textAlign: 'left', padding: '6px 12px', cursor: 'pointer', color: 'var(--iso-text)', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { setExportMenuOpen(false); handleExportGIF(); }}><IconGif /> {t('ui.export_gif')}</button>
                      <button className="iso-dropdown-item" style={{ border: 'none', textAlign: 'left', padding: '6px 12px', cursor: 'pointer', color: 'var(--iso-text)', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { setExportMenuOpen(false); handleExportMP4(); }}><IconVideo /> {t('ui.export_mp4')}</button>
                    </>
                  )}
                </div>
              )}
            </div>

            {isAnimationsEnabled && activeDiagram && (
              <button
                type="button"
                className="iso-btn"
                onClick={() => setIsAnimating(a => !a)}
                aria-label={isAnimating ? t('ui.pause') : t('ui.play')}
                data-tooltip={isAnimating ? t('ui.pause') : t('ui.play')}
                style={{ color: isAnimating ? 'var(--iso-accent)' : 'inherit' }}
              >
                {isAnimating ? '⏸' : '▶'} {isAnimating ? t('ui.pause') : t('ui.play')}
              </button>
            )}

            <div className="iso-header-sep" aria-hidden="true" />

            <button
              type="button"
              className="iso-btn iso-btn--icon"
              onClick={() => setShortcutsOpen(o => !o)}
              aria-label={t('ui.shortcuts')}
              data-tooltip={t('menu.shortcuts')}
            >
              <IconKeyboard size={20} />
            </button>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept=".isx" onChange={handleFileOpen} style={{ display: 'none' }} tabIndex={-1} />

        <button
          type="button"
          className="iso-btn iso-btn--icon iso-mobile-hide"
          style={{ marginLeft: 'auto' }}
          onClick={() => { setSettingsTab('profile'); setIsSettingsOpen(true); }}
          aria-label="Settings"
          data-tooltip="Settings"
        >
          <IconSettings size={20} />
        </button>
      </header>

      {isMobileLayout && (
        <>
          <div className="iso-mobile-meta">
            {activeDiagram && (
              <div className="iso-kind-badge iso-kind-badge--mobile">
                {activeDiagram.kind}
              </div>
            )}
          </div>

          {tabs.length > 1 && (
            <div className="iso-mobile-strip">
              <nav className="iso-tabs" aria-label={t('tabs.open_files')}>
                {tabs.map(tab => (
                  <div
                    key={tab.id}
                    className={`iso-tab${tab.id === activeTab?.id ? ' iso-tab--active' : ''}`}
                    onClick={() => {
                      setActiveTabId(tab.id);
                    }}
                    onDoubleClick={() => { if (!tab.project_role || tab.project_role === 'owner') setRenamingTabId(tab.id); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {renamingTabId === tab.id ? (
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          autoFocus
                          defaultValue={tab.name.includes('.') ? tab.name.substring(0, tab.name.lastIndexOf('.')) : tab.name}
                          className="iso-tab-rename-input"
                          style={{ background: 'transparent', border: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', outline: 'none', width: '80px', borderBottom: '1px solid currentColor' }}
                          onBlur={(e) => {
                            const ext = tab.name.includes('.') ? tab.name.substring(tab.name.lastIndexOf('.')) : '';
                            const newName = e.target.value ? e.target.value + ext : tab.name;
                            setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, name: newName } : t));
                            setRenamingTabId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') setRenamingTabId(null);
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                        <span>{tab.name.includes('.') ? tab.name.substring(tab.name.lastIndexOf('.')) : ''}</span>
                      </span>
                    ) : (
                      <>
                        <span
                          style={{ cursor: activeTab?.project_id ? 'pointer' : 'default' }}
                          data-tooltip={activeTab?.project_id ? "Double click to rename project" : undefined}
                        >
                          {tab.name}
                        </span>
                        {tabs.length > 1 && (
                          <button
                            type="button"
                            aria-label={t('tabs.close_name', { name: tab.name })}
                            style={{ all: 'unset', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 4, opacity: 0.75, fontSize: 13, lineHeight: 1, cursor: 'pointer' }}
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
                  <button type="button" className="iso-btn" onClick={() => setIsLibraryOpen(true)}>
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
                  onClick={() => setIsAnimating(a => !a)}
                  style={{ color: isAnimating ? 'var(--iso-accent)' : 'inherit' }}
                >
                  {isAnimating ? '⏸' : '▶'} {isAnimating ? t('ui.pause') : t('ui.play')}
                </button>
              )}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="iso-btn"
                  onClick={() => setExportMenuOpen(o => !o)}
                  disabled={!activeDiagram}
                >
                  <IconExport />
                  {t('ui.export')}
                </button>
                {exportMenuOpen && activeDiagram && (
                  <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '4px', background: 'var(--iso-bg-panel)', border: '1px solid var(--iso-border)', borderRadius: '4px', padding: '4px', zIndex: 100, display: 'flex', flexDirection: 'column', minWidth: '160px', boxShadow: '0 -4px 12px var(--iso-glass-shadow)' }}>
                    <button className="iso-dropdown-item" style={{ border: 'none', textAlign: 'left', padding: '6px 12px', cursor: 'pointer', color: 'var(--iso-text)', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { setExportMenuOpen(false); handleExportPNG(); }}><IconImage /> {t('ui.export_png')}</button>
                    <button className="iso-dropdown-item" style={{ border: 'none', textAlign: 'left', padding: '6px 12px', cursor: 'pointer', color: 'var(--iso-text)', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { setExportMenuOpen(false); handleExportSVG(); }}><IconFileImage /> {t('ui.export_svg')}</button>
                    {isAnimationsEnabled && (
                      <>
                        <button className="iso-dropdown-item" style={{ border: 'none', textAlign: 'left', padding: '6px 12px', cursor: 'pointer', color: 'var(--iso-text)', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { setExportMenuOpen(false); handleExportGIF(); }}><IconGif /> {t('ui.export_gif')}</button>
                        <button className="iso-dropdown-item" style={{ border: 'none', textAlign: 'left', padding: '6px 12px', cursor: 'pointer', color: 'var(--iso-text)', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { setExportMenuOpen(false); handleExportMP4(); }}><IconVideo /> {t('ui.export_mp4')}</button>
                      </>
                    )}
                  </div>
                )}
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
              <button type="button" className="iso-btn iso-btn--icon" onClick={() => setShortcutsOpen(o => !o)} aria-label={t('ui.shortcuts')}>
                <IconKeyboard />
              </button>
              <select
                className="iso-select"
                aria-label={t('ui.language')}
                value={language}
                onChange={e => setLanguage(e.target.value as Language)}
                style={{ width: 'auto', minHeight: 32 }}
              >
                {LANGUAGE_OPTIONS.map(option => (
                  <option key={option.code} value={option.code}>{option.label}</option>
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
                <input type="checkbox" checked={isUMLCompliant} onChange={e => setIsUMLCompliant(e.target.checked)} />
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
            <div style={{
              width: (isHistoryOpen || activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? 0 : 'var(--iso-sidebar-width, 200px)',
              overflow: 'hidden',
              transition: 'width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.3s ease',
              opacity: (isHistoryOpen || activeTab?.project_role === 'viewer' || activeTab?.project_role === 'commenter') ? 0 : 1,
              flexShrink: 0
            }}>
              {(activeTab?.project_role !== 'viewer' && activeTab?.project_role !== 'commenter') && shapesPane}
            </div>
            <SplitPane left={sourcePane} right={canvasPane} separatorLabel={t('tool.resize_panels')} />
            <div style={{
              width: isHistoryOpen ? 'var(--iso-sidebar-width, 200px)' : 0,
              overflow: 'hidden',
              transition: 'width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.3s ease',
              opacity: isHistoryOpen ? 1 : 0,
              flexShrink: 0,
              borderLeft: isHistoryOpen ? '1px solid var(--iso-border)' : 'none',
              background: 'var(--iso-bg-sidebar)'
            }}>
              {historyPane}
            </div>
          </>
        )}
      </main>

      {editingEntity && (
        <div className="iso-modal-overlay" onClick={() => setEditingEntity(null)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h3>{t('edit.entity_title')}</h3>
            <div className="iso-modal-field">
              <label>{t('edit.name')}</label>
              <input type="text" value={editingEntity.name} onChange={e => setEditingEntity({ ...editingEntity, name: e.target.value })} autoFocus={!isMobileLayout && editingEntity.kind !== 'note'} />
            </div>

            {editingEntity.kind === 'note' ? (
              <div className="iso-modal-field" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                  <span>{t('edit.body')} (Markdown)</span>
                  <div style={{ display: 'flex', gap: '4px', userSelect: 'none' }}>
                    <button type="button" className="iso-btn" title="Bold (Ctrl+B)" onMouseDown={e => e.preventDefault()} style={{ padding: '2px 8px', fontWeight: 'bold' }} onClick={(e) => {
                      e.stopPropagation();
                      const target = document.getElementById('note-body-textarea') as HTMLTextAreaElement;
                      if (!target) return;
                      const start = target.selectionStart;
                      const end = target.selectionEnd;
                      const val = target.value;
                      const prefix = '**'; const suffix = '**';
                      let newVal = val, newStart = start, newEnd = end;
                      if (start >= prefix.length && end <= val.length - suffix.length && val.substring(start - prefix.length, start) === prefix && val.substring(end, end + suffix.length) === suffix) {
                        newVal = val.substring(0, start - prefix.length) + val.substring(start, end) + val.substring(end + suffix.length);
                        newStart = start - prefix.length; newEnd = end - prefix.length;
                      } else {
                        newVal = val.substring(0, start) + prefix + val.substring(start, end) + suffix + val.substring(end);
                        newStart = start + prefix.length; newEnd = end + prefix.length;
                      }
                      setEditingEntity({ ...editingEntity, bodyText: newVal });
                      setTimeout(() => { target.focus(); target.setSelectionRange(newStart, newEnd); }, 0);
                    }}>B</button>
                    <button type="button" className="iso-btn" title="Italic (Ctrl+I)" onMouseDown={e => e.preventDefault()} style={{ padding: '2px 8px', fontStyle: 'italic' }} onClick={(e) => {
                      e.stopPropagation();
                      const target = document.getElementById('note-body-textarea') as HTMLTextAreaElement;
                      if (!target) return;
                      const start = target.selectionStart;
                      const end = target.selectionEnd;
                      const val = target.value;
                      const prefix = '*'; const suffix = '*';
                      let newVal = val, newStart = start, newEnd = end;
                      if (start >= prefix.length && end <= val.length - suffix.length && val.substring(start - prefix.length, start) === prefix && val.substring(end, end + suffix.length) === suffix) {
                        newVal = val.substring(0, start - prefix.length) + val.substring(start, end) + val.substring(end + suffix.length);
                        newStart = start - prefix.length; newEnd = end - prefix.length;
                      } else {
                        newVal = val.substring(0, start) + prefix + val.substring(start, end) + suffix + val.substring(end);
                        newStart = start + prefix.length; newEnd = end + prefix.length;
                      }
                      setEditingEntity({ ...editingEntity, bodyText: newVal });
                      setTimeout(() => { target.focus(); target.setSelectionRange(newStart, newEnd); }, 0);
                    }}>I</button>
                    <button type="button" className="iso-btn" title="Underline (Ctrl+U)" onMouseDown={e => e.preventDefault()} style={{ padding: '2px 8px', textDecoration: 'underline' }} onClick={(e) => {
                      e.stopPropagation();
                      const target = document.getElementById('note-body-textarea') as HTMLTextAreaElement;
                      if (!target) return;
                      const start = target.selectionStart;
                      const end = target.selectionEnd;
                      const val = target.value;
                      const prefix = '__'; const suffix = '__';
                      let newVal = val, newStart = start, newEnd = end;
                      if (start >= prefix.length && end <= val.length - suffix.length && val.substring(start - prefix.length, start) === prefix && val.substring(end, end + suffix.length) === suffix) {
                        newVal = val.substring(0, start - prefix.length) + val.substring(start, end) + val.substring(end + suffix.length);
                        newStart = start - prefix.length; newEnd = end - prefix.length;
                      } else {
                        newVal = val.substring(0, start) + prefix + val.substring(start, end) + suffix + val.substring(end);
                        newStart = start + prefix.length; newEnd = end + prefix.length;
                      }
                      setEditingEntity({ ...editingEntity, bodyText: newVal });
                      setTimeout(() => { target.focus(); target.setSelectionRange(newStart, newEnd); }, 0);
                    }}>U</button>
                    <button type="button" className="iso-btn" title="Strikethrough" onMouseDown={e => e.preventDefault()} style={{ padding: '2px 8px', textDecoration: 'line-through' }} onClick={(e) => {
                      e.stopPropagation();
                      const target = document.getElementById('note-body-textarea') as HTMLTextAreaElement;
                      if (!target) return;
                      const start = target.selectionStart;
                      const end = target.selectionEnd;
                      const val = target.value;
                      const prefix = '~~'; const suffix = '~~';
                      let newVal = val, newStart = start, newEnd = end;
                      if (start >= prefix.length && end <= val.length - suffix.length && val.substring(start - prefix.length, start) === prefix && val.substring(end, end + suffix.length) === suffix) {
                        newVal = val.substring(0, start - prefix.length) + val.substring(start, end) + val.substring(end + suffix.length);
                        newStart = start - prefix.length; newEnd = end - prefix.length;
                      } else {
                        newVal = val.substring(0, start) + prefix + val.substring(start, end) + suffix + val.substring(end);
                        newStart = start + prefix.length; newEnd = end + prefix.length;
                      }
                      setEditingEntity({ ...editingEntity, bodyText: newVal });
                      setTimeout(() => { target.focus(); target.setSelectionRange(newStart, newEnd); }, 0);
                    }}>S</button>
                  </div>
                </label>
                <textarea
                  id="note-body-textarea"
                  value={editingEntity.bodyText ?? ''}
                  onChange={e => setEditingEntity({ ...editingEntity, bodyText: e.target.value })}
                  onKeyDown={e => {
                    if (e.ctrlKey && !e.shiftKey) {
                      const target = e.target as HTMLTextAreaElement;
                      const start = target.selectionStart;
                      const end = target.selectionEnd;
                      const val = target.value;

                      const toggleFormat = (prefix: string, suffix: string) => {
                        let newVal = val, newStart = start, newEnd = end;
                        if (start >= prefix.length && end <= val.length - suffix.length && val.substring(start - prefix.length, start) === prefix && val.substring(end, end + suffix.length) === suffix) {
                          newVal = val.substring(0, start - prefix.length) + val.substring(start, end) + val.substring(end + suffix.length);
                          newStart = start - prefix.length; newEnd = end - prefix.length;
                        } else {
                          newVal = val.substring(0, start) + prefix + val.substring(start, end) + suffix + val.substring(end);
                          newStart = start + prefix.length; newEnd = end + prefix.length;
                        }
                        setEditingEntity({ ...editingEntity, bodyText: newVal });
                        setTimeout(() => { target.focus(); target.setSelectionRange(newStart, newEnd); }, 0);
                      };

                      if (e.key === 'b') {
                        e.preventDefault();
                        toggleFormat('**', '**');
                      } else if (e.key === 'i') {
                        e.preventDefault();
                        toggleFormat('*', '*');
                      } else if (e.key === 'u') {
                        e.preventDefault();
                        toggleFormat('__', '__');
                      }
                    }
                  }}
                  style={{ width: '100%', minHeight: '200px', fontFamily: 'monospace', padding: '0.5rem', resize: 'vertical' }}
                  autoFocus={!isMobileLayout}
                />
              </div>
            ) : (
              <>
                <div className="iso-modal-field">
                  <label>{t('edit.kind')}</label>
                  <span style={{ padding: '0.4rem', border: '1px solid transparent' }}>{editingEntity.kind}</span>
                </div>
                {entitySupportsStereotype(editingEntity.kind) && (
                  <div className="iso-modal-field">
                    <label>{['alt', 'loop', 'opt', 'par', 'break', 'critical'].includes(editingEntity.kind) ? 'Caption' : t('edit.stereotype')}</label>
                    <input type="text" value={editingEntity.stereotype} onChange={e => setEditingEntity({ ...editingEntity, stereotype: e.target.value })} placeholder={['alt', 'loop', 'opt', 'par', 'break', 'critical'].includes(editingEntity.kind) ? 'e.g. cond' : t('edit.eg_device')} />
                  </div>
                )}
                {['alt', 'par'].includes(editingEntity.kind) && (
                  <div className="iso-modal-field" style={{ flexDirection: 'column', alignItems: 'flex-start', paddingTop: '0.5rem' }}>
                    <label style={{ marginBottom: '0.5rem' }}>Substates (Else Branches)</label>
                    {(editingEntity.elseBlocks || []).map((b, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.5rem', width: '100%', marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          value={b.label || ''}
                          onChange={e => {
                            const newBlocks = [...(editingEntity.elseBlocks || [])];
                            newBlocks[i] = { ...newBlocks[i], label: e.target.value };
                            setEditingEntity({ ...editingEntity, elseBlocks: newBlocks });
                          }}
                          placeholder="Caption"
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="iso-btn"
                          title="Remove Substate"
                          onClick={() => {
                            const newBlocks = (editingEntity.elseBlocks || []).filter((_, idx) => idx !== i);
                            setEditingEntity({ ...editingEntity, elseBlocks: newBlocks });
                          }}
                        >-</button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="iso-btn"
                      onClick={() => {
                        const newBlocks = [...(editingEntity.elseBlocks || []), { label: '' }];
                        setEditingEntity({ ...editingEntity, elseBlocks: newBlocks });
                      }}
                      style={{ width: '100%', marginTop: '0.2rem' }}
                    >
                      + Add Substate
                    </button>
                  </div>
                )}
                {['class', 'interface'].includes(editingEntity.kind) && (
                  <div className="iso-modal-field">
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem' }}>
                      <input type="checkbox" checked={editingEntity.isAbstract} onChange={e => setEditingEntity({ ...editingEntity, isAbstract: e.target.checked })} style={{ margin: 0 }} />
                      {t('edit.abstract')}
                    </label>
                  </div>
                )}
                {editingEntity.kind === 'interface' && ['component', 'deployment'].includes(activeDiagram?.kind || '') && (
                  <div className="iso-modal-field">
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem' }}>
                      <input type="checkbox" checked={editingEntity.stereotype === 'lollipop'} onChange={e => setEditingEntity({ ...editingEntity, stereotype: e.target.checked ? 'lollipop' : '' })} style={{ margin: 0 }} />
                      {t('edit.lollipop')}
                    </label>
                  </div>
                )}
                {[
                  'class', 'interface', 'enum', 'struct', 'component', 'node', 'device',
                  'environment', 'state', 'activity', 'usecase', 'actor', 'multiobject',
                  'active_object', 'collaboration', 'composite', 'concurrent', 'artifact'
                ].includes(editingEntity.kind) && (
                    <div className="iso-modal-field" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                        <label>{t('edit.body')}</label>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {['enum'].includes(editingEntity.kind) && (
                            <button type="button" className="iso-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'NEW_VALUE' } : null); }}>{t('edit.enum_value')}</button>
                          )}
                          {['usecase'].includes(editingEntity.kind) && (
                            <button type="button" className="iso-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'extensionPoint' } : null); }}>{t('edit.ext_pt')}</button>
                          )}
                          {['class', 'interface'].includes(editingEntity.kind) && (
                            <>
                              <button type="button" className="iso-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '+ newField : string' } : null); }}>{t('edit.pub_field')}</button>
                              <button type="button" className="iso-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '- newField : string' } : null); }}>{t('edit.priv_field')}</button>
                              <button type="button" className="iso-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '+ newMethod() : void' } : null); }}>{t('edit.pub_method')}</button>
                            </>
                          )}
                          {['node', 'device', 'environment', 'component'].includes(editingEntity.kind) && (
                            <>
                              {activeDiagram?.kind !== 'component' && (
                                <>
                                  <button type="button" className="iso-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'node NewNode' } : null); }}>{t('edit.node')}</button>
                                  <button type="button" className="iso-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'artifact NewArtifact' } : null); }}>{t('edit.artifact')}</button>
                                </>
                              )}
                              <button type="button" className="iso-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '+ port1 : provided' } : null); }}>{t('edit.port_prov')}</button>
                              <button type="button" className="iso-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '+ port2 : required' } : null); }}>{t('edit.port_req')}</button>
                            </>
                          )}
                          {['state', 'composite', 'concurrent'].includes(editingEntity.kind) && (
                            <>
                              <button type="button" className="iso-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'entry() : void' } : null); }}>{t('edit.entry')}</button>
                              <button type="button" className="iso-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'exit() : void' } : null); }}>{t('edit.exit')}</button>
                              <button type="button" className="iso-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'do() : void' } : null); }}>{t('edit.do')}</button>
                              <button type="button" className="iso-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'state SubState' } : null); }}>{t('edit.substate')}</button>
                            </>
                          )}
                        </div>
                      </div>
                      <textarea
                        value={editingEntity.bodyText ?? ''}
                        onChange={e => setEditingEntity({ ...editingEntity, bodyText: e.target.value })}
                        style={{ width: '100%', minHeight: '120px', fontFamily: 'monospace', padding: '0.5rem', resize: 'vertical' }}
                      />
                    </div>
                  )}
              </>
            )}
            <div className="iso-modal-actions">
              <button type="button" className="iso-btn" onClick={(e) => { e.stopPropagation(); setEditingEntity(null); }}>{t('ui.cancel')}</button>
              <button type="button" className="iso-btn iso-btn--primary" onClick={(e) => { e.stopPropagation(); const isNameOnlyBoundary = editingEntity.kind === 'partition' || editingEntity.kind === 'system' || editingEntity.kind === 'boundary'; handleEntityEdit(editingEntity.origName || editingEntity.id, { name: editingEntity.name, stereotype: isNameOnlyBoundary ? undefined : editingEntity.stereotype, isAbstract: editingEntity.isAbstract, bodyText: editingEntity.bodyText, kind: editingEntity.kind, elseBlocks: editingEntity.elseBlocks }); }}>{t('menu.save')}</button>
            </div>
          </div>
        </div>
      )}

      {editingRelation && (
        <div className="iso-modal-overlay" onClick={() => setEditingRelation(null)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h3>{t('edit.relation_title')}</h3>
            <div className="iso-modal-field">
              <label>{t('edit.role_label')}</label>
              <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                <input type="text" style={{ flex: 1 }} value={editingRelation.label} onChange={e => setEditingRelation({ ...editingRelation, label: e.target.value })} autoFocus={!isMobileLayout} />
                {['state', 'activity'].includes(activeDiagram?.kind || '') && (
                  <button className="iso-btn" onClick={() => setEditingRelation(r => r ? { ...r, label: r.label.includes('[') ? r.label : `[${r.label || 'guard'}]` } : null)}>{t('edit.guard')}</button>
                )}
              </div>
            </div>
            {['class'].includes(activeDiagram?.kind || '') && (
              <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
                <div className="iso-modal-field" style={{ flex: 1, minWidth: 0 }}>
                  <label>{t('edit.from_mult')}</label>
                  <input type="text" value={editingRelation.fromMult || ''} onChange={e => setEditingRelation({ ...editingRelation, fromMult: e.target.value })} />
                </div>
                <div className="iso-modal-field" style={{ flex: 1, minWidth: 0 }}>
                  <label>{t('edit.to_mult')}</label>
                  <input type="text" value={editingRelation.toMult || ''} onChange={e => setEditingRelation({ ...editingRelation, toMult: e.target.value })} />
                </div>
              </div>
            )}
            {activeDiagram?.kind === 'sequence' ? (
              <div className="iso-modal-field">
                <label>{t('edit.seq_message_type')}</label>
                <select
                  className="iso-select"
                  value={editingRelation.seqMessageType || 'synchronous'}
                  onChange={e => setEditingRelation({ ...editingRelation, seqMessageType: e.target.value as SequenceMessageType })}
                >
                  <option value="synchronous">{t('rel.seq_synchronous')}</option>
                  <option value="asynchronous">{t('rel.seq_asynchronous')}</option>
                  <option value="response">{t('rel.seq_response')}</option>
                  <option value="self-call">{t('rel.seq_self_call')}</option>
                </select>
              </div>
            ) : (
              <div className="iso-modal-field">
                <label>{t('edit.kind')}</label>
                <select className="iso-select" value={editingRelation.kind} onChange={e => setEditingRelation({ ...editingRelation, kind: e.target.value })}>
                  <option value="association">{t('rel.association')}</option>
                  <option value="directed-association">{t('rel.directed_association')}</option>
                  <option value="inheritance">{t('rel.inheritance')}</option>
                  <option value="realization">{t('rel.realization')}</option>
                  <option value="aggregation">{t('rel.aggregation')}</option>
                  <option value="composition">{t('rel.composition')}</option>
                  <option value="dependency">{t('rel.dependency')}</option>
                  <option value="restriction">{t('rel.restriction')}</option>
                  {['component', 'deployment'].includes(activeDiagram?.kind || '') && (
                    <>
                      <option value="provides">{t('rel.provides')}</option>
                      <option value="requires">{t('rel.requires')}</option>
                    </>
                  )}
                </select>
              </div>
            )}
            <div className="iso-modal-field">
              <label>{t('edit.direction')}</label>
              <select className="iso-select" value={editingRelation.direction} onChange={e => setEditingRelation({ ...editingRelation, direction: e.target.value as 'forward' | 'reverse' })}>
                <option value="forward">{t('edit.forward')}</option>
                <option value="reverse">{t('edit.reverse')}</option>
              </select>
            </div>
            {activeDiagram?.kind === 'sequence' && (
              <div className="iso-modal-field">
                <label>{t('edit.seq_lifecycle')}</label>
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <button
                    className="iso-btn"
                    onClick={() => {
                      updateActiveTab(tab => ({
                        ...tab,
                        source: formatDiagramSource(insertSequenceLifecycleAfterRelation(tab.source, editingRelation.relationId, 'create')),
                      }));
                    }}
                  >
                    {t('edit.seq_create_target')}
                  </button>
                  <button
                    className="iso-btn"
                    onClick={() => {
                      updateActiveTab(tab => ({
                        ...tab,
                        source: formatDiagramSource(insertSequenceLifecycleAfterRelation(tab.source, editingRelation.relationId, 'destroy')),
                      }));
                    }}
                  >
                    {t('edit.seq_destroy_target')}
                  </button>
                </div>
              </div>
            )}
            <div className="iso-modal-actions">
              <button className="iso-btn" onClick={() => setEditingRelation(null)}>{t('ui.cancel')}</button>
              <button className="iso-btn iso-btn--primary" onClick={() => handleRelationEdit(editingRelation.relationId, { label: editingRelation.label, kind: editingRelation.kind, direction: editingRelation.direction, fromMult: editingRelation.fromMult, toMult: editingRelation.toMult, seqMessageType: editingRelation.seqMessageType })}>{t('menu.save')}</button>
            </div>
          </div>
        </div>
      )}

      {editingText && (<div className="iso-modal-overlay" onClick={() => setEditingText(null)}> <div className="iso-modal" onClick={e => e.stopPropagation()}> <h3>{editingText.type === 'diagram' ? t('edit.diagram_name') : t('edit.package_name')}</h3> <div className="iso-modal-field"> <label>{t('edit.name')}</label> <input type="text" style={{ width: '100%', padding: '0.4rem' }} value={editingText.newName} onChange={e => setEditingText({ ...editingText, newName: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { updateActiveTab(tab => { let src = tab.source; if (editingText.type === 'diagram') { src = src.replace(new RegExp('diagram\\s+' + editingText.oldName), 'diagram ' + editingText.newName); } else { src = src.replace(new RegExp('package\\s+' + editingText.oldName + '\\b'), 'package ' + editingText.newName); src = src.replace(new RegExp('@' + editingText.oldName + '\\s+at'), '@' + editingText.newName + ' at'); } return { ...tab, source: src }; }); setEditingText(null); } }} autoFocus={!isMobileLayout} /> </div> <div className="iso-modal-actions"> <button className="iso-btn" onClick={() => setEditingText(null)}>{t('ui.cancel')}</button> <button className="iso-btn iso-btn--primary" onClick={() => { updateActiveTab(tab => { let src = tab.source; if (editingText.type === 'diagram') { src = src.replace(new RegExp('diagram\\s+' + editingText.oldName), 'diagram ' + editingText.newName); } else { src = src.replace(new RegExp('package\\s+' + editingText.oldName + '\\b'), 'package ' + editingText.newName); src = src.replace(new RegExp('@' + editingText.oldName + '\\s+at'), '@' + editingText.newName + ' at'); } return { ...tab, source: src }; }); setEditingText(null); }}>{t('menu.save')}</button> </div> </div> </div>)}

      {/* ──────────────── STATUS BAR ──────────────────────── */}
      <footer className="iso-statusbar">
        <span className="iso-statusbar-item">{t('ui.isomorph_dsl')}</span>
        <span className="iso-statusbar-sep">·</span>
        <span className="iso-statusbar-item" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {t(source.split('\n').length === 1 ? 'status.line' : 'status.lines', { count: source.split('\n').length })}
        </span>
        {activeDiagram && (
          <>
            <span className="iso-statusbar-sep">·</span>
            <span className="iso-statusbar-item" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t(activeDiagram.entities.size === 1 ? 'status.entity' : 'status.entities', { count: activeDiagram.entities.size })}
            </span>
            <span className="iso-statusbar-sep">·</span>
            <span className="iso-statusbar-item" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t(activeDiagram.relations.length === 1 ? 'status.relation' : 'status.relations', { count: activeDiagram.relations.length })}
            </span>
            <span className="iso-statusbar-sep">·</span>
            <span className="iso-statusbar-item">{activeDiagram.kind}</span>
          </>
        )}
      </footer>

      {/* ──────────────── SHORTCUTS OVERLAY ───────────────── */}
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} t={t} />

      {/* ──────────────── MODALS ───────────────── */}
      {isNewModalOpen && (
        <div className="iso-modal-overlay" onClick={() => { setIsNewModalOpen(false); setIsSavingFlow(false); }}>
          <div className="iso-modal" onClick={e => e.stopPropagation()} style={{ width: '400px' }}>
            <button className="iso-modal-close-btn" onClick={() => { setIsNewModalOpen(false); setIsSavingFlow(false); }}>×</button>
            <h3 style={{ margin: 0, fontSize: '20px', marginBottom: '16px' }}>{'Create new'}</h3>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--iso-bg-header)', padding: '4px', borderRadius: '8px' }}>
              <button
                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: newModalTab === 'tab' ? 'var(--iso-primary)' : 'transparent', color: newModalTab === 'tab' ? 'var(--white)' : 'var(--iso-text)', cursor: 'pointer', fontWeight: 500 }}
                onClick={() => { setNewModalTab('tab'); setNewProjectError(''); }}
              >
                Diagram
              </button>
              <button
                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: newModalTab === 'project' ? 'var(--iso-primary)' : 'transparent', color: newModalTab === 'project' ? 'var(--white)' : 'var(--iso-text)', cursor: 'pointer', fontWeight: 500 }}
                onClick={() => { setNewModalTab('project'); setNewProjectError(''); }}
              >
                Project
              </button>
            </div>

            {newModalTab === 'tab' ? (
              <>
                <div className="iso-modal-field" style={{ marginBottom: '24px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--iso-text)' }}>Diagram type</label>
                  <select
                    className="iso-select"
                    value={newDiagramKind}
                    onChange={e => setNewDiagramKind(e.target.value as DiagramKind)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        executeNewDiagram(newDiagramKind);
                      }
                    }}
                  >
                    {DIAGRAM_KINDS.filter(k => k !== 'all').map(k => (
                      <option key={k} value={k}>{`${k.charAt(0).toUpperCase() + k.slice(1)} ${t('welcome.diagram')}`}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="iso-btn" onClick={() => { setIsNewModalOpen(false); setIsSavingFlow(false); }}>{t('ui.cancel')}</button>
                  <button className="iso-btn iso-btn--primary" onClick={() => executeNewDiagram(newDiagramKind)}>{t('ui.create')}</button>
                </div>
              </>
            ) : (
              <>
                <div className="iso-modal-field" style={{ marginBottom: '24px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--iso-text)' }}>Project name</label>
                  <input
                    type="text"
                    className="iso-input"
                    value={newProjectName}
                    onChange={e => { setNewProjectName(e.target.value); setNewProjectError(''); }}
                    placeholder="Q3 System architecture..."
                    autoFocus
                    style={{ borderColor: newProjectError ? 'var(--iso-danger)' : undefined }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCreateProjectSubmit();
                      }
                    }}
                  />
                  {newProjectError && <div style={{ color: 'var(--iso-danger)', fontSize: '12px', marginTop: '6px' }}>{newProjectError}</div>}
                  {!user && <div style={{ color: 'var(--iso-text)', fontSize: '12px', marginTop: '6px' }}>You must be logged in to create projects</div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="iso-btn" onClick={() => { setIsNewModalOpen(false); setIsSavingFlow(false); }}>{t('ui.cancel')}</button>
                  <button
                    className="iso-btn iso-btn--primary"
                    disabled={!user || !newProjectName.trim() || isCreatingProject}
                    onClick={handleCreateProjectSubmit}
                  >
                    {isCreatingProject ? 'Creating...' : t('ui.create')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tabToClose && (
        <div className="iso-modal-overlay" onClick={() => setTabToClose(null)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h2 className="iso-modal-title">{t('dialog.close_title')}</h2>
            <p className="iso-modal-desc">{t('dialog.close_desc', { name: tabs.find(t => t.id === tabToClose)?.name ?? '' })}</p>
            <div className="iso-modal-actions">
              <button className="iso-modal-btn cancel" onClick={() => setTabToClose(null)}>{t('ui.cancel')}</button>
              <button className="iso-modal-btn danger" onClick={() => {
                setTabs(prev => {
                  const next = prev.filter(t => t.id !== tabToClose);
                  if (activeTabId === tabToClose) setActiveTabId(next[Math.max(0, next.length - 1)]?.id ?? '');
                  return next;
                });
                setTabToClose(null);
              }}>{t('ui.close')}</button>
            </div>
          </div>
        </div>
      )}

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
