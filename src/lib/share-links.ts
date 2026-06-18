import { supabase } from './supabase.js';

export interface ShareLink {
  id: string;
  project_id: string;
  diagram_id: string | null;
  token: string;
  role: 'editor' | 'commenter' | 'viewer';
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  is_active: boolean;
  created_at: string;
}

export async function createShareLink(
  projectId: string,
  role: 'editor' | 'commenter' | 'viewer',
  diagramId: string | null = null,
  expiresAt: string | null = null,
  maxUses: number | null = null
): Promise<ShareLink | null> {
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);

  const { data, error } = await supabase
    .from('share_links')
    .insert([{
      project_id: projectId,
      diagram_id: diagramId,
      token,
      role,
      expires_at: expiresAt,
      max_uses: maxUses
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating share link:', error);
    return null;
  }
  return data as ShareLink;
}

export async function getShareLinks(projectId: string): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from('share_links')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching share links:', error);
    return [];
  }
  return data as ShareLink[];
}

export async function deleteShareLink(linkId: string): Promise<boolean> {
  const { error } = await supabase
    .from('share_links')
    .delete()
    .eq('id', linkId);

  if (error) {
    console.error('Error deleting share link:', error);
    return false;
  }
  return true;
}

export async function resolveShareLink(token: string): Promise<{ project_id: string, diagram_id: string | null, role: string, link_id: string } | null> {
  const { data, error } = await supabase
    .from('share_links')
    .select('id, project_id, diagram_id, role, expires_at, max_uses, use_count, is_active')
    .eq('token', token)
    .single();

  if (error || !data) {
    return null;
  }

  if (!data.is_active) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  if (data.max_uses !== null && data.use_count >= data.max_uses) return null;

  // Increment use count
  await supabase
    .from('share_links')
    .update({ use_count: data.use_count + 1 })
    .eq('id', data.id);

  return { project_id: data.project_id, diagram_id: data.diagram_id, role: data.role, link_id: data.id };
}
