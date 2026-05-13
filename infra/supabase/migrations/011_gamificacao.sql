-- ============================================================
-- 011 — Gamificação sóbria (conquistas, pontos, ranking)
-- ============================================================
-- conquistas_catalogo   catálogo de badges (Pontual de Aço, Salvador de Multa, etc.)
-- conquistas_usuario    conquistas desbloqueadas por colaborador
-- pontos_eventos        feed auditável de cada ação que gerou pontos
-- ranking_periodos      cache do ranking calculado (semanal/mensal/anual)
-- regras_pontuacao_org  override por org das regras (cada escritório ajusta sua cultura)
-- ============================================================

CREATE TYPE app.conquista_nivel AS ENUM ('bronze', 'prata', 'ouro', 'platina');

CREATE TABLE IF NOT EXISTS public.conquistas_catalogo (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES public.orgs(id) ON DELETE CASCADE,  -- NULL = global
    codigo          CITEXT NOT NULL,                             -- 'pontual_aco', 'salvador_multa', 'mestre_tributarista'
    nome            TEXT NOT NULL,
    descricao       TEXT NOT NULL,
    icone           TEXT NOT NULL,                               -- ti-shield-check, ti-certificate, etc.
    cor_ramp        TEXT NOT NULL DEFAULT 'amber',               -- ramp de cor da paleta (amber, blue, teal, ...)
    nivel           app.conquista_nivel NOT NULL DEFAULT 'bronze',
    pontos_bonus    INTEGER NOT NULL DEFAULT 50,
    criterio_codigo TEXT NOT NULL,                               -- chave do avaliador (ex: 'entregas_no_prazo_consecutivas')
    criterio_params JSONB NOT NULL DEFAULT '{}'::jsonb,          -- ex: {"meses": 6} ou {"quantidade": 50}
    publicada       BOOLEAN NOT NULL DEFAULT TRUE,
    ordem           INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, codigo)
);

COMMENT ON COLUMN public.conquistas_catalogo.criterio_codigo IS 'Identificador da regra que o backend Go executa para verificar se um usuário ganhou. Ex: entregas_no_prazo_consecutivas, nps_medio_periodo, entregas_de_tipo, ajudou_colega.';

CREATE INDEX IF NOT EXISTS idx_conq_cat_org      ON public.conquistas_catalogo(org_id);
CREATE INDEX IF NOT EXISTS idx_conq_cat_global   ON public.conquistas_catalogo(codigo) WHERE org_id IS NULL;

-- ─── CONQUISTAS_USUARIO ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conquistas_usuario (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conquista_id        UUID NOT NULL REFERENCES public.conquistas_catalogo(id) ON DELETE CASCADE,
    desbloqueada_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,      -- contexto: qual entrega/competência gerou
    notificada          BOOLEAN NOT NULL DEFAULT FALSE,
    notificada_em       TIMESTAMPTZ,
    UNIQUE (user_id, conquista_id)
);

CREATE INDEX IF NOT EXISTS idx_conq_user_org_data ON public.conquistas_usuario(org_id, user_id, desbloqueada_em DESC);

-- ─── PONTOS_EVENTOS ──────────────────────────────────────────
-- Feed auditável de TODA pontuação. Nunca atualizar/deletar; só inserir.
-- Total de pontos do usuário = SUM(pontos) WHERE user_id = X.
CREATE TYPE app.evento_pontos AS ENUM (
    'entrega_no_prazo',
    'entrega_antecipada',
    'entrega_atrasada',
    'nps_alto',                  -- avaliação 5 estrelas em solicitação
    'nps_baixo',                 -- avaliação ≤ 2 estrelas
    'nps_medio_mensal_alto',     -- bonus se média mensal ≥ 9
    'ajudou_colega',
    'mentoria',
    'conquista_desbloqueada',    -- bônus pela conquista
    'ajuste_manual',             -- gerente ajustou (com justificativa)
    'fim_de_periodo'             -- ajuste de fechamento de mês/trimestre
);

CREATE TABLE IF NOT EXISTS public.pontos_eventos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    evento              app.evento_pontos NOT NULL,
    pontos              INTEGER NOT NULL,                        -- positivo ou negativo
    referencia_tipo     TEXT,                                    -- 'entrega', 'solicitacao', 'conquista', 'manual'
    referencia_id       UUID,
    justificativa       TEXT,                                    -- obrigatória para 'ajuste_manual'
    criado_por_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- quem disparou (sistema = NULL)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pontos_user_data    ON public.pontos_eventos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pontos_org_data     ON public.pontos_eventos(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pontos_referencia   ON public.pontos_eventos(referencia_tipo, referencia_id);

-- ─── RANKING_PERIODOS ─────────────────────────────────────────
-- Cache do ranking calculado. Recalculado por worker Go ao final de cada período (ou sob demanda).
CREATE TYPE app.ranking_tipo AS ENUM ('semanal', 'mensal', 'trimestral', 'anual');

CREATE TABLE IF NOT EXISTS public.ranking_periodos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    tipo            app.ranking_tipo NOT NULL,
    periodo         TEXT NOT NULL,                               -- '2026-W19' / '2026-05' / '2026-Q2' / '2026'
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pontos          INTEGER NOT NULL,
    posicao         INTEGER NOT NULL,
    departamento    app.departamento,                            -- para rankings por dept
    calculado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, tipo, periodo, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ranking_org_periodo ON public.ranking_periodos(org_id, tipo, periodo, posicao);

-- ─── REGRAS_PONTUACAO_ORG ─────────────────────────────────────
-- Override por org das regras de pontuação. Sem registro = usa default global.
CREATE TABLE IF NOT EXISTS public.regras_pontuacao_org (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    evento          app.evento_pontos NOT NULL,
    pontos          INTEGER NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, evento)
);

COMMENT ON TABLE public.regras_pontuacao_org IS 'Permite que cada escritório ajuste quantos pontos cada ação vale, conforme cultura. Vazio = usa default global hardcoded no backend.';
