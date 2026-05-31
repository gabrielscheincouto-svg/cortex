-- ============================================================
-- 031 — Configuração de departamentos e modo de premiação
-- ============================================================

DO $$
BEGIN
    CREATE TYPE app.premiacao_modo AS ENUM ('automatico', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.org_departamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    codigo app.departamento NOT NULL,
    nome TEXT NOT NULL,
    gerente_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    meta_perc_no_prazo NUMERIC(5,2) DEFAULT 98.00,
    meta_dias_antecedencia INT DEFAULT 2,
    premiacao_modo app.premiacao_modo NOT NULL DEFAULT 'manual',
    descricao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, codigo)
);

ALTER TABLE public.org_departamentos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_departamentos' AND policyname='org_dept_select') THEN
        CREATE POLICY org_dept_select ON public.org_departamentos FOR SELECT
            USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_departamentos' AND policyname='org_dept_update') THEN
        CREATE POLICY org_dept_update ON public.org_departamentos FOR UPDATE
            USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
            WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));
    END IF;
END $$;

CREATE OR REPLACE FUNCTION app.popular_departamentos_padrao() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.org_departamentos (org_id, codigo, nome, premiacao_modo, meta_perc_no_prazo)
    VALUES
        (NEW.id, 'contabil',   'Contábil',   'manual',     98),
        (NEW.id, 'fiscal',     'Fiscal',     'automatico', 98),
        (NEW.id, 'pessoal',    'Pessoal',    'automatico', 98),
        (NEW.id, 'societario', 'Societário', 'manual',     NULL),
        (NEW.id, 'comercial',  'Comercial',  'manual',     NULL)
    ON CONFLICT (org_id, codigo) DO NOTHING;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orgs_after_insert_departamentos ON public.orgs;
CREATE TRIGGER trg_orgs_after_insert_departamentos
    AFTER INSERT ON public.orgs
    FOR EACH ROW EXECUTE FUNCTION app.popular_departamentos_padrao();

INSERT INTO public.org_departamentos (org_id, codigo, nome, premiacao_modo, meta_perc_no_prazo)
SELECT o.id, d.codigo::app.departamento, d.nome, d.modo::app.premiacao_modo, d.meta
FROM public.orgs o
CROSS JOIN (VALUES
    ('contabil',   'Contábil',   'manual',     98::numeric),
    ('fiscal',     'Fiscal',     'automatico', 98::numeric),
    ('pessoal',    'Pessoal',    'automatico', 98::numeric),
    ('societario', 'Societário', 'manual',     NULL::numeric),
    ('comercial',  'Comercial',  'manual',     NULL::numeric)
) AS d(codigo, nome, modo, meta)
ON CONFLICT (org_id, codigo) DO NOTHING;
