import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Bell, AlertTriangle, Ban, Clock, Check, Trash2 } from 'lucide-react';
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

const typeConfig: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
  cancelled: { icon: <Ban className="w-4 h-4" />, bg: 'bg-destructive/10', text: 'text-destructive' },
  diverted: { icon: <AlertTriangle className="w-4 h-4" />, bg: 'bg-accent/10', text: 'text-accent' },
  fatigue: { icon: <Clock className="w-4 h-4" />, bg: 'bg-accent/10', text: 'text-accent' },
  info: { icon: <Bell className="w-4 h-4" />, bg: 'bg-primary/10', text: 'text-primary' },
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();

    // Realtime subscription
    if (!user) return;
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const newNotif = payload.new as Notification;
        setNotifications(prev => [newNotif, ...prev]);
        toast.info(newNotif.title, { description: newNotif.message });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success('Todas marcadas como lidas');
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Tudo em dia'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <Check className="w-4 h-4 mr-1" /> Marcar todas como lidas
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-card rounded-xl p-12 text-center shadow-card">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma notificação</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif, i) => {
              const config = typeConfig[notif.type] || typeConfig.info;
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
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
