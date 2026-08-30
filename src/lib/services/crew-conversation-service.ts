import { supabase } from '@/integrations/supabase/client';

export interface CrewConversationSummary {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAirline: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  flightsTogetherCount: number;
}

export interface CrewMessage {
  id: string;
  conversationId: string;
  senderId: string;
  message: string;
  createdAt: string;
}

/**
 * Colegas de voo — chat automático entre usuários que já voaram juntos mais de uma vez.
 * Conversas são criadas só pelo trigger `detect_crew_connections` (banco); aqui só listamos/lemos/enviamos.
 */
export const CrewConversationService = {
  async listConversations(userId: string): Promise<CrewConversationSummary[]> {
    const { data: conversations, error } = await supabase
      .from('crew_conversations')
      .select('id, user_a_id, user_b_id, last_message_at')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error || !conversations || conversations.length === 0) {
      if (error) console.error('[CrewConversationService] listConversations error:', error.message);
      return [];
    }

    const partnerIds = conversations.map((c) => (c.user_a_id === userId ? c.user_b_id : c.user_a_id));

    const [{ data: profiles }, previews, counts] = await Promise.all([
      supabase.from('profiles').select('user_id, name, airline').in('user_id', partnerIds),
      Promise.all(
        conversations.map((c) =>
          supabase
            .from('crew_conversation_messages')
            .select('message')
            .eq('conversation_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ),
      ),
      Promise.all(
        conversations.map((c) =>
          supabase
            .from('crew_flight_connections')
            .select('id', { count: 'exact', head: true })
            .eq('user_a_id', c.user_a_id)
            .eq('user_b_id', c.user_b_id),
        ),
      ),
    ]);

    const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    return conversations.map((c, i) => {
      const partnerId = c.user_a_id === userId ? c.user_b_id : c.user_a_id;
      const profile = profileByUserId.get(partnerId);
      return {
        id: c.id,
        partnerId,
        partnerName: profile?.name?.trim() || 'Colega de voo',
        partnerAirline: profile?.airline?.trim() || null,
        lastMessageAt: c.last_message_at,
        lastMessagePreview: previews[i]?.data?.message ?? null,
        flightsTogetherCount: counts[i]?.count ?? 0,
      };
    });
  },

  async getMessages(conversationId: string): Promise<CrewMessage[]> {
    const { data, error } = await supabase
      .from('crew_conversation_messages')
      .select('id, conversation_id, sender_id, message, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[CrewConversationService] getMessages error:', error.message);
      return [];
    }

    return (data ?? []).map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      message: m.message,
      createdAt: m.created_at,
    }));
  },

  async sendMessage(conversationId: string, senderId: string, message: string): Promise<boolean> {
    const trimmed = message.trim();
    if (!trimmed) return false;

    const { error } = await supabase.from('crew_conversation_messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message: trimmed.slice(0, 2000),
    });

    if (error) console.error('[CrewConversationService] sendMessage error:', error.message);
    return !error;
  },

  async getConversation(conversationId: string, userId: string): Promise<CrewConversationSummary | null> {
    const { data: c, error } = await supabase
      .from('crew_conversations')
      .select('id, user_a_id, user_b_id, last_message_at')
      .eq('id', conversationId)
      .maybeSingle();

    if (error || !c) return null;

    const partnerId = c.user_a_id === userId ? c.user_b_id : c.user_a_id;
    const [{ data: profile }, { count }] = await Promise.all([
      supabase.from('profiles').select('name, airline').eq('user_id', partnerId).maybeSingle(),
      supabase
        .from('crew_flight_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_a_id', c.user_a_id)
        .eq('user_b_id', c.user_b_id),
    ]);

    return {
      id: c.id,
      partnerId,
      partnerName: profile?.name?.trim() || 'Colega de voo',
      partnerAirline: profile?.airline?.trim() || null,
      lastMessageAt: c.last_message_at,
      lastMessagePreview: null,
      flightsTogetherCount: count ?? 0,
    };
  },
};
