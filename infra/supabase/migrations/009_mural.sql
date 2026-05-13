-- ============================================================
-- 009 — Mural interno do escritório (timeline de comunicação)
-- ============================================================
-- mural_posts          posts no mural (humano ou sistema, fixado opcional)
-- mural_reacoes        curtidas e confirmações de leitura
-- mural_comentarios    threads de comentário em cada post
-- ============================================================

CREATE TYPE app.mural_autor_tipo AS ENUM ('humano', 'sistema');

CREATE TYPE app.mural_categoria AS ENUM (
    'aviso',          -- comunicado geral
    'importante',     -- destacado em amarelo
    'celebracao',     -- aniversário, conquista, posse de cliente
    'documento',      -- compartilhamento de documento
    'sistema'         -- post automático (ranking, conquista de alguém, etc.)
);

CREATE TABLE IF NOT EXISTS public.mural_posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    autor_tipo      app.mural_autor_tipo NOT NULL DEFAULT 'humano',
    autor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL para autor_tipo='sistema'
    autor_nome      TEXT,                                        -- cache para casos sistêmicos ou autor removido
    categoria       app.mural_categoria NOT NULL DEFAULT 'aviso',
    titulo          TEXT,                                        -- opcional, posts curtos não precisam
    conteudo        TEXT NOT NULL,                               -- markdown
    fixado          BOOLEAN NOT NULL DEFAULT FALSE,
    requer_confirmacao BOOLEAN NOT NULL DEFAULT FALSE,           -- gestor pode marcar "preciso saber quem viu"
    departamentos   app.departamento[],                          -- NULL ou vazio = visível para todos
    expira_em       TIMESTAMPTZ,                                 -- post some do feed após esse momento
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mural_org_data       ON public.mural_posts(org_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mural_org_fixado     ON public.mural_posts(org_id, fixado) WHERE fixado = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mural_org_categoria  ON public.mural_posts(org_id, categoria);
CREATE INDEX IF NOT EXISTS idx_mural_busca          ON public.mural_posts USING gin (conteudo gin_trgm_ops);

-- ─── MURAL_REACOES ────────────────────────────────────────────
CREATE TYPE app.mural_reacao_tipo AS ENUM (
    'confirmou_leitura',     -- "tô ciente"
    'curtiu',                -- gostei
    'parabens',              -- congrats (usado em celebrações)
    'duvida'                 -- tenho uma pergunta
);

CREATE TABLE IF NOT EXISTS public.mural_reacoes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    post_id     UUID NOT NULL REFERENCES public.mural_posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo        app.mural_reacao_tipo NOT NULL DEFAULT 'confirmou_leitura',
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (post_id, user_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_mural_reacoes_post ON public.mural_reacoes(post_id);
CREATE INDEX IF NOT EXISTS idx_mural_reacoes_user ON public.mural_reacoes(user_id);

-- ─── MURAL_COMENTARIOS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mural_comentarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    post_id         UUID NOT NULL REFERENCES public.mural_posts(id) ON DELETE CASCADE,
    autor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    autor_nome      TEXT,                                        -- cache
    conteudo        TEXT NOT NULL,
    parent_id       UUID REFERENCES public.mural_comentarios(id) ON DELETE CASCADE, -- thread
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mural_com_post ON public.mural_comentarios(post_id, created_at) WHERE deleted_at IS NULL;
