import { supabase } from './supabase.js';
import { getProfile } from './profile.js';

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
    return null;
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
    return null;
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
