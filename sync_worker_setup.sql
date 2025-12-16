-- Tabela para controlar o sync (se não existir)
-- Execute este SQL no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,  -- 'all', 'messages', 'conversations', etc
    last_synced_at TIMESTAMPTZ,
    last_synced_id INTEGER,
    records_synced INTEGER,
    status TEXT DEFAULT 'pending',  -- 'pending', 'running', 'success', 'error'
    error_message TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_tenant ON sync_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_entity_type ON sync_logs(entity_type);
