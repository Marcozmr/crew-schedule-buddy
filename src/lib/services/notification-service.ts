/**
 * Notification Service Layer
 * Centralized notification creation, scheduling, and management.
 * Decoupled from UI — can be called from any context.
 */
import { supabase } from '@/integrations/supabase/client';

export type NotificationType =
  | 'duty_reminder'    // Próxima jornada
  | 'report_reminder'  // Apresentação próxima
  | 'schedule_change'  // Alteração de escala
  | 'import_success'   // Novo período importado
  | 'operational_warn' // Atenção operacional
  | 'rest_reminder'    // Lembrete de repouso
  | 'weekly_summary'   // Resumo semanal
  | 'info'             // Geral
  | 'system';          // Sistema

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
      inputs.map(i => ({ user_id: i.userId, title: i.title, message: i.message, type: i.type }))
    );
    if (error) console.error('[NotificationService] batch create error:', error.message);
    return !error;
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

  // Schedule-based notification helpers
  async notifyImportSuccess(userId: string, rosterName: string, count: number) {
    return this.create({
      userId,
      title: 'Escala importada com sucesso',
      message: `${rosterName}: ${count} atividades carregadas.`,
      type: 'import_success',
    });
  },

  async notifyScheduleChange(userId: string) {
    return this.create({
      userId,
      title: 'Escala atualizada',
      message: 'Sua escala foi atualizada. Confira as alterações.',
      type: 'schedule_change',
    });
  },

  async notifyDutyReminder(userId: string, date: string, time: string, flightNumber: string) {
    return this.create({
      userId,
      title: 'Próxima jornada',
      message: `Sua jornada de ${date} começa às ${time} (${flightNumber}).`,
      type: 'duty_reminder',
    });
  },

  async notifyReportReminder(userId: string, time: string) {
    return this.create({
      userId,
      title: 'Apresentação próxima',
      message: `Apresentação em ${time}.`,
      type: 'report_reminder',
    });
  },
};
