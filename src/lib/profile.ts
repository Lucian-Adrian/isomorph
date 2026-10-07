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

export async function isUsernameAvailable(username: string, currentUserId?: string): Promise<boolean> {
  const clean = username.trim().toLowerCase();
  if (!clean) return false;
  let query = supabase.from('profiles').select('id').ilike('username', clean);
  if (currentUserId) {
    query = query.neq('id', currentUserId);
  }
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('Error checking username uniqueness:', error);
    return true;
  }
  return !data;
}

export async function ensureProfile(user: { id: string; email?: string; user_metadata?: any }): Promise<Profile | null> {
  // Check if profile exists
  const { data: existing, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) {
    return existing as Profile;
  }

  // Network/auth failure: do not overwrite
  if (error) {
    console.error('Error checking existing profile:', error);
    return null;
  }

  // Genuinely missing profile in database: initialize new default record
  const defaultBase = user.email?.split('@')[0] || `user_${user.id.slice(0, 5)}`;
  const available = await isUsernameAvailable(defaultBase, user.id);
  const finalUsername = available ? defaultBase : `${defaultBase}_${Math.floor(Math.random() * 1000)}`;

  const newProfile = {
    id: user.id,
    username: finalUsername,
    full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    avatar_url: user.user_metadata?.avatar_url || null,
    tier: 'basic' as const,
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert([newProfile])
    .select('*')
    .single();

  if (insertError) {
    console.error('Error inserting initial profile:', insertError);
    return null;
  }

  return inserted as Profile;
}

export async function updateProfile(userId: string, updates: Partial<Omit<Profile, 'id' | 'tier'>>): Promise<boolean> {
  if (updates.username) {
    const available = await isUsernameAvailable(updates.username, userId);
    if (!available) {
      throw new Error('Username is already taken');
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);

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
