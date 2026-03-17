/**
 * Support Service — abstraction layer for support form submission.
 *
 * Backend: Supabase Edge Function (send-support-email).
 * Persistence is the source of truth — stored first, email is best-effort.
 * Uses Resend API for email delivery (requires RESEND_API_KEY secret).
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
  emailSent: boolean;
  error?: string;
}

/**
 * Submit a support message.
 * Returns detailed status: stored + emailSent independently.
 */
export async function submitSupport(payload: SupportPayload): Promise<SupportResult> {
  const { data, error } = await supabase.functions.invoke('send-support-email', {
    body: payload,
  });

  // Network-level failure
  if (error) {
    console.error('[support-service] invoke error:', error.message);
    return { success: false, stored: false, emailSent: false, error: 'Serviço indisponível. Tente novamente.' };
  }

  const stored = !!data?.stored;
  const sent = !!data?.sent;

  if (stored && sent) {
    return { success: true, stored: true, emailSent: true };
  }

  if (stored && !sent) {
    console.warn('[support-service] Stored but email failed:', data?.error);
    return {
      success: true,
      stored: true,
      emailSent: false,
      error: data?.error || 'Mensagem salva, mas o e-mail não foi enviado.',
    };
  }

  return {
    success: false,
    stored: false,
    emailSent: false,
    error: data?.error || 'Não foi possível enviar sua mensagem. Tente novamente.',
  };
}
