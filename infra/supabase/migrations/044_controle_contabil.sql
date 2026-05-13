-- ============================================================
-- 044 — Controle Contábil mensal (matriz empresa × mês × status)
-- ============================================================
-- Peça operacional crítica do legado cecopel-gestao. Por mês de cada
-- empresa, registra-se a situação contábil:
--   C   = Conciliado
--   C_D = Conciliado aguardando doc
--   L   = Lançado (não conciliado)
--   D   = Doc recebido
--   S   = Suspensa (empresa sem movimento)
--   N   = Não receberá doc
-- O contador atualiza a célula com 1 clique. Meses já fechados ficam
-- bloqueados (lock_em) e exigem aprovação pra reabrir.
-- ============================================================

DO $$ BEGIN
    CREATE TYPE app.controle_status AS ENUM (
        'pendente',     -- ainda sem status atribuído (default)
        'c',            -- Conciliado
        'c_d',          -- Conciliado aguardando doc
        'l',            -- Lançado (não conciliado)
        'd',            -- Doc recebido
        's',            -- Suspensa
        'n'             -- Não receberá doc
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.controle_contabil_celulas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    ano             INT  NOT NULL CHECK (ano >= 2020 AND ano <= 2099),
    mes             INT  NOT NULL CHECK (mes BETWEEN 1 AND 12),
    status          app.controle_status NOT NULL DEFAULT 'pendente',
    observacoes     TEXT,
    atualizado_por  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_controle_org_ano       ON public.controle_contabil_celulas (org_id, ano);
CREATE INDEX IF NOT EXISTS idx_controle_empresa       ON public.controle_contabil_celulas (empresa_id, ano);
CREATE INDEX IF NOT EXISTS idx_controle_status        ON public.controle_contabil_celulas (org_id, ano, mes, status);

-- Tabela de meses fechados (lock global por org × ano × mês)
CREATE TABLE IF NOT EXISTS public.controle_contabil_meses_fechados (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    ano             INT  NOT NULL,
    mes             INT  NOT NULL CHECK (mes BETWEEN 1 AND 12),
    fechado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    fechado_por_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE (org_id, ano, mes)
);

-- FK pra profiles (PostgREST joins)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'controle_celulas_atualizado_por_profiles_fkey'
    ) THEN
        ALTER TABLE public.controle_contabil_celulas
            ADD CONSTRAINT controle_celulas_atualizado_por_profiles_fkey
            FOREIGN KEY (atualizado_por) REFERENCES public.profiles(id)
            ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'controle_meses_fechado_por_profiles_fkey'
    ) THEN
        ALTER TABLE public.controle_contabil_meses_fechados
            ADD CONSTRAINT controle_meses_fechado_por_profiles_fkey
            FOREIGN KEY (fechado_por_id) REFERENCES public.profiles(id)
            ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

-- RLS
ALTER TABLE public.controle_contabil_celulas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controle_contabil_meses_fechados  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='controle_contabil_celulas' AND policyname='controle_celulas_all') THEN
        CREATE POLICY controle_celulas_all ON public.controle_contabil_celulas FOR ALL
            USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
            WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='controle_contabil_meses_fechados' AND policyname='controle_meses_all') THEN
        CREATE POLICY controle_meses_all ON public.controle_contabil_meses_fechados FOR ALL
            USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
            WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));
    END IF;
END $$;

-- Trigger touch atualizado_em
CREATE OR REPLACE FUNCTION app.touch_controle_celula() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_controle_celula_touch ON public.controle_contabil_celulas;
CREATE TRIGGER trg_controle_celula_touch
    BEFORE UPDATE ON public.controle_contabil_celulas
    FOR EACH ROW EXECUTE FUNCTION app.touch_controle_celula();

NOTIFY pgrst, 'reload schema';
