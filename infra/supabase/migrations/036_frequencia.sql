-- ============================================================
-- 036 — Frequência diária e fechamento mensal
-- ============================================================

DO $$ BEGIN CREATE TYPE app.frequencia_status AS ENUM ('presente', 'falta', 'folga', 'atestado', 'home_office', 'ferias'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.frequencia_diaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    status app.frequencia_status NOT NULL DEFAULT 'presente',
    horario_chegada TIME,
    minutos_atraso INT DEFAULT 0,
    justificativa TEXT,
    registrado_por_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, user_id, data)
);

CREATE TABLE IF NOT EXISTS public.frequencia_meses_fechados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    competencia CHAR(7) NOT NULL,
    fechado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    fechado_por_id UUID NOT NULL REFERENCES auth.users(id),
    UNIQUE (org_id, competencia)
);

CREATE OR REPLACE FUNCTION app.frequencia_pode_editar(p_data DATE, p_org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM public.frequencia_meses_fechados
        WHERE org_id = p_org_id AND competencia = to_char(p_data, 'YYYY-MM')
    )
    OR EXISTS (
        SELECT 1 FROM public.org_membros
        WHERE org_id = p_org_id AND user_id = app.current_user_id() AND status = 'ativo' AND role = 'admin'
    )
    OR app.is_super_admin();
$$;

ALTER TABLE public.frequencia_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequencia_meses_fechados ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='frequencia_diaria' AND policyname='freq_select') THEN
        CREATE POLICY freq_select ON public.frequencia_diaria FOR SELECT USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='frequencia_diaria' AND policyname='freq_insert') THEN
        CREATE POLICY freq_insert ON public.frequencia_diaria FOR INSERT WITH CHECK (app.user_pertence_a_org(org_id) AND app.frequencia_pode_editar(data, org_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='frequencia_diaria' AND policyname='freq_update') THEN
        CREATE POLICY freq_update ON public.frequencia_diaria FOR UPDATE
            USING (app.user_pertence_a_org(org_id) AND app.frequencia_pode_editar(data, org_id))
            WITH CHECK (app.user_pertence_a_org(org_id) AND app.frequencia_pode_editar(data, org_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='frequencia_meses_fechados' AND policyname='freq_mes_all') THEN
        CREATE POLICY freq_mes_all ON public.frequencia_meses_fechados FOR ALL
            USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
            WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));
    END IF;
END $$;
