-- ============================================================
-- 008 — Telemetria agregada por org (alimenta dashboards)
-- ============================================================
-- Cache diário de métricas por escritório.
-- Atualizado por workers em Go (cron diário) lendo as tabelas de entregas, solicitações, etc.
-- Existe para evitar agregações pesadas em tempo real toda vez que o dashboard abre.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_telemetria_dia (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                      UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    data                        DATE NOT NULL,
    -- usuários
    usuarios_ativos_7d          INTEGER NOT NULL DEFAULT 0,
    usuarios_ativos_30d         INTEGER NOT NULL DEFAULT 0,
    usuarios_total              INTEGER NOT NULL DEFAULT 0,
    -- empresas atendidas
    empresas_ativas             INTEGER NOT NULL DEFAULT 0,
    empresas_total              INTEGER NOT NULL DEFAULT 0,
    -- entregas
    entregas_processadas_dia    INTEGER NOT NULL DEFAULT 0,
    entregas_no_prazo_dia       INTEGER NOT NULL DEFAULT 0,
    entregas_atrasadas_dia      INTEGER NOT NULL DEFAULT 0,
    entregas_pendentes_total    INTEGER NOT NULL DEFAULT 0,
    entregas_atrasadas_total    INTEGER NOT NULL DEFAULT 0,
    -- robô
    arquivos_via_robo_dia       INTEGER NOT NULL DEFAULT 0,
    -- comunicação
    solicitacoes_abertas        INTEGER NOT NULL DEFAULT 0,
    solicitacoes_resolvidas_dia INTEGER NOT NULL DEFAULT 0,
    tempo_resposta_medio_horas  NUMERIC(8,2),
    nps_medio_30d               NUMERIC(4,2),
    -- storage
    storage_usado_bytes         BIGINT NOT NULL DEFAULT 0,
    -- financeiro (uso no painel do escritório)
    honorarios_total_cents      BIGINT NOT NULL DEFAULT 0,
    -- meta
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, data)
);

COMMENT ON TABLE public.org_telemetria_dia IS 'Snapshot diário de métricas por escritório. Alimenta dashboards do super-admin e do admin da org.';

CREATE INDEX IF NOT EXISTS idx_telem_org_data ON public.org_telemetria_dia(org_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_telem_data     ON public.org_telemetria_dia(data DESC);

-- ─── PLATFORM_TELEMETRIA_DIA ──────────────────────────────────
-- Métricas globais da plataforma (uso interno do super-admin CECOPEL).
CREATE TABLE IF NOT EXISTS public.platform_telemetria_dia (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data                        DATE NOT NULL UNIQUE,
    orgs_ativas                 INTEGER NOT NULL DEFAULT 0,
    orgs_trial                  INTEGER NOT NULL DEFAULT 0,
    orgs_pagantes               INTEGER NOT NULL DEFAULT 0,
    mrr_total_cents             BIGINT NOT NULL DEFAULT 0,
    arr_total_cents             BIGINT NOT NULL DEFAULT 0,
    churn_30d                   NUMERIC(5,2),                    -- % de orgs que cancelaram nos últimos 30 dias
    activations_30d             INTEGER NOT NULL DEFAULT 0,      -- trials → pagantes nos últimos 30 dias
    novos_signups_dia           INTEGER NOT NULL DEFAULT 0,
    -- uso
    entregas_total_dia          INTEGER NOT NULL DEFAULT 0,
    storage_total_bytes         BIGINT NOT NULL DEFAULT 0,
    robos_ativos                INTEGER NOT NULL DEFAULT 0,      -- quantos hosts Tauri se conectaram nas últimas 24h
    -- saúde
    api_p95_ms                  INTEGER,                         -- p95 do tempo de resposta da API Go
    api_erros_5xx_dia           INTEGER NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_telemetria_dia IS 'Métricas agregadas da plataforma inteira. Só super-admin CECOPEL acessa.';

CREATE INDEX IF NOT EXISTS idx_plat_telem_data ON public.platform_telemetria_dia(data DESC);

-- ─── ROBO_HOSTS ───────────────────────────────────────────────
-- Registro de instalações do robô Tauri.
CREATE TABLE IF NOT EXISTS public.robo_hosts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    hostname            TEXT NOT NULL,
    sistema_operacional TEXT,                                    -- 'darwin', 'windows', 'linux'
    versao_app          TEXT,                                    -- '0.3.1'
    pasta_monitorada    TEXT,                                    -- caminho local (informativo, não usado por nós)
    primeiro_visto_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultimo_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    arquivos_enviados   INTEGER NOT NULL DEFAULT 0,
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (org_id, hostname)
);

CREATE INDEX IF NOT EXISTS idx_robo_hosts_org       ON public.robo_hosts(org_id, ativo);
CREATE INDEX IF NOT EXISTS idx_robo_hosts_heartbeat ON public.robo_hosts(ultimo_heartbeat_at DESC);
