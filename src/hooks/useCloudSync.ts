// ============================================================
// Isomorph — Cloud Sync State Hook
// ============================================================
// Manages project loading, saving status, custom categories,
// project history lists, and Supabase database synchronization.
// Extracted from App.tsx during demonolith decomposition.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { Project, DiagramHistory } from '../lib/projects.js';
import { getProjects, getSharedProjects, getPublicProjectIds } from '../lib/projects.js';

export function useCloudSync(user: any) {
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
  const [libraryCategory, setLibraryCategory] = useState<string>('All projects');
  const [customCategories, setCustomCategories] = useState<string[]>(['Favorites', 'Work', 'Personal']);
  const [newCategoryPrompt, setNewCategoryPrompt] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [diagramHistoryList, setDiagramHistoryList] = useState<DiagramHistory[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [isRevertModalOpen, setIsRevertModalOpen] = useState(false);

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

  return {
    projects,
    setProjects,
    sharedProjects,
    setSharedProjects,
    publicProjectIds,
    setPublicProjectIds,
    isCreatingProject,
    setIsCreatingProject,
    librarySearchQuery,
    setLibrarySearchQuery,
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
    libraryVisibilityFilter,
    setLibraryVisibilityFilter,
    librarySort,
    setLibrarySort,
    libraryCategory,
    setLibraryCategory,
    customCategories,
    setCustomCategories,
    newCategoryPrompt,
    setNewCategoryPrompt,
    newCategoryName,
    setNewCategoryName,
    isHistoryOpen,
    setIsHistoryOpen,
    diagramHistoryList,
    setDiagramHistoryList,
    selectedHistoryId,
    setSelectedHistoryId,
    isRevertModalOpen,
    setIsRevertModalOpen,
    refreshPublicProjects
  };
}
