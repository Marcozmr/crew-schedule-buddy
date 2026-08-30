import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Plane } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import {
  CrewConversationService,
  type CrewConversationSummary,
  type CrewMessage,
} from '@/lib/services/crew-conversation-service';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDateTimeBR } from '@/lib/date-utils';

export default function CrewChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [conversation, setConversation] = useState<CrewConversationSummary | null>(null);
  const [messages, setMessages] = useState<CrewMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    if (!conversationId || !user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [conv, msgs] = await Promise.all([
        CrewConversationService.getConversation(conversationId, user.id),
        CrewConversationService.getMessages(conversationId),
      ]);
      if (cancelled) return;
      setConversation(conv);
      setMessages(msgs);
      setLoading(false);
      requestAnimationFrame(() => scrollToBottom(false));
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, user, scrollToBottom]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`crew-chat-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crew_conversation_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { id: string; conversation_id: string; sender_id: string; message: string; created_at: string };
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [
            ...prev,
            { id: row.id, conversationId: row.conversation_id, senderId: row.sender_id, message: row.message, createdAt: row.created_at },
          ]));
          requestAnimationFrame(() => scrollToBottom(true));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, scrollToBottom]);

  const handleSend = async () => {
    if (!conversationId || !user || sending) return;
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    setDraft('');
    const ok = await CrewConversationService.sendMessage(conversationId, user.id, text);
    setSending(false);
    if (!ok) {
      setDraft(text);
      return;
    }
    requestAnimationFrame(() => scrollToBottom(true));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate('/connections')} className="p-1 text-foreground shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="bg-primary/15 text-primary text-sm font-bold">
            {(conversation?.partnerName || 'C').charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {conversation?.partnerName ?? 'Colega de voo'}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {conversation
              ? `${conversation.flightsTogetherCount} voo${conversation.flightsTogetherCount === 1 ? '' : 's'} juntos${conversation.partnerAirline ? ` · ${conversation.partnerAirline}` : ''}`
              : 'Carregando…'}
          </p>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-7 w-7 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Plane className="h-6 w-6 text-primary" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-medium text-foreground">Vocês vão voar juntos de novo</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Mande uma mensagem pra combinar algo com {conversation?.partnerName ?? 'seu colega'}.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-secondary text-foreground rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  <p className={`mt-1 text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {formatDateTimeBR(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Entrada */}
      <div className="flex items-end gap-2 border-t border-border p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva uma mensagem…"
          rows={1}
          className="max-h-32 min-h-[42px] flex-1 resize-none"
        />
        <Button size="icon" onClick={() => void handleSend()} disabled={sending || !draft.trim()} className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
