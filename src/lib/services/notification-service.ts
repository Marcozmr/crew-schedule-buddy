import { supabase } from '@/integrations/supabase/client';

export type NotificationType =
  | 'duty_reminder'
  | 'report_reminder'
  | 'schedule_change'
  | 'import_success'
  | 'operational_warn'
  | 'rest_reminder'
  | 'weekly_summary'
  | 'info'
  | 'system';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
}

export const NotificationService = {
  async create(input: CreateNotificationInput) {
    const { error } = await supabase.from('notifications').insert({
      user_id: input.userId,
      title: input.title,
      message: input.message,
      type: input.type,
    });
    if (error) console.error('[NotificationService] create error:', error.message);
    return !error;
  },

  async createBatch(inputs: CreateNotificationInput[]) {
    if (inputs.length === 0) return true;
    const { error } = await supabase.from('notifications').insert(
      inputs.map((input) => ({ user_id: input.userId, title: input.title, message: input.message, type: input.type })),
    );
    if (error) console.error('[NotificationService] batch create error:', error.message);
    return !error;
  },

  async ensureRecent(input: CreateNotificationInput, hoursWindow = 6) {
    const since = new Date(Date.now() - hoursWindow * 3600000).toISOString();
    const { data, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', input.userId)
      .eq('type', input.type)
      .eq('title', input.title)
      .gte('created_at', since)
      .limit(1);

    if (error) {
      console.error('[NotificationService] ensureRecent lookup error:', error.message);
      return false;
    }

    if ((data?.length ?? 0) > 0) return true;
    return this.create(input);
  },

  async markAsRead(notificationId: string) {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
    return !error;
  },

  async markAllRead(userId: string) {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    return !error;
  },

  async deleteOne(notificationId: string) {
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
    return !error;
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false);
    return count ?? 0;
  },

  async getRecent(userId: string, limit = 50) {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data ?? [];
  },

  async notifyImportSuccess(userId: string, rosterName: string, count: number) {
    return this.ensureRecent({
      userId,
      title: 'Escala importada com sucesso',
      message: `${rosterName}: ${count} atividades carregadas.`,
      type: 'import_success',
    }, 12);
  },

  async notifyScheduleChange(userId: string) {
    return this.ensureRecent({
      userId,
      title: 'Escala atualizada',
      message: 'Sua escala foi atualizada. Confira as alterações.',
      type: 'schedule_change',
    }, 6);
  },

  async notifyDutyReminder(userId: string, date: string, time: string, flightNumber: string) {
    return this.ensureRecent({
      userId,
      title: 'Próxima jornada',
      message: `Sua jornada de ${date} começa às ${time} (${flightNumber}).`,
      type: 'duty_reminder',
    }, 8);
  },

  async notifyReportReminder(userId: string, time: string) {
    return this.ensureRecent({
      userId,
      title: 'Apresentação próxima',
      message: `Apresentação em ${time}.`,
      type: 'report_reminder',
    }, 4);
  },

  async notifyOperationalWarning(userId: string, message: string) {
    return this.ensureRecent({
      userId,
      title: 'Alerta operacional',
      message,
      type: 'operational_warn',
    }, 8);
  },

  async notifyRestReminder(userId: string, message: string) {
    return this.ensureRecent({
      userId,
      title: 'Descanso insuficiente',
      message,
      type: 'rest_reminder',
    }, 8);
  },
};
