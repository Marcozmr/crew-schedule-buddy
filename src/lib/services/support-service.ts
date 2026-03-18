/**
 * Support Service — abstraction layer for support form submission.
 *
 * Backend: Lovable Cloud function (send-support-email).
 * A mensagem é persistida primeiro e o envio por e-mail só é considerado sucesso quando o SMTP aceita a entrega.
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
  technicalError?: string;
}

export async function submitSupport(payload: SupportPayload): Promise<SupportResult> {
  const { data, error } = await supabase.functions.invoke('send-support-email', {
    body: payload,
  });

  if (error) {
    console.error('[support-service] invoke error:', error.message);
    return {
      success: false,
      stored: false,
      emailSent: false,
      error: 'Serviço indisponível. Tente novamente.',
      technicalError: error.message,
    };
  }

  const stored = !!data?.stored;
  const sent = !!data?.sent;
  const technicalError = data?.technicalError || undefined;

  if (stored && sent) {
    return { success: true, stored: true, emailSent: true };
  }

  if (stored && !sent) {
    console.warn('[support-service] email delivery failed:', technicalError || data?.error);
    return {
      success: false,
      stored: true,
      emailSent: false,
      error: data?.error || 'Mensagem registrada, mas o e-mail não foi entregue.',
      technicalError,
    };
  }

  return {
    success: false,
    stored: false,
    emailSent: false,
    error: data?.error || 'Não foi possível enviar sua mensagem. Tente novamente.',
    technicalError,
  };
}
