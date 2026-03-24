# Arquitetura de Ingestão de Escala — EscalaX

## Visão Geral

A arquitetura de roster do EscalaX é modular, desacoplada e preparada para fluxo corporativo: **Portal corporativo LATAM** (autenticação/SSO) → **iFlight** (sistema de escala) → **EscalaX** (consumidor via providers autorizados).

**Sem** Gmail, scraping, engenharia reversa ou interceptação de tráfego.

---

## Estrutura

```
src/modules/roster/
├── types/
│   ├── ProviderTypes.ts   # RosterProvider, ConnectionResult, ProviderStatus, RosterSyncResult
│   ├── RosterTypes.ts     # ActiveRosterInfo, SourceType
│   └── index.ts
│
├── providers/
│   ├── RosterProvider.ts           # Classe base abstrata
│   ├── PdfProvider.ts              # Importação PDF (fallback principal)
│   ├── ManualProvider.ts           # Importação manual
│   ├── CorporatePortalProvider.ts  # Portal corporativo / SSO (estrutura)
│   ├── IFlightProvider.ts          # iFlight (placeholder)
│   └── index.ts
│
├── services/
│   ├── RosterSyncService.ts  # Orquestração de sync/import
│   ├── SessionManager.ts     # Estado de sessão por provider
│   └── ProviderRegistry.ts   # Registro de providers
│
└── ui/
    ├── RosterSourcesCard.tsx  # Seção Fontes de escala
    └── index.ts
```

---

## Contrato RosterProvider

```typescript
interface RosterProvider {
  readonly id: RosterProviderId;
  readonly name: string;

  connect(): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  getStatus(): Promise<ProviderStatus>;

  syncRoster(): Promise<RosterSyncResult>;
  importRoster?(input?: File | unknown): Promise<RosterSyncResult>;

  supportsAutoSync(): boolean;
  supportsManualImport(): boolean;

  listAvailableSources(): RosterSourceInfo[];
}
```

---

## Provider System

| Provider | ID | Função | Auto-sync | Manual Import |
|----------|-----|--------|-----------|---------------|
| PdfProvider | pdf | Upload PDF oficial | Não | Sim |
| ManualProvider | manual | Texto/arquivo | Não | Sim |
| CorporatePortalProvider | corporate_portal | Portal SSO futuro | Não | Não |
| IFlightProvider | iflight | iFlight futuro | Não | Não |

---

## SessionManager

- **Responsabilidades:** estado da conexão, sessão ativa por provider, timestamps de sync
- **SessionKind:** corporate_portal | pdf | manual | iflight
- **Métodos:** get(), set(), clear(), updateLastSync()
- **Armazenamento:** localStorage (`escalax_roster_session`)

---

## ProviderRegistry

- `getAvailableProviders()` — todos os providers
- `getProviderById(id)` — provider por ID
- `getDefaultProvider()` — PdfProvider
- `getEnabledProviders()` — providers com `available: true`
- `getAllSources()` — fontes para UI

---

## RosterSyncService

- **Seleção de provider** — por ID
- **Validação de conexão** — connect() antes de import
- **Import** — importViaPdf(), importViaManual()
- **Persistência** — imported_rosters, schedule_entries
- **Roster ativo** — apenas uma escala ativa; antigas desativadas
- **Motor regulatório** — emitRosterUpdated()

---

## O que funciona hoje

- Autenticação EscalaX
- imported_rosters, schedule_entries
- Parser PDF
- Importação manual
- Regulation engine
- Dashboard
- Histórico de importações
- Ordenação cronológica
- UX mobile e web
- Seção "Fontes de escala" com 4 opções

---

## Preparado para integração futura

- **CorporatePortalProvider** — fluxo SSO/portal corporativo
- **IFlightProvider** — sessão attach, roster sync, normalização
- **SessionManager** — sessão corporativa
- Colunas `roster_provider`, `source_type`, `last_sync_at`, `sync_status`

---

## Banco

Migração `20260325000000_roster_provider_metadata.sql`:
- roster_provider
- source_type
- last_sync_at
- sync_status

Execute antes de usar as novas colunas.

---

## Arquivos

### Removidos
- Gmail, portal como scraper, web automation (já removidos em refatoração anterior)
- CorporateProvider.ts (substituído por CorporatePortalProvider.ts)

### Criados
- src/modules/roster/providers/CorporatePortalProvider.ts
- src/modules/roster/ui/RosterSourcesCard.tsx
- src/modules/roster/ui/index.ts

### Alterados
- types/ProviderTypes.ts — contrato com `name`, `supportsManualImport`, `getStatus` async
- providers (PdfProvider, ManualProvider, IFlightProvider) — novo contrato
- ProviderRegistry — CorporatePortalProvider, getEnabledProviders
- RosterSourcesCard — corporate_portal, ícones Lock/Plane
- Migration — source_type
- components/roster/RosterSourcesCard — re-export de modules/roster/ui
