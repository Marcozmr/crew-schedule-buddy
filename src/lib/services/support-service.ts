/**
 * Support Service — abstraction layer for support form submission.
 *
 * Current implementation: Supabase Edge Function (send-support-email).
 * The edge function persists to `feedback_messages` first, then attempts
 * email delivery.  Persistence is the source of truth — if the message is
 * saved, we treat it as success even when email delivery fails.
 *
 * To swap providers later (Resend, SMTP, etc.), replace the `submitSupport`
 * implementation without touching UI components.
 */

import { supabase } from '@/integrations/supabase/client';

export interface SupportPayload {
  name: string;
  email: string;
  type: 'suggestion' | 'bug' | 'contact';
  subject: string;
  message: string;
  route: string;
}

export interface SupportResult {
  success: boolean;
  stored: boolean;
  error?: string;
}

/**
 * Submit a support message.
 * Returns `{ success: true }` when the message was persisted (email is best-effort).
 */
export async function submitSupport(payload: SupportPayload): Promise<SupportResult> {
  const { data, error } = await supabase.functions.invoke('send-support-email', {
    body: payload,
  });

  // Network-level failure (edge function unreachable)
  if (error) {
    console.error('[support-service] invoke error', error.message);
    return { success: false, stored: false, error: 'Serviço indisponível. Tente novamente.' };
  }

  // Edge function returned a response — check if message was stored
  if (data?.stored) {
    // Message persisted in DB.  Email may or may not have been sent.
    return { success: true, stored: true };
  }

  // Neither stored nor sent
  return {
    success: false,
    stored: false,
    error: data?.error || 'Não foi possível enviar sua mensagem. Tente novamente.',
  };
}
