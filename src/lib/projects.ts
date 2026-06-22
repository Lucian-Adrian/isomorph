import { supabase } from './supabase.js';
import { getProfile } from './profile.js';
import { logAudit } from './audit.js';

export interface Project {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  settings?: {
    is_favorite?: boolean;
    category?: string | null;
  };
}

export interface Diagram {
  id: string;
  project_id: string;
  name: string;
  content: any; // jsonb
  kind: string;
  created_at: string;
  updated_at: string;
}

export interface DiagramHistory {
  id: string;
  diagram_id: string;
  user_id: string | null;
  content: any;
  created_at: string;
}


const TIER_LIMITS = {
  basic: { projects: 5, diagramsPerProject: 4, editors: 2, saves: 10 },
  power: { projects: 25, diagramsPerProject: 20, editors: 4, saves: 50 },
  enterprise: { projects: 100, diagramsPerProject: 100, editors: 8, saves: 999999 },
};

export async function checkProjectLimit(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  const tier = profile?.tier || 'basic';
  const limit = TIER_LIMITS[tier].projects;

  const { count, error } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId);

  if (error || count === null) return false;
  return count < limit;
}

export async function checkDiagramLimit(userId: string, projectId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  const tier = profile?.tier || 'basic';
  const limit = TIER_LIMITS[tier].diagramsPerProject;

  const { count, error } = await supabase
    .from('diagrams')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  if (error || count === null) return false;
  return count < limit;
}

export async function createProject(userId: string, name: string): Promise<Project | null> {
  const canCreate = await checkProjectLimit(userId);
  if (!canCreate) {
    throw new Error('Project limit reached for your tier.');
  }

  const { data, error } = await supabase
    .from('projects')
    .insert([{ owner_id: userId, name }])
    .select()
    .single();

  if (error) {
    console.error('Error creating project:', error);
    throw new Error(error.message || 'Failed to create project');
  }
  if (data) {
    await logAudit('project_created', 'project', data.id, { name });
  }
  return data;
}

export async function updateProject(userId: string, projectId: string, updates: Partial<Project>): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .eq('owner_id', userId);

  if (error) {
    console.error('Error updating project:', error);
    return false;
  }
  return true;
}

export async function createDiagram(userId: string, projectId: string, name: string, kind: string, content: any): Promise<Diagram | null> {
  const canCreate = await checkDiagramLimit(userId, projectId);
  if (!canCreate) {
    throw new Error('Diagram limit reached for this project under your tier.');
  }

  const { data, error } = await supabase
    .from('diagrams')
    .insert([{ project_id: projectId, name, kind, content }])
    .select()
    .single();

  if (error) {
    console.error('Error creating diagram:', error);
    throw new Error(error.message || 'Failed to create diagram');
  }
  return data;
}

export async function getProjects(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
  return data;
}

export async function getSharedProjects(userId: string): Promise<Array<Project & { role: string }>> {
  const { data, error } = await supabase
    .from('project_access')
    .select(`
      role,
      diagram_id,
      project:projects(*)
    `)
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching shared projects:', error);
    return [];
  }

  const projectsMap = new Map<string, Project & { role: string }>();

  (data || []).forEach((item: any) => {
    if (!item.project) return;
    const projId = item.project.id;
    const existing = projectsMap.get(projId);

    if (!existing || item.diagram_id === null) {
      projectsMap.set(projId, {
        ...item.project,
        role: item.role
      });
    }
  });

  return Array.from(projectsMap.values())
    .filter((p: any): p is Project & { role: string } => p !== null && p.owner_id !== userId);
}

export async function getPublicProjectIds(): Promise<Set<string>> {
  const { data: links } = await supabase.from('share_links').select('project_id');
  const { data: access } = await supabase.from('project_access').select('project_id');
  
  const publicIds = new Set<string>();
  links?.forEach(l => publicIds.add(l.project_id));
  access?.forEach(a => publicIds.add(a.project_id));
  return publicIds;
}

export async function getDiagrams(projectId: string): Promise<Diagram[]> {
  const { data, error } = await supabase
    .from('diagrams')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching diagrams:', error);
    return [];
  }
  return data;
}


export async function getDiagramHistory(diagramId: string): Promise<DiagramHistory[]> {
  const { data, error } = await supabase
    .from('diagram_history')
    .select('*')
    .eq('diagram_id', diagramId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching diagram history:', error);
    return [];
  }
  return data;
}

export async function deleteDiagramHistoryAfter(diagramId: string, timestamp: string): Promise<boolean> {
  const { error } = await supabase
    .from('diagram_history')
    .delete()
    .eq('diagram_id', diagramId)
    .gt('created_at', timestamp);

  if (error) {
    console.error('Error deleting newer history:', error);
    return false;
  }
  return true;
}

export async function saveDiagramHistory(diagramId: string, content: any, userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  const tier = profile?.tier || 'basic';
  const limit = TIER_LIMITS[tier].saves;

  const { error: insertError } = await supabase
    .from('diagram_history')
    .insert([{ diagram_id: diagramId, user_id: userId, content }]);

  if (insertError) {
    console.error('Error saving diagram history:', insertError);
    return false;
  }

  // Enforce rolling buffer quota
  const { data: history, error: countError } = await supabase
    .from('diagram_history')
    .select('id')
    .eq('diagram_id', diagramId)
    .order('created_at', { ascending: false });

  if (!countError && history && history.length > limit) {
    const toDelete = history.slice(limit).map(h => h.id);
    await supabase
      .from('diagram_history')
      .delete()
      .in('id', toDelete);
  }

  return true;
}

export async function updateDiagramContent(diagramId: string, content: any): Promise<boolean> {
  // Save checkpointing can be implemented here by checking limit before insert into checkpoints table
  const { error } = await supabase
    .from('diagrams')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', diagramId);

  if (error) {
    console.error('Error updating diagram:', error);
    return false;
  }
  return true;
}

export async function updateDiagram(diagramId: string, updates: Partial<Diagram>): Promise<boolean> {
  const { error } = await supabase
    .from('diagrams')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', diagramId);

  if (error) {
    console.error('Error updating diagram details:', error);
    return false;
  }
  return true;
}

export async function deleteDiagram(diagramId: string): Promise<boolean> {
  const { error } = await supabase
    .from('diagrams')
    .delete()
    .eq('id', diagramId);

  if (error) {
    console.error('Error deleting diagram:', error);
    return false;
  }
  return true;
}

