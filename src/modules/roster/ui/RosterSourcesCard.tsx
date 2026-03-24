/**
 * RosterSourcesCard — Fontes de escala (PDF, manual, portal LATAM, iFlight).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  Upload,
  Cloud,
  ChevronRight,
  Lock,
  Plane,
  Loader2,
  Link2,
  Unlink,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { RosterSyncService } from '../services/RosterSyncService';
import { SessionManager } from '../services/SessionManager';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTimeBR } from '@/lib/date-utils';
import { Link } from 'react-router-dom';
import { corporatePortalConfig, isLoginUrlConfigured, isTestMode } from '@/lib/corporate-portal-config';
import type { ProviderStatus } from '../types';

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
  const { user } = useAuth();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [portalStatus, setPortalStatus] = useState<ProviderStatus | null>(null);
  const [iflightStatus, setIFlightStatus] = useState<ProviderStatus | null>(null);
  const [portalConnecting, setPortalConnecting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
    onImportComplete?.();
  }, [loadLastSync, onImportComplete]);

  const bump = useCallback(() => setRefreshTrigger((t) => t + 1), []);

  const handleConnectPortal = useCallback(async () => {
    const provider = RosterSyncService.getProviderById('corporate_portal');
    setPortalConnecting(true);
    try {
      await provider.connect();
    } finally {
      setPortalConnecting(false);
      bump();
    }
  }, [bump]);

  const handleDisconnectPortal = useCallback(async () => {
    const provider = RosterSyncService.getProviderById('corporate_portal');
    await provider.disconnect();
    bump();
  }, [bump]);

  const handleManualPortalConfirm = useCallback(() => {
    SessionManager.setCorporatePortalConnected();
    bump();
  }, [bump]);

  const handleDevMarkConnected = useCallback(() => {
    SessionManager.setCorporatePortalConnected();
    bump();
  }, [bump]);

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

  const iflightBlocked = !portalIsConnected;
  const iflightBadge = !corporatePortalConfig.iflightEnabled
    ? 'Indisponível'
    : iflightBlocked
      ? 'Bloqueado'
      : iflightModuleUrl
        ? 'Pronto para abrir'
        : 'Integração futura';

  return (
    <div className="glass p-5 sm:p-6 min-w-0 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground break-words">Fontes de escala</h3>
            <p className="text-sm text-muted-foreground break-words mt-0.5">
              Escolha como deseja importar sua escala. O módulo iFlight depende do portal LATAM.
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
        {pdfSource && pdfSource.available && (
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
                  Selecionar PDF
                </Button>
              }
            />
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
                      Portal LATAM configurado. Toque em Conectar para abrir o portal corporativo; depois confirme o
                      login no app se o retorno automático não ocorrer.
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
            {portalIsConfigured && !portalIsConnected && (
              <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-border/60">
                <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleManualPortalConfirm}>
                  Concluí o login no portal
                </Button>
                {import.meta.env.DEV && (
                  <Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto" onClick={handleDevMarkConnected}>
                    Marcar como conectado (teste)
                  </Button>
                )}
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

        {iflightSource && corporatePortalConfig.iflightEnabled && (
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
      </div>
    </div>
  );
}
