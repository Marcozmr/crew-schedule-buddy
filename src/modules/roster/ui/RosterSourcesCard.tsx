/**
 * RosterSourcesCard — Fontes de escala (PDF, manual, portal LATAM, iFlight).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  Upload,
  Cloud,
  ChevronRight,
  ArrowLeft,
  Lock,
  Plane,
  Loader2,
  Link2,
  Unlink,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { CrewRosterQuickImportControls } from '@/components/roster/CrewRosterQuickImportControls';
import { RosterSyncService } from '../services/RosterSyncService';
import { SessionManager } from '../services/SessionManager';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTimeBR } from '@/lib/date-utils';
import { Link, useNavigate } from 'react-router-dom';
import { corporatePortalConfig, isLoginUrlConfigured, isTestMode } from '@/lib/corporate-portal-config';
import { emitRosterUpdated } from '@/lib/events/roster-events';
import { useUserRosterConnection } from '@/hooks/useUserRosterConnection';
import { UserRosterConnectionService } from '../services/UserRosterConnectionService';
import type { ProviderStatus } from '../types';
import { CORPORATE_ROSTER_FLOW } from '@/lib/roster/roster-ux-messages';
import { isRosterAutomationConfigured } from '@/lib/roster-automation-api';
import { AutomationStatusCard } from '@/components/roster/AutomationStatusCard';
import { isLatamWebViewAvailable, openLatamPortalWebView, processMobilePdf } from '@/lib/roster/latam-mobile-webview-service';
import type { PdfImportResult } from '@/lib/pdf-import';

interface RosterSourcesCardProps {
  onImportComplete?: () => void;
}

const PORTAL_BADGE: Record<string, string> = {
  disconnected: 'Não conectado',
  connecting: 'Conectando',
  connected: 'Conectado',
  unavailable: 'Indisponível',
  failed: 'Erro',
};

export function RosterSourcesCard({ onImportComplete }: RosterSourcesCardProps) {
  const navigate = useNavigate();
  const { user, session: authSession } = useAuth();
  const getAccessToken = useCallback(async () => authSession?.access_token ?? null, [authSession?.access_token]);
  // ENV estático — determina se o worker Playwright está disponível
  const automationConfigured = isRosterAutomationConfigured() && corporatePortalConfig.isEnabled;
  const { connection, activeRosterMeta, refresh: refreshConnection } = useUserRosterConnection();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [portalStatus, setPortalStatus] = useState<ProviderStatus | null>(null);
  const [iflightStatus, setIFlightStatus] = useState<ProviderStatus | null>(null);
  const [portalConnecting, setPortalConnecting] = useState(false);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [iflightWindowOpened, setIflightWindowOpened] = useState(false);
  const [mobileAuthenticated, setMobileAuthenticated] = useState(false);
  const [mobileImportResult, setMobileImportResult] = useState<PdfImportResult | null>(null);
  const iflightOpenUrl =
    corporatePortalConfig.iflightModuleUrl || 'https://iflightla.ibsplc.aero/iflight-crew/web/getMainPage';

  const loadLastSync = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('imported_rosters')
      .select('synced_at, updated_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const ts = data?.synced_at ?? data?.updated_at ?? null;
    setLastSync(ts);
  }, [user]);

  const loadPortalAndIFlightStatus = useCallback(async () => {
    try {
      const [p, i] = await Promise.all([
        RosterSyncService.getProviderStatus('corporate_portal'),
        RosterSyncService.getProviderStatus('iflight'),
      ]);
      setPortalStatus(p);
      setIFlightStatus(i);
    } catch {
      setPortalStatus(null);
      setIFlightStatus(null);
    }
  }, []);

  useEffect(() => {
    void loadLastSync();
  }, [loadLastSync]);

  useEffect(() => {
    void loadPortalAndIFlightStatus();
  }, [loadPortalAndIFlightStatus, refreshTrigger]);

  useEffect(() => {
    const onCorporateChange = () => setRefreshTrigger((t) => t + 1);
    window.addEventListener('escalax-corporate-connection-changed', onCorporateChange);
    return () => window.removeEventListener('escalax-corporate-connection-changed', onCorporateChange);
  }, []);

  const handleImportComplete = useCallback(() => {
    void loadLastSync();
    void refreshConnection();
    onImportComplete?.();
  }, [loadLastSync, onImportComplete, refreshConnection]);

  const bump = useCallback(() => setRefreshTrigger((t) => t + 1), []);

  const handleConnectPortal = useCallback(async () => {
    setAutomationError(null);

    // Android nativo: usa WebView controlada para login/SSO/MFA e captura automática do PDF
    if (isLatamWebViewAvailable()) {
      setPortalConnecting(true);
      setMobileImportResult(null);
      try {
        const result = await openLatamPortalWebView();

        if (result.pdfDownloaded && result.pdfBase64 && user) {
          // PDF capturado automaticamente — importar via parser existente
          try {
            const importResult = await processMobilePdf({
              pdfBase64: result.pdfBase64,
              fileName: result.fileName ?? 'CrewRosterReport.pdf',
              userId: user.id,
            });
            setMobileImportResult(importResult);
            setMobileAuthenticated(true);
            if (importResult.success) {
              emitRosterUpdated({ userId: user.id, reason: 'active_roster_changed', at: new Date().toISOString() });
              void refreshConnection();
              void loadLastSync();
            }
          } catch {
            setMobileAuthenticated(true); // Mostra fallback manual
          }
        } else if (result.authenticated) {
          // Autenticado mas sem PDF — mostra fallback para importação manual
          setMobileAuthenticated(true);
          if (user) {
            void UserRosterConnectionService.advancePortalToAwaitingIFlight(user.id).then(() => {
              emitRosterUpdated({ userId: user.id, reason: 'active_roster_changed', at: new Date().toISOString() });
              void refreshConnection();
            });
          }
        }
      } catch {
        // Utilizador fechou o WebView — sem erro
      } finally {
        setPortalConnecting(false);
        bump();
      }
      return;
    }

    if (automationConfigured) {
      window.open(iflightOpenUrl, '_blank', 'noopener,noreferrer');
      setIflightWindowOpened(true);
      return;
    }
    setPortalConnecting(true);
    try {
      const provider = RosterSyncService.getProviderById('corporate_portal');
      await provider.connect();
    } finally {
      setPortalConnecting(false);
      bump();
      void refreshConnection();
    }
  }, [automationConfigured, bump, iflightOpenUrl, refreshConnection, user]);

  const handleDisconnectPortal = useCallback(async () => {
    const provider = RosterSyncService.getProviderById('corporate_portal');
    await provider.disconnect();
    if (user) {
      await UserRosterConnectionService.clearPortalSessionFlags(user.id);
    }
    bump();
    void refreshConnection();
  }, [bump, user, refreshConnection]);

  const handleManualPortalConfirm = useCallback(async () => {
    if (automationConfigured) {
      window.open(iflightOpenUrl, '_blank', 'noopener,noreferrer');
      setIflightWindowOpened(true);
      setAutomationError(null);
      return;
    }
    // Fluxo manual legado
    SessionManager.setCorporatePortalConnected();
    if (user) {
      void UserRosterConnectionService.advancePortalToAwaitingIFlight(user.id).then(() => {
        emitRosterUpdated({
          userId: user.id,
          reason: 'active_roster_changed',
          at: new Date().toISOString(),
        });
        void refreshConnection();
      });
    }
    bump();
  }, [automationConfigured, bump, iflightOpenUrl, user, refreshConnection]);

  const handleOpenedIFlight = useCallback(() => {
    if (!user) return;
    void UserRosterConnectionService.setRosterConnectionState(user.id, 'iflight_accessed').then(() => {
      emitRosterUpdated({
        userId: user.id,
        reason: 'active_roster_changed',
        at: new Date().toISOString(),
      });
      void refreshConnection();
    });
  }, [user, refreshConnection]);

  const handleDevMarkConnected = useCallback(() => {
    SessionManager.setCorporatePortalConnected();
    if (user) {
      void UserRosterConnectionService.advancePortalToAwaitingIFlight(user.id).then(() => void refreshConnection());
    }
    bump();
  }, [bump, user, refreshConnection]);

  const handleOpenIFlightModule = useCallback(() => {
    const url = corporatePortalConfig.iflightModuleUrl;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const sources = RosterSyncService.getAllSources();
  const pdfSource = sources.find((s) => s.id === 'pdf');
  const manualSource = sources.find((s) => s.id === 'manual');
  const corporateSource = sources.find((s) => s.id === 'corporate_portal');
  const iflightSource = sources.find((s) => s.id === 'iflight');

  const corporate = SessionManager.getCorporateStatus();
  const portalIsConfigured = corporatePortalConfig.isConfigured;
  const portalIsConnected = portalStatus?.status === 'connected';
  const iflightModuleUrl = corporatePortalConfig.iflightModuleUrl;

  const portalBadge =
    portalConnecting ? PORTAL_BADGE.connecting
    : portalStatus?.status === 'connected' ? PORTAL_BADGE.connected
    : portalStatus?.status === 'connecting' ? PORTAL_BADGE.connecting
    : portalStatus?.status === 'failed' ? PORTAL_BADGE.failed
    : portalStatus?.status === 'unavailable' ? PORTAL_BADGE.unavailable
    : PORTAL_BADGE.disconnected;

  const flowState = connection?.roster_connection_state ?? 'idle';
  const showRosterFlowPanel =
    corporatePortalConfig.isEnabled &&
    !activeRosterMeta &&
    flowState !== 'roster_connected' &&
    (portalIsConnected ||
      flowState === 'awaiting_iflight_roster' ||
      flowState === 'iflight_accessed' ||
      flowState === 'portal_connected');

  const showAwaitingIFlightGuidance = showRosterFlowPanel && flowState !== 'iflight_accessed';
  const showImportAfterIFlight = showRosterFlowPanel && flowState === 'iflight_accessed';

  /**
   * Automação Playwright como fluxo principal: não exige portal “conectado” no WebView —
   * o login ocorre na janela do worker. Abrange todo o painel corporativo sem escala ativa.
   */
  const automationAsPrimary =
    isRosterAutomationConfigured() &&
    corporatePortalConfig.isEnabled &&
    !activeRosterMeta &&
    flowState !== 'roster_connected';

  const iflightBlocked = !portalIsConnected;
  const iflightBadge = !corporatePortalConfig.iflightEnabled
    ? 'Indisponível'
    : iflightBlocked
      ? 'Bloqueado'
      : iflightModuleUrl
        ? 'Pronto para abrir'
        : 'Integração futura';

  /** Com escala ativa no app: foco em PDF/atualização; portal/iFlight em modo secundário. */
  const dailyMode = Boolean(activeRosterMeta);

  const integrationSection = (
    <>
      {corporateSource && (
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-background/60 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground break-words">Portal corporativo LATAM</p>
                {isLoginUrlConfigured() ? (
                  <p className="text-xs text-muted-foreground break-words">
                    {automationConfigured
                      ? 'Clique em Conectar para abrir o iFlight Neo. Após fazer login, baixe o Roster Report e importe aqui.'
                      : 'Toque em Conectar para abrir o portal. Depois volte ao EscalaX e siga os passos indicados — SAB, iFlight e importação do CrewRosterReport (o app não fecha o portal automaticamente).'}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground break-words">{corporateSource.description}</p>
                )}
                {portalStatus?.message && (
                  <p className="text-xs text-muted-foreground mt-1 break-words">{portalStatus.message}</p>
                )}
                {isTestMode() && corporatePortalConfig.isEnabled && (
                  <p className="text-xs text-amber-700 dark:text-amber-500/90 mt-1 break-words">
                    Sem URL no .env — adicione VITE_CORPORATE_PORTAL_LOGIN_URL e reinicie o servidor (npm run dev).
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
              <span
                className={`text-xs font-medium px-3 py-1.5 rounded-lg shrink-0 ${
                  portalIsConnected
                    ? 'text-success bg-success/10'
                    : portalStatus?.status === 'failed'
                      ? 'text-destructive bg-destructive/10'
                      : 'text-muted-foreground bg-muted'
                }`}
              >
                {portalConnecting && <Loader2 className="w-3 h-3 inline animate-spin mr-1" />}
                {portalBadge}
              </span>
              {portalIsConfigured ? (
                portalIsConnected ? (
                  <Button variant="outline" size="sm" onClick={handleDisconnectPortal} disabled={portalConnecting}>
                    <Unlink className="w-4 h-4 mr-1" />
                    Desconectar
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleConnectPortal} disabled={portalConnecting}>
                    {portalConnecting ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Link2 className="w-4 h-4 mr-1" />
                    )}
                    Conectar
                  </Button>
                )
              ) : (
                <Button size="sm" disabled>
                  Conectar
                </Button>
              )}
            </div>
          </div>
          {portalIsConfigured && !portalIsConnected && !automationConfigured && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-border/60">
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => void handleManualPortalConfirm()}>
                Concluí o login no portal
              </Button>
              {import.meta.env.DEV && (
                <Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto" onClick={handleDevMarkConnected}>
                  Marcar como conectado (teste)
                </Button>
              )}
            </div>
          )}

          {mobileAuthenticated && (
            <div className="rounded-xl border p-4 space-y-3
              border-success/20 bg-success/5">
              {mobileImportResult?.success && mobileImportResult.insertedCount > 0 && (
                <>
                  <p className="text-sm font-semibold text-foreground">Escala importada automaticamente!</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {mobileImportResult.insertedCount} registro(s) importado(s) do CrewRosterReport.
                  </p>
                </>
              )}
              {mobileImportResult?.duplicate && (
                <>
                  <p className="text-sm font-semibold text-foreground">Escala já importada</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Esses dados já estavam no EscalaX — nenhuma alteração foi feita.
                  </p>
                </>
              )}
              {mobileImportResult?.success === false && (
                <>
                  <p className="text-sm font-semibold text-destructive">Falha na importação do PDF</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {mobileImportResult.error ?? 'Erro ao processar o PDF. Tente importar manualmente.'}
                  </p>
                  <PdfImportDialog
                    onImportComplete={handleImportComplete}
                    trigger={
                      <Button type="button" size="sm" variant="secondary" className="w-full sm:w-auto gap-1.5">
                        <Upload className="w-4 h-4" />
                        Importar PDF manualmente
                      </Button>
                    }
                  />
                </>
              )}
              {!mobileImportResult && (
                <>
                  <p className="text-sm font-semibold text-foreground">iFlight detectado!</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Autenticado no iFlight. Navegue até CrewRosterReport — o download será capturado automaticamente,
                    ou importe o PDF manualmente.
                  </p>
                  <PdfImportDialog
                    onImportComplete={handleImportComplete}
                    trigger={
                      <Button type="button" size="sm" variant="secondary" className="w-full sm:w-auto gap-1.5">
                        <Upload className="w-4 h-4" />
                        Importar Roster Report (PDF)
                      </Button>
                    }
                  />
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => { setMobileAuthenticated(false); setMobileImportResult(null); }}
              >
                Fechar
              </Button>
            </div>
          )}

          {automationConfigured && automationError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-xs text-destructive">
              <p className="font-semibold mb-1">Falha ao contactar o worker</p>
              <p className="whitespace-pre-wrap font-mono break-all">{automationError}</p>
            </div>
          )}

          {automationConfigured && iflightWindowOpened && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  iFlight Neo aberto — como sincronizar?
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Há duas formas de trazer sua escala para o EscalaX:
                </p>
              </div>

              {/* Opção A — extensão (recomendada) */}
              <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Opção A — Extensão Chrome (sincronização automática)</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                  <li>Instale a extensão <span className="font-medium text-foreground">EscalaX — Sessão iFlight</span> no Chrome.</li>
                  <li>Faça login normalmente no iFlight Neo.</li>
                  <li>Clique no ícone da extensão na barra do Chrome.</li>
                  <li>Confirme o consentimento e clique em <span className="font-medium text-foreground">Autorizar sincronização</span>.</li>
                  <li>O EscalaX importa sua escala automaticamente.</li>
                </ol>
                <p className="text-xs text-muted-foreground">
                  A extensão captura apenas cookies de{' '}
                  <span className="font-mono text-foreground/80">portal.latam.com</span> e{' '}
                  <span className="font-mono text-foreground/80">iflightla.ibsplc.aero</span>.
                  Nenhuma senha é capturada.
                </p>
                <p className="text-xs text-muted-foreground">
                  Para instalar: abra o Chrome → Menu → Mais ferramentas → Extensões → Modo desenvolvedor →
                  {' '}Carregar sem compactação → selecione a pasta{' '}
                  <span className="font-mono text-foreground/80">browser-extension/escalax-session-capture</span>.
                </p>
              </div>

              {/* Opção B — PDF manual */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Opção B — Importação manual (PDF)</p>
                <p className="text-xs text-muted-foreground">
                  No iFlight Neo, navegue até CrewRosterReport, baixe o PDF e importe abaixo.
                </p>
                <PdfImportDialog
                  onImportComplete={handleImportComplete}
                  trigger={
                    <Button type="button" size="sm" variant="secondary" className="w-full sm:w-auto gap-1.5">
                      <Upload className="w-4 h-4" />
                      Importar Roster Report (PDF)
                    </Button>
                  }
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => setIflightWindowOpened(false)}
              >
                Fechar
              </Button>
            </div>
          )}

          {automationConfigured && (
            <AutomationStatusCard
              active
              onRosterActivated={() => {
                void refreshConnection();
                void loadLastSync();
              }}
            />
          )}

          {showAwaitingIFlightGuidance && !automationAsPrimary && (
            <div className="mt-1 pt-3 border-t border-primary/20 space-y-3 rounded-xl bg-primary/5 p-4 border border-primary/15">
              <p className="text-sm text-foreground font-semibold break-words">{CORPORATE_ROSTER_FLOW.awaitingTitle}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{CORPORATE_ROSTER_FLOW.awaitingLead}</p>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>{CORPORATE_ROSTER_FLOW.awaitingStepLogin}</li>
                <li>{CORPORATE_ROSTER_FLOW.awaitingStepSab}</li>
                <li>{CORPORATE_ROSTER_FLOW.awaitingStepIFlight}</li>
              </ul>
              <p className="text-xs text-foreground/90 font-medium">{CORPORATE_ROSTER_FLOW.awaitingReturnHint}</p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleOpenedIFlight}>
                  Já abri minha escala
                </Button>
                <PdfImportDialog
                  onImportComplete={handleImportComplete}
                  trigger={
                    <Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto">
                      <Upload className="w-4 h-4 mr-2" />
                      Importar CrewRosterReport
                    </Button>
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full sm:w-auto text-muted-foreground"
                  onClick={() => navigate('/home')}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  {CORPORATE_ROSTER_FLOW.voltar}
                </Button>
              </div>
            </div>
          )}

          {showImportAfterIFlight && !automationAsPrimary && (
            <div className="mt-1 pt-3 border-t border-primary/30 space-y-3 rounded-xl bg-primary/[0.07] p-4 border border-primary/20">
              <p className="text-sm text-foreground font-semibold break-words">{CORPORATE_ROSTER_FLOW.importPrimaryTitle}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{CORPORATE_ROSTER_FLOW.importPrimaryLead}</p>
              <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-3">
                {CORPORATE_ROSTER_FLOW.importPrimaryReassurance}
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                <PdfImportDialog
                  onImportComplete={handleImportComplete}
                  trigger={
                    <Button type="button" size="sm" className="w-full sm:w-auto gap-1.5">
                      <Upload className="w-4 h-4" />
                      Importar CrewRosterReport
                    </Button>
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full sm:w-auto text-muted-foreground"
                  onClick={() => navigate('/home')}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  {CORPORATE_ROSTER_FLOW.voltar}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {iflightSource && !corporatePortalConfig.iflightEnabled && (
        <div className="flex flex-col gap-2 p-4 rounded-xl border border-dashed border-border bg-muted/20 min-w-0">
          <p className="font-medium text-foreground break-words">iFlight Crew System</p>
          <p className="text-xs text-muted-foreground">
            Módulo desabilitado. Defina VITE_IFLIGHT_PROVIDER_ENABLED=true no .env para exibir o fluxo completo.
          </p>
        </div>
      )}

      {iflightSource && corporatePortalConfig.iflightEnabled && automationConfigured && (
        <div className="flex flex-col gap-2 p-4 rounded-xl border border-border/60 bg-muted/20 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Plane className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              iFlight Crew System: o fluxo principal usa o servidor para abrir o ambiente autorizado. Este módulo continua
              disponível para referência quando necessário.
            </p>
          </div>
        </div>
      )}

      {iflightSource && corporatePortalConfig.iflightEnabled && !automationConfigured && (
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-muted/30 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Plane className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground break-words">iFlight Crew System</p>
                <p className="text-xs text-muted-foreground break-words">Sistema operacional de escala</p>
                {iflightStatus?.message && (
                  <p className="text-xs text-muted-foreground mt-1 break-words">{iflightStatus.message}</p>
                )}
              </div>
            </div>
            <span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-muted shrink-0 self-start">{iflightBadge}</span>
          </div>
          {!iflightBlocked && iflightModuleUrl && (
            <Button type="button" variant="default" size="sm" className="w-full sm:w-auto" onClick={handleOpenIFlightModule}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir módulo iFlight
            </Button>
          )}
          {!iflightBlocked && !iflightModuleUrl && (
            <p className="text-xs text-muted-foreground">Módulo preparado — integração futura de roster.</p>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="glass p-5 sm:p-6 min-w-0 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground break-words">
              {dailyMode ? 'Atualizar sua escala' : 'Fontes de escala'}
            </h3>
            <p className="text-sm text-muted-foreground break-words mt-0.5">
              {dailyMode
                ? 'Sua escala já está no EscalaX. Para uma nova versão, importe o CrewRosterReport. Portal e iFlight ficam abaixo apenas para reconfiguração.'
                : automationAsPrimary
                  ? 'Conecte-se ao iFlight Neo e importe o CrewRosterReport. Importação manual via PDF abaixo.'
                  : 'Escolha como deseja importar sua escala. O módulo iFlight depende do portal LATAM.'}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1 min-w-0 text-xs text-muted-foreground">
          {lastSync ? (
            <div className="flex items-center gap-2">
              <span className="text-success">●</span>
              Última atualização da escala: {formatDateTimeBR(lastSync)}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>○</span>
              Nenhuma escala importada ainda
            </div>
          )}
          {corporate.connectedAt && (
            <div className="flex items-center gap-2">
              <span className="text-primary">●</span>
              Última conexão corporativa: {formatDateTimeBR(corporate.connectedAt)}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 min-w-0">
        {pdfSource && pdfSource.available && !automationAsPrimary && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-border bg-background/60 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground break-words">{pdfSource.displayName}</p>
                <p className="text-xs text-muted-foreground break-words">{pdfSource.description}</p>
              </div>
            </div>
            <PdfImportDialog
              onImportComplete={handleImportComplete}
              trigger={
                <Button className="w-full sm:w-auto shrink-0">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar CrewRosterReport
                </Button>
              }
            />
          </div>
        )}

        {pdfSource && pdfSource.available && automationAsPrimary && (
          <details className="group rounded-xl border border-border/60 bg-muted/15 open:bg-muted/25 transition-colors">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden select-none">
              <span>Importar manualmente (contingência)</span>
              <ChevronRight className="w-4 h-4 shrink-0 transition-transform group-open:rotate-90 text-muted-foreground" />
            </summary>
            <div className="px-4 pb-4 pt-0 space-y-4 border-t border-border/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground break-words">{pdfSource.displayName}</p>
                    <p className="text-xs text-muted-foreground break-words">{pdfSource.description}</p>
                  </div>
                </div>
                <PdfImportDialog
                  onImportComplete={handleImportComplete}
                  trigger={
                    <Button variant="secondary" className="w-full sm:w-auto shrink-0">
                      <Upload className="w-4 h-4 mr-2" />
                      Importar PDF da escala
                    </Button>
                  }
                />
              </div>
              {user && (
                <div className="p-3 rounded-lg border border-border/60 bg-background/50 min-w-0 space-y-2">
                  <p className="text-sm font-medium text-foreground">Reprocessar último PDF autorizado</p>
                  <p className="text-xs text-muted-foreground">
                    Reprocessa o último PDF oficial já guardado (mesmo arquivo = sem alteração).
                  </p>
                  <CrewRosterQuickImportControls onImportDone={handleImportComplete} showRecentList />
                </div>
              )}
            </div>
          </details>
        )}

        {user && !automationAsPrimary && (
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 min-w-0 space-y-2">
            <p className="text-sm font-medium text-foreground">CrewRosterReport rápido</p>
            <p className="text-xs text-muted-foreground">
              Reprocessa o último PDF oficial já autorizado no armazenamento EscalaX (mesmo arquivo = “Escala já
              importada”).
            </p>
            <CrewRosterQuickImportControls onImportDone={handleImportComplete} showRecentList />
          </div>
        )}

        {manualSource && manualSource.available && (
          <Link to="/import-manual">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-border bg-background/60 min-w-0 hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground break-words">{manualSource.displayName}</p>
                  <p className="text-xs text-muted-foreground break-words">{manualSource.description}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </div>
          </Link>
        )}

        {dailyMode ? (
          <details className="group rounded-xl border border-border/60 bg-muted/15 open:bg-muted/25 transition-colors">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden select-none">
              <span>Integração corporativa (portal LATAM e iFlight)</span>
              <ChevronRight className="w-4 h-4 shrink-0 transition-transform group-open:rotate-90 text-muted-foreground" />
            </summary>
            <div className="px-3 pb-4 pt-1 space-y-3 border-t border-border/50">{integrationSection}</div>
          </details>
        ) : (
          integrationSection
        )}
      </div>
    </div>
  );
}
