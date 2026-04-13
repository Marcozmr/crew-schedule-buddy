import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';

let admin: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!admin) {
    admin = createClient(config.supabaseUrl(), config.supabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export type AutomationStatusRow =
  | 'disconnected'
  | 'portal_connecting'
  | 'portal_connected'
  | 'iflight_detected'
  | 'roster_downloading'
  | 'roster_importing'
  | 'roster_connected'
  | 'reconnect_required'
  | 'error';
