// ============================================================
// Isomorph — Share Link Custom Hook
// ============================================================
// Handles url share link detection, redemption, and anonymous login state.
// Extracted from App.tsx during demonolith decomposition.
// ============================================================

import { useState, useEffect } from 'react';
import type { Project } from '../lib/projects.js';

interface UseShareLinkOptions {
  user: any;
  loading: boolean;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  openWholeProject: (diagrams: any[], projectId: string, role: string) => void;
  addToast: (message: string, type?: 'success' | 'info') => void;
}

export function useShareLink({
  user,
  loading,
  setProjects,
  openWholeProject,
  addToast,
}: UseShareLinkOptions) {
  const [isAnonymousLoginOpen, setIsAnonymousLoginOpen] = useState(false);
  const [anonymousName, setAnonymousName] = useState<string | null>(() =>
    localStorage.getItem('isomorph-anon-name')
  );
  const [pendingShareToken, setPendingShareToken] = useState<string | null>(null);
  const [urlShareToken, setUrlShareToken] = useState<string | null>(null);
  const [isJoiningShare, setIsJoiningShare] = useState(false);

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
    const { supabase } = await import('../lib/supabase.js');
    if (user) {
      // Logged in: redeem via RPC
      const { data: success, error } = await supabase.rpc('redeem_share_link', { p_token: token });
      if (success && !error) {
        addToast('Project access granted!', 'success');
        // Let's fetch the project and open it
        const { data: projData } = await supabase.rpc('get_shared_project_data', { p_token: token });
        if (projData && projData.project && projData.diagrams) {
          // Log audit: share link redeemed
          const { logAudit } = await import('../lib/audit.js');
          await logAudit('share_link_redeemed', 'share_link', undefined, { token, projectId: projData.project.id });

          // Add project to projects list so its name resolves in the breadcrumbs
          setProjects((prev) => {
            if (!prev.some((p) => p.id === projData.project.id)) {
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
        const { logAudit } = await import('../lib/audit.js');
        await logAudit('share_link_redeemed', 'share_link', undefined, { token, projectId: projData.project.id, anonymous: true });

        if (anonName) {
          setAnonymousName(anonName);
          localStorage.setItem('isomorph-anon-name', anonName);
        }
        setIsAnonymousLoginOpen(false);
        addToast(`Joined project ${projData.project.name} anonymously`);
        // Add project to projects list so its name resolves in the breadcrumbs
        setProjects((prev) => {
          if (!prev.some((p) => p.id === projData.project.id)) {
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

  return {
    isAnonymousLoginOpen,
    setIsAnonymousLoginOpen,
    anonymousName,
    setAnonymousName,
    pendingShareToken,
    setPendingShareToken,
    isJoiningShare,
    handleRedeemShareLink,
  };
}
