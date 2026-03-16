import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Plane, User, Settings, Upload, Bell, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';

const stepIcons = [Plane, User, Settings, Upload, Bell, CheckCircle2];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: '', airline: '', crewRole: '', baseAirport: '', registration: '',
  });

  // Preferences form
  const [prefsForm, setPrefsForm] = useState({
    timezone: 'America/Sao_Paulo', notificationsEnabled: true, theme: 'system',
  });

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState({
    push: true, dutyAlerts: true, scheduleAlerts: true, weeklySummary: true, activityReminder: true,
  });

  useEffect(() => {
    if (!user) return;
    OnboardingService.getProgress(user.id).then(({ step: savedStep, completed }) => {
      if (completed) {
        navigate('/home', { replace: true });
        return;
      }
      setStep(savedStep);
      setLoading(false);
    });
  }, [user, navigate]);

  useEffect(() => {
    if (profile) {
      setProfileForm(f => ({
        ...f,
        name: f.name || profile.name || '',
        airline: f.airline || profile.airline || '',
      }));
    }
  }, [profile]);

  const totalSteps = ONBOARDING_STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;

  const goNext = async () => {
    if (!user) return;

    // Save step-specific data
    if (step === 1) {
      await OnboardingService.saveProfile(user.id, profileForm);
      await refreshProfile();
    }
    if (step === 2) {
      await OnboardingService.savePreferences(user.id, prefsForm);
    }

    const nextStep = step + 1;
    if (nextStep >= totalSteps) {
      await OnboardingService.completeOnboarding(user.id);
      await NotificationService.create({
        userId: user.id,
        title: 'Bem-vindo ao EscalaX! ✈️',
        message: 'Seu perfil está configurado. Importe sua escala para começar.',
        type: 'info',
      });
      navigate('/home', { replace: true });
    } else {
      await OnboardingService.saveStep(user.id, nextStep);
      setStep(nextStep);
    }
  };

  const goBack = () => { if (step > 0) setStep(step - 1); };

  const skipToEnd = async () => {
    if (!user) return;
    await OnboardingService.completeOnboarding(user.id);
    navigate('/home', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const StepIcon = stepIcons[step] || Plane;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="w-full h-1 bg-muted">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 pt-6 pb-2">
        {ONBOARDING_STEPS.map((_, i) => (
          <div key={i} className={`w-2.5 h-2.5 rounded-full transition-colors ${i === step ? 'bg-primary scale-125' : i < step ? 'bg-primary/40' : 'bg-muted'}`} />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              {/* Step 0: Welcome */}
              {step === 0 && (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-sky-400 flex items-center justify-center mx-auto shadow-lg">
                    <Plane className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-foreground">Bem-vindo ao EscalaX</h1>
                    <p className="text-muted-foreground mt-2">Gerencie sua escala de forma simples, clara e inteligente.</p>
                  </div>
                  <div className="space-y-3 pt-4">
                    <Button onClick={goNext} className="w-full" size="lg">
                      Começar <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                    <Button variant="ghost" onClick={skipToEnd} className="w-full text-muted-foreground">
                      Configurar depois
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 1: Profile */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <User className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Perfil profissional</h2>
                    <p className="text-sm text-muted-foreground mt-1">Configure seu perfil de tripulante</p>
                  </div>
                  <div className="bg-card rounded-xl p-5 border border-border space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome completo</Label>
                      <Input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} placeholder="João Silva" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Companhia aérea</Label>
                      <Input value={profileForm.airline} onChange={e => setProfileForm(f => ({ ...f, airline: e.target.value }))} placeholder="LATAM, GOL, Azul..." />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Função</Label>
                      <Select value={profileForm.crewRole} onValueChange={v => setProfileForm(f => ({ ...f, crewRole: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Comandante">Comandante</SelectItem>
                          <SelectItem value="Copiloto">Copiloto</SelectItem>
                          <SelectItem value="Comissário">Comissário(a)</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Base operacional</Label>
                      <Input value={profileForm.baseAirport} onChange={e => setProfileForm(f => ({ ...f, baseAirport: e.target.value.toUpperCase() }))} placeholder="GRU, CGH, BSB..." maxLength={4} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Matrícula <span className="text-muted-foreground/60">(opcional)</span></Label>
                      <Input value={profileForm.registration} onChange={e => setProfileForm(f => ({ ...f, registration: e.target.value }))} placeholder="12345" />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Preferences */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Settings className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Preferências operacionais</h2>
                    <p className="text-sm text-muted-foreground mt-1">Personalize sua experiência</p>
                  </div>
                  <div className="bg-card rounded-xl p-5 border border-border space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Fuso horário principal</Label>
                      <Select value={prefsForm.timezone} onValueChange={v => setPrefsForm(f => ({ ...f, timezone: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/Sao_Paulo">Brasília (BRT)</SelectItem>
                          <SelectItem value="America/Manaus">Manaus (AMT)</SelectItem>
                          <SelectItem value="America/Belem">Belém (BRT)</SelectItem>
                          <SelectItem value="America/Cuiaba">Cuiabá (AMT)</SelectItem>
                          <SelectItem value="America/Rio_Branco">Rio Branco (ACT)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Tema</Label>
                      <Select value={prefsForm.theme} onValueChange={v => setPrefsForm(f => ({ ...f, theme: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system">Automático (sistema)</SelectItem>
                          <SelectItem value="light">Claro</SelectItem>
                          <SelectItem value="dark">Escuro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <Label>Notificações habilitadas</Label>
                      <Switch checked={prefsForm.notificationsEnabled} onCheckedChange={v => setPrefsForm(f => ({ ...f, notificationsEnabled: v }))} />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Import */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Upload className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Importar escala</h2>
                    <p className="text-sm text-muted-foreground mt-1">Carregue sua escala para começar</p>
                  </div>
                  <div className="bg-card rounded-xl p-5 border border-border space-y-4">
                    <div className="text-center space-y-3">
                      <p className="text-sm text-muted-foreground">Importe o PDF da sua escala (Crew Roster Report) para carregar voos, jornadas e folgas automaticamente.</p>
                      <PdfImportDialog
                        onImportComplete={() => {}}
                        trigger={
                          <Button className="w-full" size="lg">
                            <Upload className="w-4 h-4 mr-2" /> Importar PDF da Escala
                          </Button>
                        }
                      />
                    </div>
                    <div className="border-t border-border pt-3">
                      <p className="text-xs text-muted-foreground text-center">Formatos suportados: PDF (Crew Roster Report). Outros formatos em breve.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Notification Preferences */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Bell className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Notificações</h2>
                    <p className="text-sm text-muted-foreground mt-1">Escolha como deseja ser avisado</p>
                  </div>
                  <div className="bg-card rounded-xl p-5 border border-border space-y-3">
                    {[
                      { key: 'dutyAlerts' as const, label: 'Alertas de jornada', desc: 'Avisos sobre próximas atividades' },
                      { key: 'scheduleAlerts' as const, label: 'Alterações de escala', desc: 'Quando sua escala for atualizada' },
                      { key: 'weeklySummary' as const, label: 'Resumo semanal', desc: 'Visão geral da semana' },
                      { key: 'activityReminder' as const, label: 'Lembrete de atividade', desc: 'Aviso antes da apresentação' },
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <Switch
                          checked={notifPrefs[item.key]}
                          onCheckedChange={v => setNotifPrefs(f => ({ ...f, [item.key]: v }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 5: Complete */}
              {step === 5 && (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-12 h-12 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-foreground">Seu EscalaX está pronto</h2>
                    <p className="text-muted-foreground mt-2">Tudo configurado. Bons voos! ✈️</p>
                  </div>
                  <Button onClick={goNext} className="w-full" size="lg">
                    Ir para meu painel <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation footer (hidden on welcome and complete steps) */}
      {step > 0 && step < 5 && (
        <div className="px-4 pb-6 pt-2 max-w-md mx-auto w-full">
          <div className="flex gap-3">
            <Button variant="outline" onClick={goBack} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <Button onClick={goNext} className="flex-1">
              {step === 4 ? 'Concluir' : 'Próximo'} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <button onClick={skipToEnd} className="w-full text-center text-xs text-muted-foreground/70 mt-3 hover:text-muted-foreground transition-colors">
            Pular e configurar depois
          </button>
        </div>
      )}
    </div>
  );
}
