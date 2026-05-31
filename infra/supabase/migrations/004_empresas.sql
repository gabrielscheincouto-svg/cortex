-- ============================================================
-- 004 — Empresas (clientes do escritório) e responsáveis
-- ============================================================
-- "Empresa" aqui = empresa atendida pelo escritório (cliente final do escritório).
-- Não confundir com "org" (que é o próprio escritório contábil).
-- ============================================================

CREATE TYPE app.regime_tributario AS ENUM (
    'simples_nacional',
    'lucro_presumido',
    'lucro_real',
    'mei',
    'imune_isenta',
    'produtor_rural',
    'fora_simples'
);

CREATE TYPE app.empresa_status AS ENUM ('ativa', 'baixada', 'suspensa', 'em_analise');

CREATE TABLE IF NOT EXISTS public.empresas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    codigo_interno      TEXT,                                    -- código do escritório (livre, ex: "823")
    razao_social        TEXT NOT NULL,
    nome_fantasia       TEXT,
    cnpj                TEXT,                                    -- 14 dígitos sem máscara; opcional para MEI sem inscrição
    cpf                 TEXT,                                    -- para autônomos
    inscricao_estadual  TEXT,
    inscricao_municipal TEXT,
    regime_tributario   app.regime_tributario,
    cnae_principal      TEXT,
    data_abertura       DATE,
    data_inicio_servico DATE,                                    -- desde quando o escritório atende
    email               CITEXT,
    telefone            TEXT,
    whatsapp            TEXT,
    endereco_logradouro TEXT,
    endereco_numero     TEXT,
    endereco_complemento TEXT,
    endereco_bairro     TEXT,
    cidade              TEXT,
    estado              CHAR(2),
    cep                 TEXT,
    honorario_mensal_cents INTEGER NOT NULL DEFAULT 0,           -- valor do contrato com o escritório (para dashboard rentabilidade)
    status              app.empresa_status NOT NULL DEFAULT 'ativa',
    tags                TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], -- ex: ['grupo-B', 'cliente-vip']
    observacoes         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, cnpj),                                       -- cnpj único por escritório
    UNIQUE (org_id, codigo_interno)
);

COMMENT ON TABLE  public.empresas IS 'Empresas atendidas pelo escritório (clientes finais do escritório).';
COMMENT ON COLUMN public.empresas.honorario_mensal_cents IS 'Valor cobrado mensalmente pelo escritório. Alimenta dashboards de rentabilidade.';

CREATE INDEX IF NOT EXISTS idx_empresas_org              ON public.empresas(org_id);
CREATE INDEX IF NOT EXISTS idx_empresas_org_status       ON public.empresas(org_id, status);
CREATE INDEX IF NOT EXISTS idx_empresas_cnpj             ON public.empresas(cnpj);
CREATE INDEX IF NOT EXISTS idx_empresas_razao_trgm       ON public.empresas USING gin (razao_social gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_empresas_fantasia_trgm    ON public.empresas USING gin (nome_fantasia gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_empresas_tags             ON public.empresas USING gin (tags);

-- ─── EMPRESA_RESPONSAVEIS ─────────────────────────────────────
-- Quem cuida de cada empresa, por departamento.
CREATE TABLE IF NOT EXISTS public.empresa_responsaveis (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    departamento    app.org_membro_role NOT NULL,                -- contabil/fiscal/pessoal/societario/comercial/gerente
    principal       BOOLEAN NOT NULL DEFAULT FALSE,              -- responsável principal vs auxiliar
    desde           DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, user_id, departamento)
);

CREATE INDEX IF NOT EXISTS idx_emp_resp_empresa  ON public.empresa_responsaveis(empresa_id);
CREATE INDEX IF NOT EXISTS idx_emp_resp_user     ON public.empresa_responsaveis(user_id);
CREATE INDEX IF NOT EXISTS idx_emp_resp_org_dept ON public.empresa_responsaveis(org_id, departamento);

-- Apenas 1 responsável principal por (empresa, departamento)
CREATE UNIQUE INDEX IF NOT EXISTS uq_emp_resp_principal
    ON public.empresa_responsaveis(empresa_id, departamento)
    WHERE principal = TRUE;

-- ─── EMPRESA_USUARIOS_FINAIS ──────────────────────────────────
-- Quem do lado da empresa pode logar no app/portal do cliente.
-- Pode ter múltiplos usuários por empresa (contador interno, diretor, sócio, etc.)
CREATE TYPE app.empresa_usuario_role AS ENUM (
    'titular',        -- dono/sócio principal
    'financeiro',     -- responsável financeiro da empresa
    'contador',       -- contador interno da empresa
    'visualizador'    -- só visualiza
);

CREATE TABLE IF NOT EXISTS public.empresa_usuarios_finais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- vínculo opcional com auth.users
    nome            TEXT NOT NULL,
    email           CITEXT NOT NULL,
    telefone        TEXT,
    role            app.empresa_usuario_role NOT NULL DEFAULT 'visualizador',
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    convite_enviado_em TIMESTAMPTZ,
    primeiro_login_em  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, email)
);

COMMENT ON TABLE public.empresa_usuarios_finais IS 'Usuários do lado da empresa-cliente que acessam o app PWA / portal do cliente.';

CREATE INDEX IF NOT EXISTS idx_euf_empresa  ON public.empresa_usuarios_finais(empresa_id);
CREATE INDEX IF NOT EXISTS idx_euf_email    ON public.empresa_usuarios_finais(email);
CREATE INDEX IF NOT EXISTS idx_euf_user     ON public.empresa_usuarios_finais(user_id) WHERE user_id IS NOT NULL;
