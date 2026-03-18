import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { NotificationService } from '@/lib/services/notification-service';
import { Bell, AlertTriangle, Ban, Clock, Check, Trash2, Upload, Calendar, Info, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

type FilterType = 'all' | 'unread' | 'operational' | 'system';

const typeConfig: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
  duty_reminder: { icon: <Calendar className="w-4 h-4" />, bg: 'bg-primary/10', text: 'text-primary' },
  report_reminder: { icon: <Clock className="w-4 h-4" />, bg: 'bg-primary/10', text: 'text-primary' },
  schedule_change: { icon: <AlertTriangle className="w-4 h-4" />, bg: 'bg-accent/10', text: 'text-accent-foreground' },
  import_success: { icon: <Upload className="w-4 h-4" />, bg: 'bg-primary/10', text: 'text-primary' },
  operational_warn: { icon: <AlertTriangle className="w-4 h-4" />, bg: 'bg-yellow-500/10', text: 'text-yellow-600' },
  rest_reminder: { icon: <Clock className="w-4 h-4" />, bg: 'bg-primary/10', text: 'text-primary' },
  weekly_summary: { icon: <Calendar className="w-4 h-4" />, bg: 'bg-primary/10', text: 'text-primary' },
  cancelled: { icon: <Ban className="w-4 h-4" />, bg: 'bg-destructive/10', text: 'text-destructive' },
  info: { icon: <Info className="w-4 h-4" />, bg: 'bg-primary/10', text: 'text-primary' },
  system: { icon: <Bell className="w-4 h-4" />, bg: 'bg-muted', text: 'text-muted-foreground' },
};

const OPERATIONAL_TYPES = new Set(['duty_reminder', 'report_reminder', 'schedule_change', 'operational_warn', 'rest_reminder', 'import_success']);
const SYSTEM_TYPES = new Set(['system', 'info', 'weekly_summary']);

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
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const newNotif = payload.new as Notification;
        setNotifications(prev => [newNotif, ...prev]);
        toast.info(newNotif.title, { description: newNotif.message });
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

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'unread', label: 'Não lidas' },
    { key: 'operational', label: 'Operacionais' },
    { key: 'system', label: 'Sistema' },
  ];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Alertas</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Tudo em dia'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <Check className="w-4 h-4 mr-1" /> Marcar todas
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-xl p-12 text-center shadow-card">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{filter === 'all' ? 'Nenhuma notificação' : 'Nenhuma notificação nesta categoria'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((notif, i) => {
              const config = typeConfig[notif.type] || typeConfig.info;
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={`bg-card rounded-xl p-4 shadow-card flex items-start gap-3 ${!notif.read ? 'border-l-4 border-primary' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}>
                    <span className={config.text}>{config.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${!notif.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {notif.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {new Date(notif.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!notif.read && (
                      <button onClick={() => markAsRead(notif.id)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Marcar como lida">
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => deleteNotification(notif.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
