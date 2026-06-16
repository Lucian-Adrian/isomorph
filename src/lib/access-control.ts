import { supabase } from './supabase.js';

export interface ProjectAccess {
  id: string;
  project_id: string;
  diagram_id: string | null;
  user_id: string;
  role: 'editor' | 'commenter' | 'viewer';
  granted_by: string | null;
  granted_at: string;
  profile?: {
    full_name: string;
    username: string;
    avatar_url: string;
  };
}

export async function getProjectAccess(projectId: string): Promise<ProjectAccess[]> {
  const { data, error } = await supabase
    .from('project_access')
    .select(`
      *,
      profile:profiles(full_name, username, avatar_url)
    `)
    .eq('project_id', projectId);

  if (error) {
    console.error('Error fetching project access:', error);
    return [];
  }
  return data as any as ProjectAccess[];
}

export async function grantAccess(projectId: string, emailOrUsername: string, role: string, diagramId: string | null = null): Promise<boolean> {
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', emailOrUsername)
    .limit(1);

  if (profileError || !profiles || profiles.length === 0) {
    console.error('User not found:', profileError);
    return false;
  }

  const userId = profiles[0].id;

  // Since we dropped the unique constraint, check if exists first
  let query = supabase.from('project_access').select('id').eq('project_id', projectId).eq('user_id', userId);
  if (diagramId) {
    query = query.eq('diagram_id', diagramId);
  } else {
    query = query.is('diagram_id', null);
  }

  const { data: existing } = await query;

  let error;
  if (existing && existing.length > 0) {
    const res = await supabase.from('project_access').update({ role }).eq('id', existing[0].id);
    error = res.error;
  } else {
    const res = await supabase.from('project_access').insert({
      project_id: projectId,
      user_id: userId,
      diagram_id: diagramId,
      role
    });
    error = res.error;
  }

  if (error) {
    console.error('Error granting access:', error);
    return false;
  }
  return true;
}

export async function revokeAccess(projectId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('project_access')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error revoking access:', error);
    return false;
  }
  return true;
}
