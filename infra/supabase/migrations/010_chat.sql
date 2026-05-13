-- ============================================================
-- 010 — Chat interno (DM, canais por departamento, canais vinculados)
-- ============================================================
-- chat_canais        canal (1:1, departamento, entrega-vinculado, empresa-vinculado, geral)
-- chat_membros       quem participa de cada canal + última leitura
-- chat_mensagens     mensagens (markdown, menções, anexos)
-- chat_anexos        arquivos nas mensagens
-- chat_reacoes       reações com emoji em mensagens
-- ============================================================

CREATE TYPE app.chat_canal_tipo AS ENUM (
    'dm',             -- conversa direta 1:1
    'grupo',          -- grupo privado (multiusuário)
    'departamento',   -- canal aberto do departamento (ex: #dept-contabil)
    'entrega',        -- canal vinculado a uma entrega específica
    'empresa',        -- canal vinculado a uma empresa cliente
    'geral'           -- #geral do escritório (todos vêem)
);

CREATE TABLE IF NOT EXISTS public.chat_canais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    tipo            app.chat_canal_tipo NOT NULL,
    nome            TEXT,                                        -- só para grupo/departamento/geral (DM não tem)
    descricao       TEXT,
    -- vínculos opcionais
    departamento    app.departamento,                            -- para tipo='departamento'
    entrega_id      UUID REFERENCES public.entregas(id) ON DELETE CASCADE,    -- para tipo='entrega'
    empresa_id      UUID REFERENCES public.empresas(id) ON DELETE CASCADE,    -- para tipo='empresa'
    -- metadata
    arquivado       BOOLEAN NOT NULL DEFAULT FALSE,
    criado_por_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ultima_mensagem_em TIMESTAMPTZ,                              -- atualizado por trigger para ordenação rápida
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_canais IS 'Canais de chat interno. Tipo determina semântica e regras de acesso.';
COMMENT ON COLUMN public.chat_canais.entrega_id IS 'Quando preenchido, o canal é a "discussão sobre essa entrega". Aparece na lateral da tela da entrega.';

CREATE INDEX IF NOT EXISTS idx_chat_canais_org_ult_msg ON public.chat_canais(org_id, ultima_mensagem_em DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_chat_canais_entrega    ON public.chat_canais(entrega_id) WHERE entrega_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_canais_empresa    ON public.chat_canais(empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_canais_dept       ON public.chat_canais(org_id, departamento) WHERE tipo = 'departamento';

-- ─── CHAT_MEMBROS ─────────────────────────────────────────────
CREATE TYPE app.chat_membro_papel AS ENUM ('admin', 'membro', 'convidado');

CREATE TABLE IF NOT EXISTS public.chat_membros (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    canal_id            UUID NOT NULL REFERENCES public.chat_canais(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    papel               app.chat_membro_papel NOT NULL DEFAULT 'membro',
    ultima_leitura_at   TIMESTAMPTZ,                             -- usado para mostrar contador de não-lidas
    silenciado          BOOLEAN NOT NULL DEFAULT FALSE,
    favorito            BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (canal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_membros_user_canal ON public.chat_membros(user_id, canal_id);
CREATE INDEX IF NOT EXISTS idx_chat_membros_canal      ON public.chat_membros(canal_id);

-- ─── CHAT_MENSAGENS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_mensagens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    canal_id        UUID NOT NULL REFERENCES public.chat_canais(id) ON DELETE CASCADE,
    autor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    autor_nome      TEXT,                                        -- cache
    conteudo        TEXT NOT NULL,                               -- markdown leve
    mencoes         UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],     -- users mencionados (@joao)
    replied_to_id   UUID REFERENCES public.chat_mensagens(id) ON DELETE SET NULL,
    editada_em      TIMESTAMPTZ,
    deletada_em     TIMESTAMPTZ,
    criada_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_canal_data    ON public.chat_mensagens(canal_id, criada_em DESC);
CREATE INDEX IF NOT EXISTS idx_chat_msg_org_busca     ON public.chat_mensagens USING gin (conteudo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chat_msg_mencoes       ON public.chat_mensagens USING gin (mencoes);

-- ─── CHAT_ANEXOS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_anexos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    mensagem_id     UUID NOT NULL REFERENCES public.chat_mensagens(id) ON DELETE CASCADE,
    storage_path    TEXT NOT NULL,
    nome_original   TEXT NOT NULL,
    mime_type       TEXT,
    tamanho_bytes   BIGINT NOT NULL,
    width           INTEGER,                                     -- para imagens
    height          INTEGER,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_anexos_msg ON public.chat_anexos(mensagem_id);

-- ─── CHAT_REACOES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_reacoes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    mensagem_id     UUID NOT NULL REFERENCES public.chat_mensagens(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji           TEXT NOT NULL,                               -- código (ex: 'thumbsup', 'check', 'eyes')
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (mensagem_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_chat_reacoes_msg ON public.chat_reacoes(mensagem_id);
