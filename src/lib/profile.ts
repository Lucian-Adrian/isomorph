import { supabase } from './supabase.js';

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  updated_at: string | null;
  tier: 'basic' | 'power' | 'enterprise';
  settings?: any;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching profile:', error);
    return null;
  }
  return data as Profile;
}

export async function updateProfile(userId: string, updates: Partial<Omit<Profile, 'id' | 'tier'>>): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() });

  if (error) {
    console.error('Error updating profile:', error);
    return false;
  }
  return true;
}

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/avatar-${Math.random()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error('Error uploading avatar:', uploadError);
    return null;
  }

  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  await updateProfile(userId, { avatar_url: data.publicUrl });
  
  return data.publicUrl;
}
