import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { OnboardingService, ONBOARDING_STEPS } from '@/lib/services/onboarding-service';
import { NotificationService } from '@/lib/services/notification-service';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Plane, User, Settings, Upload, Bell, CheckCircle2, ChevronRight, ChevronLeft, X } from 'lucide-react';
import { applyResolvedThemePreference, normalizeThemePreference } from '@/lib/themeByTime';
import {
  getTimezoneLabel,
  isKnownOperationalTimezone,
  OPERATIONAL_TIMEZONE_OPTIONS,
} from '@/lib/timezone-options';
import { reportUnexpectedError } from '@/lib/monitoring/errorReporting';

const SESSION_DISMISSED_KEY = 'escalax_onboarding_dismissed';

export function useOnboardingModal() {
  const { user, profile } = useAuth();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Wait until both user and profile are fully resolved
    if (!user || !profile) { setShouldShow(false); return; }
    if (profile.onboarding_completed) { setShouldShow(false); return; }
    const dismissed = sessionStorage.getItem(SESSION_DISMISSED_KEY);
    if (dismissed === 'true') { setShouldShow(false); return; }
    // Small delay to ensure DOM is ready after login navigation
    const timer = setTimeout(() => setShouldShow(true), 300);
    return () => clearTimeout(timer);
  }, [user?.id, profile?.onboarding_completed]);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_DISMISSED_KEY, 'true');
    setShouldShow(false);
  };

  const openManually = () => {
    sessionStorage.removeItem(SESSION_DISMISSED_KEY);
    setShouldShow(true);
  };

  return { shouldShow, dismiss, openManually, needsOnboarding: !!profile && !profile.onboarding_completed };
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function OnboardingModal({ open, onClose }: Props) {
  const { setTheme } = useTheme();
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: '', airline: '', crewRole: '', baseAirport: '', registration: '',
  });
  const [prefsForm, setPrefsForm] = useState({
    timezone: 'America/Sao_Paulo', notificationsEnabled: true, theme: 'auto',
  });
  const [notifPrefs, setNotifPrefs] = useState({
    push: true, dutyAlerts: true, scheduleAlerts: true, weeklySummary: true, activityReminder: true,
  });

  useEffect(() => {
    if (profile) {
      setProfileForm(f => ({
        ...f,
        name: f.name || profile.name || '',
        airline: f.airline || profile.airline || '',
      }));
    }
  }, [profile]);

  useEffect(() => {
    if (!user || !open) return;
    OnboardingService.getProgress(user.id)
      .then(({ step: savedStep }) => setStep(savedStep))
      .catch((e) => {
        reportUnexpectedError(e, { flow: 'onboarding_get_progress' });
      });
  }, [user?.id, open]);

  const totalSteps = ONBOARDING_STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;

  const goNext = async () => {
    if (!user) return;
    try {
      if (step === 1) {
        await OnboardingService.saveProfile(user.id, profileForm);
        await refreshProfile();
      }
      if (step === 2) {
        await OnboardingService.savePreferences(user.id, prefsForm);
      }
      const nextStep = step + 1;
      if (nextStep >= totalSteps) {
        setCompleting(true);
        await OnboardingService.completeOnboarding(user.id);
        await NotificationService.create({
          userId: user.id,
          title: 'Bem-vindo ao EscalaX! ✈️',
          message: 'Seu perfil está configurado. Importe sua escala para começar.',
          type: 'info',
        });
        await refreshProfile();
        setCompleting(false);
        onClose();
      } else {
        await OnboardingService.saveStep(user.id, nextStep);
        setStep(nextStep);
      }
    } catch (e) {
      reportUnexpectedError(e, { flow: 'onboarding_step', extra: { step } });
      setCompleting(false);
    }
  };

  const goBack = () => { if (step > 0) setStep(step - 1); };

  const skipToEnd = async () => {
    if (!user) return;
    setCompleting(true);
    try {
      await OnboardingService.completeOnboarding(user.id);
      await refreshProfile();
      onClose();
    } catch (e) {
      reportUnexpectedError(e, { flow: 'onboarding_skip_to_end' });
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden border-border" onInteractOutside={(e) => e.preventDefault()}>
        {/* Close button */}
        <button onClick={onClose} className="absolute right-3 top-3 z-10 p-1 rounded-md hover:bg-muted transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Progress bar */}
        <div className="w-full h-1 bg-muted">
          <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 pt-4 pb-1">
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-primary scale-125' : i < step ? 'bg-primary/40' : 'bg-muted'}`} />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-4 min-h-[360px] flex items-start">
          <div className="w-full">
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

                {step === 0 && (
                  <div className="text-center space-y-5 py-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-sky-400 flex items-center justify-center mx-auto shadow-lg">
                      <Plane className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Bem-vindo ao EscalaX</h2>
                      <p className="text-muted-foreground text-sm mt-1.5">Vamos fazer uma configuração rápida para personalizar sua experiência de escala.</p>
                    </div>
                    <div className="space-y-2 pt-2">
                      <Button onClick={goNext} className="w-full" size="lg">Começar <ChevronRight className="w-4 h-4 ml-1" /></Button>
                      <Button variant="ghost" onClick={onClose} className="w-full text-muted-foreground text-sm">Pular por agora</Button>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <h2 className="text-xl font-bold text-foreground">Perfil profissional</h2>
                    </div>
                    <div className="space-y-3">
                      <div><Label className="text-xs text-muted-foreground">Nome completo</Label><Input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} placeholder="João Silva" /></div>
                      {/* Airline visual selector */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Qual é a sua companhia aérea?</Label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {[
                            { name: 'GOL', color: 'bg-orange-500', text: 'text-white' },
                            { name: 'LATAM', color: 'bg-red-600', text: 'text-white' },
                            { name: 'Azul', color: 'bg-cyan-500', text: 'text-white' },
                            { name: 'Avianca', color: 'bg-red-700', text: 'text-white' },
                            { name: 'MAP', color: 'bg-blue-600', text: 'text-white' },
                            { name: 'Passaredo', color: 'bg-green-600', text: 'text-white' },
                          ].map(a => (
                            <button
                              key={a.name}
                              type="button"
                              onClick={() => setProfileForm(f => ({ ...f, airline: a.name }))}
                              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${
                                profileForm.airline === a.name
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border hover:border-primary/40'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full ${a.color} flex items-center justify-center shrink-0`}>
                                <span className={`text-xs font-bold ${a.text}`}>{a.name.charAt(0)}</span>
                              </div>
                              <span className="text-sm font-medium text-foreground">{a.name}</span>
                              {profileForm.airline === a.name && (
                                <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                              )}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2">
                          <Input
                            value={!['GOL','LATAM','Azul','Avianca','MAP','Passaredo'].includes(profileForm.airline) ? profileForm.airline : ''}
                            onChange={e => setProfileForm(f => ({ ...f, airline: e.target.value }))}
                            placeholder="Outra companhia..."
                            className="text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Função</Label>
                        <Select value={profileForm.crewRole} onValueChange={v => setProfileForm(f => ({ ...f, crewRole: v }))}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent><SelectItem value="Comandante">Comandante</SelectItem><SelectItem value="Copiloto">Copiloto</SelectItem><SelectItem value="Comissário">Comissário(a)</SelectItem><SelectItem value="Outro">Outro</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs text-muted-foreground">Minha base</Label><Input value={profileForm.baseAirport} onChange={e => setProfileForm(f => ({ ...f, baseAirport: e.target.value.toUpperCase() }))} placeholder="GRU, CGH..." maxLength={4} /></div>
                      <div><Label className="text-xs text-muted-foreground">Matrícula <span className="opacity-50">(opcional)</span></Label><Input value={profileForm.registration} onChange={e => setProfileForm(f => ({ ...f, registration: e.target.value }))} placeholder="12345" /></div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                        <Settings className="w-6 h-6 text-primary" />
                      </div>
                      <h2 className="text-xl font-bold text-foreground">Preferências</h2>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Fuso horário</Label>
                        <Select
                          value={prefsForm.timezone}
                          onValueChange={(v) => {
                            setPrefsForm((f) => {
                              const next = { ...f, timezone: v };
                              if (next.theme === 'auto') {
                                queueMicrotask(() => applyResolvedThemePreference('auto', next.timezone, setTheme));
                              }
                              return next;
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Fuso horário" />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERATIONAL_TIMEZONE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                            {prefsForm.timezone.trim() !== '' && !isKnownOperationalTimezone(prefsForm.timezone) && (
                              <SelectItem value={prefsForm.timezone}>{getTimezoneLabel(prefsForm.timezone)}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Tema</Label>
                        <Select
                          value={prefsForm.theme}
                          onValueChange={(v) => {
                            setPrefsForm((f) => {
                              const next = { ...f, theme: v };
                              queueMicrotask(() =>
                                applyResolvedThemePreference(normalizeThemePreference(next.theme), next.timezone, setTheme),
                              );
                              return next;
                            });
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Automático (horário)</SelectItem>
                            <SelectItem value="light">Claro</SelectItem>
                            <SelectItem value="dark">Escuro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between py-1"><Label>Notificações</Label><Switch checked={prefsForm.notificationsEnabled} onCheckedChange={v => setPrefsForm(f => ({ ...f, notificationsEnabled: v }))} /></div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                        <Upload className="w-6 h-6 text-primary" />
                      </div>
                      <h2 className="text-xl font-bold text-foreground">Importar escala</h2>
                      <p className="text-sm text-muted-foreground mt-1">Opcional — você pode fazer isso depois</p>
                    </div>
                    <div className="text-center space-y-3">
                      <p className="text-sm text-muted-foreground">Importe o PDF da sua escala para carregar voos automaticamente.</p>
                      <PdfImportDialog onImportComplete={() => {}} trigger={<Button className="w-full" size="lg"><Upload className="w-4 h-4 mr-2" /> Importar PDF</Button>} />
                      <p className="text-xs text-muted-foreground">Formatos suportados: PDF (Crew Roster Report)</p>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                        <Bell className="w-6 h-6 text-primary" />
                      </div>
                      <h2 className="text-xl font-bold text-foreground">Notificações</h2>
                    </div>
                    <div className="space-y-2">
                      {([
                        { key: 'dutyAlerts' as const, label: 'Alertas de jornada', desc: 'Próximas atividades' },
                        { key: 'scheduleAlerts' as const, label: 'Alterações de escala', desc: 'Atualizações' },
                        { key: 'weeklySummary' as const, label: 'Resumo semanal', desc: 'Visão da semana' },
                        { key: 'activityReminder' as const, label: 'Lembrete de atividade', desc: 'Antes da apresentação' },
                      ]).map(item => (
                        <div key={item.key} className="flex items-center justify-between py-2">
                          <div><p className="text-sm font-medium text-foreground">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                          <Switch checked={notifPrefs[item.key]} onCheckedChange={v => setNotifPrefs(f => ({ ...f, [item.key]: v }))} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="text-center space-y-5 py-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-10 h-10 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Seu EscalaX está pronto</h2>
                      <p className="text-muted-foreground mt-1">Tudo configurado. Bons voos! ✈️</p>
                    </div>
                    <Button onClick={goNext} disabled={completing} className="w-full" size="lg">
                      {completing ? 'Salvando...' : 'Ir para meu painel'} <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer nav (steps 1-4) */}
        {step > 0 && step < 5 && (
          <div className="px-6 pb-5 pt-1 space-y-2">
            <div className="flex gap-3">
              <Button variant="outline" onClick={goBack} className="flex-1"><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</Button>
              <Button onClick={goNext} className="flex-1">{step === 4 ? 'Concluir' : 'Próximo'} <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
            <button onClick={skipToEnd} disabled={completing} className="w-full text-center text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors">
              {completing ? 'Salvando...' : 'Pular e configurar depois'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
