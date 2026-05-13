-- ============================================================
-- 007 — Solicitações (ticket-system cliente ↔ escritório)
-- ============================================================
-- Cliente abre via app/portal, escritório resolve. Avaliação (NPS) ao fechar.
-- Inspirado no que o Acessórias faz bem, com adições:
--   • solicitação pode estar vinculada a uma entrega específica (#aquarela · entrega #4521)
--   • SLA configurável por prioridade
-- ============================================================

CREATE TYPE app.solicitacao_status AS ENUM (
    'nova',
    'em_atendimento',
    'aguardando_cliente',    -- escritório respondeu, aguardando retorno
    'resolvida',
    'fechada',
    'cancelada'
);

CREATE TYPE app.solicitacao_prioridade AS ENUM (
    'baixa',
    'media',
    'alta',
    'muito_alta'
);

CREATE TYPE app.solicitacao_origem AS ENUM (
    'app_cliente',        -- veio do PWA
    'portal_web',         -- veio do portal antigo / new
    'email',              -- email forwarded
    'whatsapp',           -- chegou no whatsapp (futuro)
    'telefone',           -- registrada manualmente após ligação
    'interna'             -- criada pelo próprio escritório
);

CREATE TABLE IF NOT EXISTS public.solicitacoes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    empresa_id              UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
    entrega_id              UUID REFERENCES public.entregas(id) ON DELETE SET NULL,
    -- conteúdo
    assunto                 TEXT NOT NULL,
    descricao               TEXT,
    prioridade              app.solicitacao_prioridade NOT NULL DEFAULT 'media',
    status                  app.solicitacao_status NOT NULL DEFAULT 'nova',
    origem                  app.solicitacao_origem NOT NULL DEFAULT 'app_cliente',
    departamento_sugerido   app.departamento,
    -- autoria
    criada_por_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    criada_por_nome         TEXT,                                -- cache (se quem criou foi excluído)
    criada_por_email        TEXT,
    -- responsável interno
    responsavel_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    atribuida_em            TIMESTAMPTZ,
    -- SLA
    sla_resposta_horas      INTEGER NOT NULL DEFAULT 24,         -- prazo p/ primeira resposta
    sla_resolucao_horas     INTEGER NOT NULL DEFAULT 72,
    primeira_resposta_em    TIMESTAMPTZ,
    -- resolução
    resolvida_em            TIMESTAMPTZ,
    fechada_em              TIMESTAMPTZ,
    -- avaliação (NPS)
    avaliacao_estrelas      SMALLINT CHECK (avaliacao_estrelas BETWEEN 1 AND 5),
    avaliacao_comentario    TEXT,
    avaliacao_em            TIMESTAMPTZ,
    -- metadados
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solic_org_status        ON public.solicitacoes(org_id, status);
CREATE INDEX IF NOT EXISTS idx_solic_empresa           ON public.solicitacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_solic_responsavel       ON public.solicitacoes(responsavel_id) WHERE responsavel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_solic_prioridade        ON public.solicitacoes(org_id, prioridade) WHERE status IN ('nova','em_atendimento','aguardando_cliente');
CREATE INDEX IF NOT EXISTS idx_solic_entrega           ON public.solicitacoes(entrega_id) WHERE entrega_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_solic_avaliacao         ON public.solicitacoes(org_id, avaliacao_em) WHERE avaliacao_estrelas IS NOT NULL;

-- ─── SOLICITACAO_MENSAGENS ────────────────────────────────────
-- Histórico de mensagens dentro de uma solicitação (conversa).
CREATE TABLE IF NOT EXISTS public.solicitacao_mensagens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    solicitacao_id      UUID NOT NULL REFERENCES public.solicitacoes(id) ON DELETE CASCADE,
    autor_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    autor_tipo          TEXT NOT NULL CHECK (autor_tipo IN ('escritorio', 'cliente', 'sistema')),
    autor_nome          TEXT,                                    -- cache p/ histórico
    conteudo            TEXT NOT NULL,
    interna             BOOLEAN NOT NULL DEFAULT FALSE,          -- nota privada do escritório (cliente não vê)
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solic_msg_solic_data ON public.solicitacao_mensagens(solicitacao_id, criado_em);

-- ─── SOLICITACAO_ANEXOS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.solicitacao_anexos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    solicitacao_id      UUID NOT NULL REFERENCES public.solicitacoes(id) ON DELETE CASCADE,
    mensagem_id         UUID REFERENCES public.solicitacao_mensagens(id) ON DELETE CASCADE,
    storage_path        TEXT NOT NULL,
    nome_original       TEXT NOT NULL,
    mime_type           TEXT,
    tamanho_bytes       BIGINT NOT NULL,
    enviado_por_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solic_anexo_solic ON public.solicitacao_anexos(solicitacao_id);
