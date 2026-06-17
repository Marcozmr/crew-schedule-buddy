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
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  Plane, Upload, Bell, CheckCircle2, ChevronRight, ChevronLeft,
  FileText, Cloud, Shield, Calendar, Users, X,
} from 'lucide-react';
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
    if (!user || !profile) { setShouldShow(false); return; }
    if (profile.onboarding_completed) { setShouldShow(false); return; }
    const dismissed = sessionStorage.getItem(SESSION_DISMISSED_KEY);
    if (dismissed === 'true') { setShouldShow(false); return; }
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

const AIRLINES = [
  { name: 'GOL', color: 'bg-orange-500', initial: 'G' },
  { name: 'LATAM', color: 'bg-red-600', initial: 'L' },
  { name: 'Azul', color: 'bg-cyan-500', initial: 'A' },
  { name: 'Avianca', color: 'bg-red-700', initial: 'V' },
  { name: 'MAP', color: 'bg-blue-600', initial: 'M' },
  { name: 'Passaredo', color: 'bg-green-600', initial: 'P' },
  { name: 'Two Flex', color: 'bg-purple-600', initial: 'T' },
  { name: 'Sideral', color: 'bg-indigo-600', initial: 'S' },
];

const ROLES = [
  { value: 'Comandante', label: 'Comandante', emoji: '✈️', desc: 'Piloto em comando' },
  { value: 'Copiloto', label: 'Copiloto', emoji: '🛫', desc: 'Segundo em comando' },
  { value: 'Comissário', label: 'Comissário', emoji: '👨‍✈️', desc: 'Tripulante de cabine' },
  { value: 'Comissária', label: 'Comissária', emoji: '👩‍✈️', desc: 'Tripulante de cabine' },
];

const APP_FEATURES = [
  { icon: FileText, label: 'Importação automática', desc: 'Leitura da escala a partir do PDF oficial da companhia.' },
  { icon: Cloud, label: 'MetCenter', desc: 'METAR, TAF, NOTAM e cartas aeronáuticas integradas.' },
  { icon: Shield, label: 'Calculadora operacional', desc: 'Jornada, repouso e limites conforme RBAC 117.' },
  { icon: Calendar, label: 'Calendário inteligente', desc: 'Visualização completa da escala com alertas.' },
  { icon: Users, label: 'Conexões', desc: 'Compartilhe sua escala e conecte-se com colegas.' },
];

const COMPATIBLE_AIRLINES = [
  { name: 'GOL', system: 'CrewLink / IADP', color: 'bg-orange-500' },
  { name: 'LATAM', system: 'iFlightNeo', color: 'bg-red-600' },
  { name: 'Azul', system: 'CAE CrewLink', color: 'bg-cyan-500' },
  { name: 'Avianca', system: 'CrewLink / PDF', color: 'bg-red-700' },
];

// Sub-steps inside step 1 (profile)
type ProfileSub = 'role' | 'airline' | 'info';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function OnboardingModal({ open, onClose }: Props) {
  const { setTheme } = useTheme();
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [profileSub, setProfileSub] = useState<ProfileSub>('role');
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
      .catch((e) => { reportUnexpectedError(e, { flow: 'onboarding_get_progress' }); });
  }, [user?.id, open]);

  const totalSteps = ONBOARDING_STEPS.length;

  // Visual step count for dots (step 1 has 3 sub-steps shown as one dot group)
  const visualTotal = totalSteps; // 6 backend steps

  const goNext = async () => {
    if (!user) return;
    try {
      // Handle sub-steps in step 1
      if (step === 1) {
        if (profileSub === 'role') { setProfileSub('airline'); return; }
        if (profileSub === 'airline') { setProfileSub('info'); return; }
        // profileSub === 'info': save and advance
        await OnboardingService.saveProfile(user.id, profileForm);
        await refreshProfile();
        setProfileSub('role'); // reset for future re-opens
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

  const goBack = () => {
    if (step === 1) {
      if (profileSub === 'info') { setProfileSub('airline'); return; }
      if (profileSub === 'airline') { setProfileSub('role'); return; }
    }
    if (step > 0) setStep(step - 1);
  };

  const skipToEnd = async () => {
    if (!user) return;
    setCompleting(true);
    try {
      await OnboardingService.completeOnboarding(user.id);
      await refreshProfile();
      onClose();
    } catch (e) {
      reportUnexpectedError(e, { flow: 'onboarding_skip_to_end' });
    } finally { setCompleting(false); }
  };

  if (!open) return null;

  // Unique key for AnimatePresence
  const animKey = step === 1 ? `1-${profileSub}` : String(step);

  // Dot count: step 1 has 3 sub-steps, show as 3 dots in visual
  const totalDots = 8; // 0, 1a, 1b, 1c, 2, 3, 4, 5
  const currentDot =
    step === 0 ? 0
    : step === 1 && profileSub === 'role' ? 1
    : step === 1 && profileSub === 'airline' ? 2
    : step === 1 && profileSub === 'info' ? 3
    : step + 3; // steps 2-5 → dots 5-8

  const canGoNext =
    step === 1 && profileSub === 'role' ? !!profileForm.crewRole
    : step === 1 && profileSub === 'airline' ? !!profileForm.airline
    : true;

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col">
      {/* Close (skip) button — top right */}
      {step < 5 && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 p-2 rounded-xl hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      )}

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
          <motion.div
            key={animKey}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="min-h-full flex flex-col"
          >

            {/* ── Step 0: Welcome / features ── */}
            {step === 0 && (
              <div className="flex-1 flex flex-col px-6 py-10 max-w-lg mx-auto w-full">
                {/* Logo */}
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-sky-400 flex items-center justify-center shadow-xl mb-5">
                    <Plane className="w-10 h-10 text-white" />
                  </div>
                  <h1 className="text-3xl font-extrabold text-foreground">Bem-vindo ao EscalaX</h1>
                  <p className="text-muted-foreground mt-2 text-base max-w-xs">
                    Sua escala de voo organizada, meteorologia integrada e conectada.
                  </p>
                </div>

                {/* Features */}
                <div className="mb-8">
                  <p className="text-primary text-sm font-semibold uppercase tracking-wide mb-3">O que o app oferece</p>
                  <div className="space-y-3">
                    {APP_FEATURES.map((f, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <f.icon className="w-4.5 h-4.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{f.label}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Compatible airlines */}
                <div className="mb-8">
                  <p className="text-primary text-sm font-semibold uppercase tracking-wide mb-3">Companhias compatíveis</p>
                  <div className="space-y-2">
                    {COMPATIBLE_AIRLINES.map((a, i) => (
                      <div key={i} className="flex items-center gap-3 py-1">
                        <div className={`w-7 h-7 rounded-full ${a.color} flex items-center justify-center shrink-0`}>
                          <span className="text-white text-[10px] font-bold">{a.name.charAt(0)}</span>
                        </div>
                        <p className="text-sm text-foreground">
                          <span className="font-semibold">{a.name}</span>
                          <span className="text-muted-foreground"> — sistema {a.system}</span>
                        </p>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-2">
                      Importação por PDF funciona para qualquer companhia que gere o Crew Roster Report.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 1a: Role selection ── */}
            {step === 1 && profileSub === 'role' && (
              <div className="flex-1 flex flex-col px-6 py-10 max-w-lg mx-auto w-full">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-extrabold text-foreground">Qual é a sua função?</h2>
                  <p className="text-muted-foreground mt-2">Usamos isso para personalizar a experiência.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {ROLES.map(r => (
                    <button
                      key={r.value}
                      onClick={() => setProfileForm(f => ({ ...f, crewRole: r.value }))}
                      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-5 transition-all ${
                        profileForm.crewRole === r.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50'
                      }`}
                    >
                      <span className="text-4xl">{r.emoji}</span>
                      <span className="text-sm font-semibold text-foreground">{r.label}</span>
                      <span className="text-[10px] text-muted-foreground text-center">{r.desc}</span>
                      {profileForm.crewRole === r.value && (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 1b: Airline selection ── */}
            {step === 1 && profileSub === 'airline' && (
              <div className="flex-1 flex flex-col px-6 py-10 max-w-lg mx-auto w-full">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-extrabold text-foreground">Qual é a sua companhia aérea?</h2>
                  <p className="text-muted-foreground mt-2">Usamos isso para liberar os recursos específicos.</p>
                </div>
                <div className="space-y-3 flex-1">
                  {AIRLINES.map(a => (
                    <button
                      key={a.name}
                      onClick={() => setProfileForm(f => ({ ...f, airline: a.name }))}
                      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-all ${
                        profileForm.airline === a.name
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/30 hover:bg-muted/40'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full ${a.color} flex items-center justify-center shrink-0`}>
                        <span className="text-white text-sm font-bold">{a.initial}</span>
                      </div>
                      <span className="text-base font-semibold text-foreground">{a.name}</span>
                      {profileForm.airline === a.name && (
                        <CheckCircle2 className="w-5 h-5 text-primary ml-auto" />
                      )}
                    </button>
                  ))}
                  <div className="pt-2">
                    <Input
                      value={!AIRLINES.map(a => a.name).includes(profileForm.airline) ? profileForm.airline : ''}
                      onChange={e => setProfileForm(f => ({ ...f, airline: e.target.value }))}
                      placeholder="Outra companhia..."
                      className="rounded-2xl border-2 border-border focus:border-primary h-12"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 1c: Basic info ── */}
            {step === 1 && profileSub === 'info' && (
              <div className="flex-1 flex flex-col px-6 py-10 max-w-lg mx-auto w-full">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-extrabold text-foreground">Seus dados</h2>
                  <p className="text-muted-foreground mt-2">Essas informações ficam salvas no seu perfil.</p>
                </div>
                <div className="space-y-4 flex-1">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Nome completo</Label>
                    <Input
                      value={profileForm.name}
                      onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="João Silva"
                      className="mt-1.5 h-12 rounded-2xl border-2 border-border focus:border-primary"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Base (aeroporto domicílio)</Label>
                    <Input
                      value={profileForm.baseAirport}
                      onChange={e => setProfileForm(f => ({ ...f, baseAirport: e.target.value.toUpperCase() }))}
                      placeholder="GRU, CGH, BSB..."
                      maxLength={4}
                      className="mt-1.5 h-12 rounded-2xl border-2 border-border focus:border-primary font-mono uppercase"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Matrícula <span className="text-muted-foreground/50 font-normal">(opcional)</span>
                    </Label>
                    <Input
                      value={profileForm.registration}
                      onChange={e => setProfileForm(f => ({ ...f, registration: e.target.value }))}
                      placeholder="12345"
                      className="mt-1.5 h-12 rounded-2xl border-2 border-border focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Preferences ── */}
            {step === 2 && (
              <div className="flex-1 flex flex-col px-6 py-10 max-w-lg mx-auto w-full">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-extrabold text-foreground">Preferências</h2>
                  <p className="text-muted-foreground mt-2">Configure o app para sua rotina.</p>
                </div>
                <div className="space-y-5 flex-1">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-1.5 block">Fuso horário</Label>
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
                      <SelectTrigger className="h-12 rounded-2xl">
                        <SelectValue placeholder="Fuso horário" />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATIONAL_TIMEZONE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                        {prefsForm.timezone.trim() !== '' && !isKnownOperationalTimezone(prefsForm.timezone) && (
                          <SelectItem value={prefsForm.timezone}>{getTimezoneLabel(prefsForm.timezone)}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-1.5 block">Tema</Label>
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
                      <SelectTrigger className="h-12 rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Automático (horário)</SelectItem>
                        <SelectItem value="light">Claro</SelectItem>
                        <SelectItem value="dark">Escuro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between py-3 px-4 rounded-2xl border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">Notificações</p>
                      <p className="text-xs text-muted-foreground">Alertas de jornada e escala</p>
                    </div>
                    <Switch checked={prefsForm.notificationsEnabled} onCheckedChange={v => setPrefsForm(f => ({ ...f, notificationsEnabled: v }))} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Import ── */}
            {step === 3 && (
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-lg mx-auto w-full text-center">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-3xl font-extrabold text-foreground mb-3">Importar escala</h2>
                <p className="text-muted-foreground mb-2 max-w-xs">
                  Importe o PDF do Crew Roster Report da sua companhia.
                </p>
                <p className="text-sm text-muted-foreground mb-8">Você pode fazer isso agora ou depois.</p>
                <PdfImportDialog
                  onImportComplete={() => {}}
                  trigger={
                    <Button className="w-full h-13 text-base rounded-2xl" size="lg">
                      <Upload className="w-5 h-5 mr-2" /> Importar PDF agora
                    </Button>
                  }
                />
              </div>
            )}

            {/* ── Step 4: Notifications ── */}
            {step === 4 && (
              <div className="flex-1 flex flex-col px-6 py-10 max-w-lg mx-auto w-full">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                    <Bell className="w-10 h-10 text-primary" />
                  </div>
                  <h2 className="text-3xl font-extrabold text-foreground">Notificações</h2>
                  <p className="text-muted-foreground mt-2">Escolha o que você quer receber.</p>
                </div>
                <div className="space-y-2">
                  {([
                    { key: 'dutyAlerts' as const, label: 'Alertas de jornada', desc: 'Aviso antes da próxima apresentação' },
                    { key: 'scheduleAlerts' as const, label: 'Alterações de escala', desc: 'Quando sua escala for atualizada' },
                    { key: 'weeklySummary' as const, label: 'Resumo semanal', desc: 'Visão geral dos voos da semana' },
                    { key: 'activityReminder' as const, label: 'Lembrete de atividade', desc: 'Antes do check-in' },
                  ]).map(item => (
                    <div key={item.key} className="flex items-center justify-between py-3.5 px-4 rounded-2xl border border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch checked={notifPrefs[item.key]} onCheckedChange={v => setNotifPrefs(f => ({ ...f, [item.key]: v }))} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 5: Complete ── */}
            {step === 5 && (
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-lg mx-auto w-full text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6"
                >
                  <CheckCircle2 className="w-12 h-12 text-primary" />
                </motion.div>
                <h2 className="text-3xl font-extrabold text-foreground mb-3">Tudo pronto!</h2>
                <p className="text-muted-foreground text-base max-w-xs">
                  Seu EscalaX está configurado. Bons voos! ✈️
                </p>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom area: dots + button */}
      <div className="shrink-0 px-6 pb-8 pt-4 safe-area-bottom bg-background/95 backdrop-blur-sm border-t border-border/50">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {Array.from({ length: totalDots }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === currentDot
                  ? 'w-5 h-2 bg-primary'
                  : i < currentDot
                  ? 'w-2 h-2 bg-primary/40'
                  : 'w-2 h-2 bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Action buttons */}
        {step === 0 && (
          <div className="space-y-2">
            <Button onClick={goNext} className="w-full h-13 text-base rounded-2xl" size="lg">
              Começar <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
            <button onClick={onClose} className="w-full text-center text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors py-2">
              Pular por agora
            </button>
          </div>
        )}

        {step > 0 && step < 5 && (
          <div className="space-y-2">
            <Button
              onClick={goNext}
              disabled={completing || !canGoNext}
              className="w-full h-13 text-base rounded-2xl"
              size="lg"
            >
              {completing ? 'Salvando...' : step === 4 ? 'Concluir' : 'Avançar'}
              {!completing && <ChevronRight className="w-5 h-5 ml-1" />}
            </Button>
            <div className="flex items-center justify-between">
              <button onClick={goBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                <ChevronLeft className="w-4 h-4" /> Voltar
              </button>
              <button onClick={skipToEnd} disabled={completing} className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors py-2">
                Pular tudo
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <Button
            onClick={goNext}
            disabled={completing}
            className="w-full h-13 text-base rounded-2xl"
            size="lg"
          >
            {completing ? 'Salvando...' : 'Ir para meu painel'} <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
