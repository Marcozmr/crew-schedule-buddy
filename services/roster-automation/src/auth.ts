import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export async function getUserIdFromJwt(authorization: string | undefined): Promise<string | null> {
  if (!authorization?.startsWith('Bearer ')) return null;
  const jwt = authorization.slice(7).trim();
  if (!jwt) return null;
  const supabase = createClient(config.supabaseUrl(), config.supabaseAnonKey());
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user.id;
}
