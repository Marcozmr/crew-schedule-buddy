-- roster_provider, source_type, last_sync_at, sync_status em imported_rosters
-- Migração idempotente para suportar nova arquitetura de providers

ALTER TABLE imported_rosters
ADD COLUMN IF NOT EXISTS roster_provider text;

ALTER TABLE imported_rosters
ADD COLUMN IF NOT EXISTS source_type text;

ALTER TABLE imported_rosters
ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;

ALTER TABLE imported_rosters
ADD COLUMN IF NOT EXISTS sync_status text;

COMMENT ON COLUMN imported_rosters.roster_provider IS 'Provider: pdf, manual, corporate_portal, iflight';
COMMENT ON COLUMN imported_rosters.source_type IS 'Tipo da fonte: pdf, manual, corporate_portal, iflight';
COMMENT ON COLUMN imported_rosters.last_sync_at IS 'Última sincronização bem-sucedida';
COMMENT ON COLUMN imported_rosters.sync_status IS 'Status: pending, success, error';
