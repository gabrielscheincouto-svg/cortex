-- ============================================================
-- 006 — Entregas (núcleo do sistema): arquivos, eventos, telemetria
-- ============================================================
-- entregas              instâncias mensais da obrigação_empresa por competência
-- entrega_arquivos      arquivos anexados (SPED, guias, recibos)
-- entrega_eventos       trilha auditável (criada/anexada/enviada/baixada/confirmada)
-- telemetria_tempo      minutos gastos por colaborador (alimenta rentabilidade e produtividade)
-- ============================================================

CREATE TYPE app.entrega_status AS ENUM (
    'pendente',           -- ainda não começou
    'em_andamento',       -- colaborador trabalhando
    'aguardando_cliente', -- arquivo pronto, aguardando confirmação do cliente
    'entregue',           -- cliente confirmou recebimento
    'justificada',        -- não entregue, mas com justificativa válida
    'dispensada',         -- não se aplica (cliente baixou empresa, etc.)
    'atrasada'            -- passou do prazo legal
);

CREATE TABLE IF NOT EXISTS public.entregas (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                      UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    obrigacao_empresa_id        UUID NOT NULL REFERENCES public.obrigacao_empresa(id) ON DELETE CASCADE,
    -- denormalizações para queries de dashboard ficarem rápidas (atualizadas via trigger)
    empresa_id                  UUID NOT NULL REFERENCES public.empresas(id),
    obrigacao_id                UUID NOT NULL REFERENCES public.obrigacoes_catalogo(id),
    departamento                app.departamento NOT NULL,
    -- período
    competencia                 CHAR(7) NOT NULL,                -- 'yyyy-MM' (ex: '2026-05')
    prazo_legal                 DATE NOT NULL,
    prazo_tecnico               DATE NOT NULL,                   -- prazo interno do escritório (geralmente < legal)
    -- status e atribuição
    status                      app.entrega_status NOT NULL DEFAULT 'pendente',
    responsavel_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- conclusão
    entregue_em                 TIMESTAMPTZ,
    entregue_por_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    confirmada_cliente_em       TIMESTAMPTZ,
    confirmada_cliente_por_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    protocolo                   TEXT,                            -- número de protocolo da Receita/etc.
    -- multa / risco
    multa_aplicada              BOOLEAN NOT NULL DEFAULT FALSE,
    multa_valor_cents           INTEGER NOT NULL DEFAULT 0,
    -- observações / justificativa
    observacoes                 TEXT,
    justificativa               TEXT,
    -- metadados
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (obrigacao_empresa_id, competencia)
);

COMMENT ON TABLE public.entregas IS 'Coração do sistema. Cada linha = 1 obrigação de 1 empresa em 1 competência. Status muda conforme arquivo chega, cliente confirma, etc.';

CREATE INDEX IF NOT EXISTS idx_entregas_org_status        ON public.entregas(org_id, status);
CREATE INDEX IF NOT EXISTS idx_entregas_org_prazo         ON public.entregas(org_id, prazo_legal);
CREATE INDEX IF NOT EXISTS idx_entregas_responsavel       ON public.entregas(responsavel_id) WHERE responsavel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entregas_empresa_compet    ON public.entregas(empresa_id, competencia);
CREATE INDEX IF NOT EXISTS idx_entregas_dept              ON public.entregas(org_id, departamento, status);
CREATE INDEX IF NOT EXISTS idx_entregas_atrasadas         ON public.entregas(org_id, prazo_legal) WHERE status NOT IN ('entregue','justificada','dispensada');

-- ─── ENTREGA_ARQUIVOS ─────────────────────────────────────────
CREATE TYPE app.arquivo_origem AS ENUM (
    'manual',         -- colaborador subiu via portal
    'robo_tauri',     -- robô local (Tauri app)
    'robo_drive',     -- conector Google Drive (futuro)
    'robo_onedrive',  -- conector OneDrive (futuro)
    'api',            -- subida via API por integração externa
    'cliente'         -- subido pela própria empresa (raro mas possível)
);

CREATE TYPE app.arquivo_tipo AS ENUM (
    'sped',           -- arquivo SPED (EFD, ECF, ECD, etc.)
    'guia',           -- guia de recolhimento (DARF, GPS, etc.)
    'recibo',         -- recibo de entrega ao fisco
    'declaracao',     -- declaração (DCTFWeb, DIRBI, etc.)
    'relatorio',      -- relatório auxiliar (balancete, razão)
    'documento',      -- documento avulso (nota, contrato, etc.)
    'outro'
);

CREATE TABLE IF NOT EXISTS public.entrega_arquivos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    entrega_id          UUID NOT NULL REFERENCES public.entregas(id) ON DELETE CASCADE,
    storage_path        TEXT NOT NULL,                           -- caminho no Supabase Storage (bucket isolado por org)
    bucket              TEXT NOT NULL DEFAULT 'entregas',
    nome_original       TEXT NOT NULL,
    tipo                app.arquivo_tipo NOT NULL DEFAULT 'documento',
    mime_type           TEXT,
    tamanho_bytes       BIGINT NOT NULL,
    hash_sha256         TEXT,                                    -- p/ deduplicação e integridade
    origem              app.arquivo_origem NOT NULL DEFAULT 'manual',
    enviado_por_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    robo_versao         TEXT,                                    -- versão do app Tauri quando origem = robo_*
    robo_hostname       TEXT,                                    -- máquina que enviou (para auditoria)
    visivel_cliente     BOOLEAN NOT NULL DEFAULT TRUE,           -- alguns arquivos são internos
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arquivos_entrega   ON public.entrega_arquivos(entrega_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_org_data  ON public.entrega_arquivos(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arquivos_hash      ON public.entrega_arquivos(hash_sha256) WHERE hash_sha256 IS NOT NULL;

-- ─── ENTREGA_EVENTOS ──────────────────────────────────────────
-- Trilha completa do que aconteceu com a entrega. Usado para auditoria, debugging e timeline.
CREATE TYPE app.entrega_evento_tipo AS ENUM (
    'criada',
    'atribuida',
    'desatribuida',
    'em_andamento',
    'arquivo_anexado',
    'arquivo_removido',
    'enviada_cliente',         -- notificação disparada
    'visualizada_cliente',     -- cliente abriu no app
    'baixada_cliente',         -- cliente baixou um arquivo
    'confirmada_cliente',      -- cliente clicou "confirmar recebimento"
    'reaberta',
    'justificada',
    'dispensada',
    'atrasada',
    'multa_aplicada',
    'comentario'
);

CREATE TABLE IF NOT EXISTS public.entrega_eventos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    entrega_id      UUID NOT NULL REFERENCES public.entregas(id) ON DELETE CASCADE,
    tipo            app.entrega_evento_tipo NOT NULL,
    ator_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL = sistema
    ator_descricao  TEXT,                                        -- 'sistema', 'robô tauri', 'cliente final', etc.
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_entrega_data ON public.entrega_eventos(entrega_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_org_tipo     ON public.entrega_eventos(org_id, tipo, criado_em DESC);

-- ─── TELEMETRIA_TEMPO ─────────────────────────────────────────
-- Minutos gastos por colaborador em uma entrega.
-- Coletado automaticamente pelo frontend (heartbeat enquanto a tela está aberta) + correção manual.
CREATE TYPE app.tempo_fonte AS ENUM ('auto', 'manual', 'import');

CREATE TABLE IF NOT EXISTS public.telemetria_tempo (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    entrega_id      UUID NOT NULL REFERENCES public.entregas(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    minutos         INTEGER NOT NULL CHECK (minutos > 0 AND minutos < 480), -- evita janelas esquecidas (> 8h)
    fonte           app.tempo_fonte NOT NULL DEFAULT 'auto',
    descricao       TEXT,                                        -- opcional, ex: "revisão final"
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tempo_entrega   ON public.telemetria_tempo(entrega_id);
CREATE INDEX IF NOT EXISTS idx_tempo_user_data ON public.telemetria_tempo(user_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_tempo_org_data  ON public.telemetria_tempo(org_id, criado_em DESC);
