-- ============================================================
-- 005 — Catálogo de obrigações fiscais e vínculo com empresas
-- ============================================================
-- obrigacoes_catalogo   tipos de obrigação (DCTFWeb, DIRBI, Balancete, IRPF, etc.)
-- obrigacao_empresa     vínculo N:N entre catálogo e empresas atendidas
--
-- O catálogo pode ser GLOBAL (mantido pelo super-admin CECOPEL, org_id NULL),
-- herdado por todos os escritórios novos, ou LOCAL (criado pelo próprio escritório).
-- ============================================================

CREATE TYPE app.departamento AS ENUM (
    'contabil',
    'fiscal',
    'pessoal',
    'societario',
    'comercial',
    'rural',
    'paralegal',
    'outro'
);

CREATE TYPE app.periodicidade AS ENUM (
    'diaria',
    'semanal',
    'quinzenal',
    'mensal',
    'bimestral',
    'trimestral',
    'quadrimestral',
    'semestral',
    'anual',
    'eventual'                                                   -- sob demanda, sem prazo regular
);

CREATE TYPE app.referencia_dia AS ENUM (
    'dia_fixo',                                                  -- dia X do mês de referência
    'dia_util_apos_competencia',                                 -- X dia útil do mês seguinte
    'ultimo_dia_util_competencia',                               -- último dia útil do próprio mês
    'data_evento'                                                -- relativo a um evento (ex: admissão + 7 dias)
);

CREATE TABLE IF NOT EXISTS public.obrigacoes_catalogo (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID REFERENCES public.orgs(id) ON DELETE CASCADE, -- NULL = global (CECOPEL)
    codigo                  CITEXT NOT NULL,                     -- 'DCTFWeb', 'DIRBI', etc. (único por org)
    nome                    TEXT NOT NULL,
    departamento            app.departamento NOT NULL,
    periodicidade           app.periodicidade NOT NULL,
    referencia_dia          app.referencia_dia NOT NULL DEFAULT 'dia_fixo',
    dia_legal               INTEGER,                             -- 1-31, ou -1 para último; ou Nº de dia útil dependendo do tipo
    dias_antes_lembrete     INTEGER NOT NULL DEFAULT 3,          -- gera alerta N dias antes do prazo
    competencia_offset      INTEGER NOT NULL DEFAULT 1,          -- entrega no mês +N em relação à competência
    multa_estimada_cents    INTEGER NOT NULL DEFAULT 0,          -- penalidade fiscal típica em caso de atraso
    tempo_estimado_minutos  INTEGER NOT NULL DEFAULT 30,         -- usado em rentabilidade e ranking
    robo_processa           BOOLEAN NOT NULL DEFAULT FALSE,      -- elegível para captura pelo robô Tauri
    regex_arquivo           TEXT,                                -- pattern do nome do arquivo gerado pelo software fiscal
    parser_tipo             TEXT,                                -- 'sped_efd', 'dctfweb', 'dirbi', 'pdf_guia', etc. (parser-side)
    descricao               TEXT,
    base_legal              TEXT,                                -- ex: "Instrução Normativa RFB 2.043/2021"
    icone                   TEXT,                                -- ti-...
    ativa                   BOOLEAN NOT NULL DEFAULT TRUE,
    publicada               BOOLEAN NOT NULL DEFAULT TRUE,       -- aparece para escritórios ativarem
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, codigo)
);

COMMENT ON TABLE  public.obrigacoes_catalogo IS 'Catálogo de tipos de obrigação. Quando org_id é NULL, é um item global mantido pela CECOPEL e herdado por todos os escritórios.';
COMMENT ON COLUMN public.obrigacoes_catalogo.regex_arquivo IS 'Expressão regular usada pelo robô Tauri para identificar arquivos desse tipo. Ex: ^DCTFWEB_(\d{14})_(\d{6})\.txt$';

CREATE INDEX IF NOT EXISTS idx_obcat_org           ON public.obrigacoes_catalogo(org_id);
CREATE INDEX IF NOT EXISTS idx_obcat_global        ON public.obrigacoes_catalogo(codigo) WHERE org_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_obcat_dept_ativa    ON public.obrigacoes_catalogo(departamento, ativa);
CREATE INDEX IF NOT EXISTS idx_obcat_robo          ON public.obrigacoes_catalogo(robo_processa) WHERE robo_processa = TRUE;

-- ─── OBRIGACAO_EMPRESA ────────────────────────────────────────
-- Vincula uma empresa a uma obrigação do catálogo.
-- Esse vínculo é o que gera entregas concretas mês a mês.
CREATE TABLE IF NOT EXISTS public.obrigacao_empresa (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    obrigacao_id    UUID NOT NULL REFERENCES public.obrigacoes_catalogo(id) ON DELETE CASCADE,
    empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    responsavel_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Overrides opcionais (caso para essa empresa o prazo seja diferente do catálogo)
    dia_legal_override          INTEGER,
    multa_estimada_cents_override INTEGER,
    inicio_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
    fim_vigencia    DATE,                                        -- NULL = enquanto atender
    ativa           BOOLEAN NOT NULL DEFAULT TRUE,
    observacoes     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, obrigacao_id)
);

CREATE INDEX IF NOT EXISTS idx_obemp_empresa       ON public.obrigacao_empresa(empresa_id);
CREATE INDEX IF NOT EXISTS idx_obemp_obrigacao     ON public.obrigacao_empresa(obrigacao_id);
CREATE INDEX IF NOT EXISTS idx_obemp_org_ativa     ON public.obrigacao_empresa(org_id, ativa);
CREATE INDEX IF NOT EXISTS idx_obemp_responsavel   ON public.obrigacao_empresa(responsavel_id) WHERE responsavel_id IS NOT NULL;
