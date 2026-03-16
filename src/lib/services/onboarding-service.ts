/**
 * Onboarding Service Layer
 * Manages onboarding state persistence and profile setup.
 */
import { supabase } from '@/integrations/supabase/client';

export const ONBOARDING_STEPS = [
  'welcome',
  'profile',
  'preferences',
  'import',
  'notifications',
  'complete',
] as const;

export type OnboardingStep = typeof ONBOARDING_STEPS[number];

export const OnboardingService = {
  async getProgress(userId: string): Promise<{ step: number; completed: boolean }> {
    const { data } = await supabase
      .from('profiles')
      .select('onboarding_step, onboarding_completed')
      .eq('user_id', userId)
      .maybeSingle();
    return {
      step: data?.onboarding_step ?? 0,
      completed: data?.onboarding_completed ?? false,
    };
  },

  async saveStep(userId: string, step: number) {
    await supabase
      .from('profiles')
      .update({ onboarding_step: step })
      .eq('user_id', userId);
  },

  async completeOnboarding(userId: string) {
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true, onboarding_step: ONBOARDING_STEPS.length - 1 })
      .eq('user_id', userId);
  },

  async saveProfile(userId: string, data: {
    name: string;
    airline: string;
    crewRole: string;
    baseAirport: string;
    registration?: string;
  }) {
    // Update profiles table
    await supabase.from('profiles').update({
      name: data.name,
      airline: data.airline,
      registration: data.registration || null,
    }).eq('user_id', userId);

    // Upsert user_settings
    await supabase.from('user_settings').upsert({
      user_id: userId,
      crew_role: data.crewRole,
      base_airport: data.baseAirport,
      company_name: data.airline,
    }, { onConflict: 'user_id' });
  },

  async savePreferences(userId: string, data: {
    timezone: string;
    notificationsEnabled: boolean;
    theme: string;
  }) {
    await supabase.from('user_settings').upsert({
      user_id: userId,
      timezone: data.timezone,
      notifications_enabled: data.notificationsEnabled,
      theme: data.theme,
    }, { onConflict: 'user_id' });
  },
};
