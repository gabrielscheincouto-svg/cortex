-- ============================================================
-- 002 — Multi-tenancy: orgs, planos, profiles e org_membros
-- ============================================================
-- A pedra fundamental. Tudo no sistema é amarrado a uma org (escritório contábil).
--
-- Modelo:
--   planos              catálogo de planos (Free, Pro, Enterprise)
--   orgs                escritórios contábeis (tenants)
--   profiles            extensão de auth.users com dados públicos
--   org_membros         qual user pertence a qual org e com qual papel
-- ============================================================

-- ─── PLANOS ────────────────────────────────────────────────────
-- Mantido pelo super-admin CECOPEL. Cada org tem 1 plano vigente.
CREATE TABLE IF NOT EXISTS public.planos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo              CITEXT NOT NULL UNIQUE,                  -- 'free' | 'pro' | 'enterprise'
    nome                TEXT NOT NULL,
    preco_mensal_cents  INTEGER NOT NULL DEFAULT 0,              -- em centavos de R$
    limite_usuarios     INTEGER,                                 -- NULL = ilimitado
    limite_empresas     INTEGER,
    limite_storage_gb   INTEGER,
    modulos_inclusos    JSONB NOT NULL DEFAULT '[]'::jsonb,      -- array de codigos de módulo
    descricao           TEXT,
    publico             BOOLEAN NOT NULL DEFAULT TRUE,           -- aparece no onboarding self-service?
    ordem               INTEGER NOT NULL DEFAULT 0,              -- exibição no pricing
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.planos IS 'Catálogo de planos comerciais oferecidos pela CECOPEL';
COMMENT ON COLUMN public.planos.modulos_inclusos IS 'Array JSON de codigos de modulo liberados (ex: ["kanban","empresas","liquidacao","dashboards"])';

CREATE INDEX IF NOT EXISTS idx_planos_publico_ordem ON public.planos(publico, ordem) WHERE publico = TRUE;

-- ─── ORGS (escritórios) ────────────────────────────────────────
CREATE TYPE app.org_status AS ENUM ('trial', 'ativo', 'suspenso', 'cancelado');

CREATE TABLE IF NOT EXISTS public.orgs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                CITEXT NOT NULL UNIQUE,                  -- para subdomínio/URL: 'cecopel', 'contadora-silva'
    nome                TEXT NOT NULL,
    cnpj                TEXT,                                    -- opcional no início (trial)
    razao_social        TEXT,
    cidade              TEXT,
    estado              CHAR(2),
    telefone            TEXT,
    email_contato       CITEXT,
    logo_url            TEXT,
    cor_primaria        TEXT NOT NULL DEFAULT '#10B981',         -- white-label
    plano_id            UUID NOT NULL REFERENCES public.planos(id),
    status              app.org_status NOT NULL DEFAULT 'trial',
    trial_ends_at       TIMESTAMPTZ,
    onboarding_completo BOOLEAN NOT NULL DEFAULT FALSE,
    criada_por          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.orgs IS 'Escritórios contábeis (tenants). Cada org tem dados, módulos e usuários isolados';
COMMENT ON COLUMN public.orgs.slug IS 'Identificador URL-safe. Usado em subdomínio (slug.cecopel.com.br) e como prefixo de paths';

CREATE INDEX IF NOT EXISTS idx_orgs_status        ON public.orgs(status);
CREATE INDEX IF NOT EXISTS idx_orgs_plano         ON public.orgs(plano_id);
CREATE INDEX IF NOT EXISTS idx_orgs_trial_ends_at ON public.orgs(trial_ends_at) WHERE status = 'trial';

-- ─── PROFILES ──────────────────────────────────────────────────
-- Extensão de auth.users com dados públicos/exibíveis.
-- Toda vez que um user é criado no auth.users, criamos uma linha aqui (trigger em 014).
CREATE TABLE IF NOT EXISTS public.profiles (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome                TEXT NOT NULL DEFAULT '',
    email               CITEXT,                                  -- denormalizado para queries rápidas
    avatar_url          TEXT,
    telefone            TEXT,
    bio                 TEXT,
    is_super_admin      BOOLEAN NOT NULL DEFAULT FALSE,          -- staff CECOPEL (você e equipe)
    current_org_id      UUID REFERENCES public.orgs(id) ON DELETE SET NULL,  -- org atualmente selecionada
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.profiles IS 'Dados de perfil estendidos de auth.users';
COMMENT ON COLUMN public.profiles.is_super_admin IS 'TRUE para staff CECOPEL — bypass de RLS e acesso global ao painel admin.cecopel.com.br';
COMMENT ON COLUMN public.profiles.current_org_id IS 'Org atualmente selecionada (caso usuário pertença a múltiplas). Usado para construir o JWT claim de tenancy.';

CREATE INDEX IF NOT EXISTS idx_profiles_email          ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_current_org    ON public.profiles(current_org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_super_admin    ON public.profiles(is_super_admin) WHERE is_super_admin = TRUE;

-- ─── ORG_MEMBROS ───────────────────────────────────────────────
-- N:N entre profiles e orgs. Define o papel do usuário em cada org.
CREATE TYPE app.org_membro_role AS ENUM (
    'admin',          -- dono / gestor do escritório
    'gerente',        -- supervisor de departamento(s)
    'contabil',       -- colaborador do dept contábil
    'fiscal',         -- colaborador do dept fiscal
    'pessoal',        -- colaborador do dept pessoal
    'societario',     -- colaborador do dept societário
    'comercial',      -- colaborador do dept comercial/financeiro
    'visualizador'    -- read-only (auditor externo, etc.)
);

CREATE TABLE IF NOT EXISTS public.org_membros (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role            app.org_membro_role NOT NULL DEFAULT 'visualizador',
    convidado_por   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    convite_token   TEXT,                                        -- token único para aceitar convite por link
    convite_expira_at TIMESTAMPTZ,
    aceito_em       TIMESTAMPTZ,
    status          app.status_basico NOT NULL DEFAULT 'ativo',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, user_id)
);

COMMENT ON TABLE  public.org_membros IS 'Vínculo user × org × role. Um user pode pertencer a múltiplas orgs (caso de revendas ou staff CECOPEL).';

CREATE INDEX IF NOT EXISTS idx_org_membros_org_user  ON public.org_membros(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_org_membros_user      ON public.org_membros(user_id);
CREATE INDEX IF NOT EXISTS idx_org_membros_convite   ON public.org_membros(convite_token) WHERE convite_token IS NOT NULL;
