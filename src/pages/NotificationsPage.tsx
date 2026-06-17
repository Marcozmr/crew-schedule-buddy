import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { NotificationService } from '@/lib/services/notification-service';
import { Bell, AlertTriangle, Ban, Clock, Check, Trash2, Upload, Calendar, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AppCard, EmptyState } from '@/components/ui/primitives';
import { toast } from 'sonner';

interface Notification {
  id: string; title: string; message: string; type: string; read: boolean; created_at: string;
}
type FilterType = 'all' | 'unread' | 'operational' | 'system';

const typeConfig: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
  duty_reminder:   { icon: <Calendar className="w-4 h-4" />,      bg: 'bg-primary/10',    text: 'text-primary' },
  report_reminder: { icon: <Clock className="w-4 h-4" />,         bg: 'bg-primary/10',    text: 'text-primary' },
  schedule_change: { icon: <AlertTriangle className="w-4 h-4" />, bg: 'bg-amber-500/10',  text: 'text-amber-500' },
  import_success:  { icon: <Upload className="w-4 h-4" />,        bg: 'bg-green-500/10',  text: 'text-green-500' },
  operational_warn:{ icon: <AlertTriangle className="w-4 h-4" />, bg: 'bg-amber-500/10',  text: 'text-amber-500' },
  rest_reminder:   { icon: <Clock className="w-4 h-4" />,         bg: 'bg-primary/10',    text: 'text-primary' },
  weekly_summary:  { icon: <Calendar className="w-4 h-4" />,      bg: 'bg-primary/10',    text: 'text-primary' },
  cancelled:       { icon: <Ban className="w-4 h-4" />,           bg: 'bg-destructive/10','text': 'text-destructive' },
  info:            { icon: <Info className="w-4 h-4" />,           bg: 'bg-primary/10',    text: 'text-primary' },
  system:          { icon: <Bell className="w-4 h-4" />,           bg: 'bg-muted',         text: 'text-muted-foreground' },
};

const OPERATIONAL_TYPES = new Set(['duty_reminder','report_reminder','schedule_change','operational_warn','rest_reminder','import_success']);
const SYSTEM_TYPES = new Set(['system','info','weekly_summary']);

const filters: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'unread', label: 'Não lidas' },
  { key: 'operational', label: 'Operacionais' },
  { key: 'system', label: 'Sistema' },
];

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const loadNotifications = async () => {
    if (!user) return;
    const data = await NotificationService.getRecent(user.id, 100);
    setNotifications(data as Notification[]);
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
    if (!user) return;
    const channel = supabase.channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications(prev => [n, ...prev]);
          toast.info(n.title, { description: n.message });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'unread': return notifications.filter(n => !n.read);
      case 'operational': return notifications.filter(n => OPERATIONAL_TYPES.has(n.type));
      case 'system': return notifications.filter(n => SYSTEM_TYPES.has(n.type));
      default: return notifications;
    }
  }, [notifications, filter]);

  const markAsRead = async (id: string) => {
    await NotificationService.markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await NotificationService.markAllRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success('Todas marcadas como lidas');
  };

  const deleteNotification = async (id: string) => {
    await NotificationService.deleteOne(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Alertas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Tudo em dia'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="h-9 gap-1.5">
              <Check className="w-3.5 h-3.5" /> Marcar todas
            </Button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Nenhuma notificação"
            description={filter === 'all' ? 'Você não tem notificações ainda.' : 'Nenhuma notificação nesta categoria.'}
          />
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence>
              {filtered.map((notif, i) => {
                const cfg = typeConfig[notif.type] || typeConfig.info;
                return (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
                  >
                    <AppCard className={!notif.read ? 'border-l-[3px] border-l-primary' : ''}>
                      <div className="flex items-start gap-4 px-5 py-4">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
                          <span className={cfg.text}>{cfg.icon}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold ${!notif.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {notif.title}
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground">{notif.message}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground/50">
                            {new Date(notif.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {!notif.read && (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                              title="Marcar como lida"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notif.id)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </AppCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
