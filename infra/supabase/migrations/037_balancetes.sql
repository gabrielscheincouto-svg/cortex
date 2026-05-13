-- ============================================================
-- 037 — Balancetes mensais e contas analíticas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.balancetes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    competencia CHAR(7) NOT NULL,
    fechado BOOLEAN NOT NULL DEFAULT FALSE,
    fechado_em TIMESTAMPTZ,
    fechado_por_id UUID REFERENCES auth.users(id),
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, competencia)
);

CREATE TABLE IF NOT EXISTS public.balancete_contas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    balancete_id UUID NOT NULL REFERENCES public.balancetes(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    grupo TEXT,
    saldo_anterior NUMERIC(18,2) NOT NULL DEFAULT 0,
    debito NUMERIC(18,2) NOT NULL DEFAULT 0,
    credito NUMERIC(18,2) NOT NULL DEFAULT 0,
    saldo_atual NUMERIC(18,2) NOT NULL DEFAULT 0,
    natureza CHAR(1) CHECK (natureza IN ('D','C')),
    ordem INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_balancete_contas_balancete ON public.balancete_contas(balancete_id);
CREATE INDEX IF NOT EXISTS idx_balancete_contas_org ON public.balancete_contas(org_id);
CREATE INDEX IF NOT EXISTS idx_balancete_empresa_compet ON public.balancetes(empresa_id, competencia DESC);

ALTER TABLE public.balancetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balancete_contas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='balancetes' AND policyname='balancetes_all') THEN
    CREATE POLICY balancetes_all ON public.balancetes FOR ALL
      USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
      WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='balancete_contas' AND policyname='balancete_contas_all') THEN
    CREATE POLICY balancete_contas_all ON public.balancete_contas FOR ALL
      USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
      WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));
  END IF;
END $$;
