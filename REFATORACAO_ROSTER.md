# Refatoração: Remoção de Integrações Experimentais

## Resumo

O projeto EscalaX foi refatorado para remover completamente a arquitetura experimental de obtenção de escala via Gmail, portal LATAM, webview e scraping. O projeto está limpo, estável e preparado para futura integração oficial com o sistema iFlight.

---

## Arquivos Removidos

| Arquivo | Descrição |
|---------|-----------|
| `src/lib/gmail-import.ts` | Importação de escala via Gmail API e leitura de e-mails |
| `src/hooks/useAutoSync.ts` | Hook de auto-sync Gmail (uma vez por sessão) |
| `src/components/SyncDiagnosticCard.tsx` | UI de diagnóstico Gmail/sync |
| `src/pages/IFlightImportPage.tsx` | Página de importação via iFlight (Gmail) |
| `src/hooks/usePortalAutoSync.ts` | Hook de auto-sync portal (a cada 2 min) |
| `src/lib/portal/types.ts` | Tipos do portal |
| `src/lib/portal/connectors.ts` | Conectores portal (LATAM SSO) |
| `src/lib/portal/webview-connector.ts` | Webview/popup para login portal |
| `src/lib/services/portal-sync-service.ts` | Serviço de sincronização portal |
| `src/components/portal/PortalSyncCard.tsx` | Card de conexão ao portal |
| `src/components/portal/PortalAuthWebView.tsx` | Dialog de autenticação portal via popup |

---

## Arquivos Novos

| Arquivo | Descrição |
|---------|-----------|
| `src/modules/roster/providers/types.ts` | Contratos e tipos (RosterProvider, ConnectionStatus, etc.) |
| `src/modules/roster/providers/RosterProvider.ts` | Classe base abstrata |
| `src/modules/roster/providers/PdfRosterProvider.ts` | Provider de importação PDF |
| `src/modules/roster/providers/ManualImportProvider.ts` | Provider de importação manual (texto) |
| `src/modules/roster/providers/IFlightProvider.ts` | Stub seguro "Integração oficial ainda não disponível" |
| `src/modules/roster/providers/index.ts` | Barrel de exportação |
| `src/modules/roster/services/RosterSyncService.ts` | Serviço central (listAllSources, importViaPdf, importViaManual, getIFlightStatus) |
| `src/components/roster/RosterSourcesCard.tsx` | UI "Fontes de escala" (PDF, manual, iFlight em breve) |

---

## Arquivos Alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Adicionada rota `/import-manual` para UploadPage |
| `src/pages/DownloadRosterPage.tsx` | `PortalSyncCard` → `RosterSourcesCard` |
| `src/pages/SettingsPage.tsx` | `PortalSyncCard` → `RosterSourcesCard` |
| `src/pages/DashboardPage.tsx` | Removido `usePortalAutoSync` |
| `src/pages/UploadPage.tsx` | Removida precedência portal; redireciona para `/download-roster` |
| `src/pages/FlightSwapPage.tsx` | Removida precedência portal na seleção de roster |
| `src/hooks/useScheduleData.ts` | Removida precedência portal; usa roster ativo mais recente |
| `src/lib/pdf-import.ts` | Removida verificação portal; sempre ativa importação manual |
| `src/lib/auth-context.tsx` | Removido import de `portal/types`; constante legada para logout |

---

## Nova Arquitetura

```
src/modules/roster/
├── providers/
│   ├── types.ts          # Contratos (RosterProvider, ConnectionStatus, etc.)
│   ├── RosterProvider.ts  # Base abstrata
│   ├── PdfRosterProvider.ts
│   ├── ManualImportProvider.ts
│   ├── IFlightProvider.ts  # Stub "em breve"
│   └── index.ts
└── services/
    └── RosterSyncService.ts  # Serviço central
```

### Interface RosterProvider

- `connect()` / `disconnect()` / `getConnectionStatus()`
- `importRoster(input)` — onde aplicável
- `syncRoster()` — onde aplicável
- `listAvailableSources()` — lista fontes disponíveis

### Fluxos Ativos

1. **Importar PDF** — `PdfRosterProvider` → `importPdfFile` (fluxo existente)
2. **Importação manual** — `ManualImportProvider` → `parseMockSchedule` + Supabase
3. **iFlight** — `IFlightProvider` stub retorna "Integração oficial ainda não disponível"

---

## Banco/Supabase

- Tabelas `portal_connections` e `portal_sync_runs` continuam no schema (não usadas pelo app).
- Coluna `portal_connection_id` em `imported_rosters` permanece para compatibilidade.
- Nenhuma migração destrutiva foi aplicada; dados existentes preservados.

---

## Fluxos que Continuam Funcionando

- Autenticação
- Dashboard
- `imported_rosters` e `schedule_entries`
- Parser de PDF
- Importação manual (texto/arquivo via `/import-manual`)
- Motor regulatório
- Histórico de importações
- Flight Board
- Tela "Fontes de escala" em Baixar Escala e Configurações

---

## Notas

- Sem scraping, engenharia reversa ou autenticação em API privada.
- PDF é o fallback principal; manual como alternativa.
- Projeto pronto para futura integração oficial com iFlight.
