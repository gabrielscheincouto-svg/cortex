-- ============================================================
-- 045 — Premiações: salário, cargo, regras de nível e cálculo
-- ============================================================
-- Espelha a planilha do legado:
--   Score% = pontos do mês / meta_mensal × 100
--   Nível  = BRONZE / PRATA / OURO (configurável por org)
--   Bônus  = salario_base × %bonus do nível
-- ============================================================

-- ─── Salário + cargo no vínculo org_membros ──────────────────
ALTER TABLE public.org_membros
    ADD COLUMN IF NOT EXISTS salario_base_cents INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cargo TEXT;

-- ─── Regras de níveis por org ────────────────────────────────
DO $$ BEGIN
    CREATE TYPE app.premiacao_nivel AS ENUM ('sem_nivel', 'bronze', 'prata', 'ouro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.premiacoes_regras_org (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    nivel           app.premiacao_nivel NOT NULL,
    score_minimo    INT NOT NULL CHECK (score_minimo BETWEEN 0 AND 200),
    bonus_perc      INT NOT NULL CHECK (bonus_perc BETWEEN 0 AND 200),
    meta_mensal_pts INT NOT NULL DEFAULT 100,  -- pontos pra atingir 100% Score
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, nivel)
);

ALTER TABLE public.premiacoes_regras_org ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='premiacoes_regras_org' AND policyname='premiacoes_regras_all') THEN
        CREATE POLICY premiacoes_regras_all ON public.premiacoes_regras_org FOR ALL
            USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
            WITH CHECK (app.is_super_admin() OR app.user_eh_admin_da_org(org_id));
    END IF;
END $$;

-- ─── Seed default pra todas orgs já existentes ───────────────
INSERT INTO public.premiacoes_regras_org (org_id, nivel, score_minimo, bonus_perc, meta_mensal_pts)
SELECT o.id, 'bronze'::app.premiacao_nivel, 60, 25, 100 FROM public.orgs o
ON CONFLICT (org_id, nivel) DO NOTHING;
INSERT INTO public.premiacoes_regras_org (org_id, nivel, score_minimo, bonus_perc, meta_mensal_pts)
SELECT o.id, 'prata'::app.premiacao_nivel, 80, 50, 100 FROM public.orgs o
ON CONFLICT (org_id, nivel) DO NOTHING;
INSERT INTO public.premiacoes_regras_org (org_id, nivel, score_minimo, bonus_perc, meta_mensal_pts)
SELECT o.id, 'ouro'::app.premiacao_nivel, 95, 75, 100 FROM public.orgs o
ON CONFLICT (org_id, nivel) DO NOTHING;

-- ─── Trigger pra popular regras default em novas orgs ────────
CREATE OR REPLACE FUNCTION app.popular_premiacoes_padrao() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.premiacoes_regras_org (org_id, nivel, score_minimo, bonus_perc, meta_mensal_pts) VALUES
        (NEW.id, 'bronze', 60, 25, 100),
        (NEW.id, 'prata',  80, 50, 100),
        (NEW.id, 'ouro',   95, 75, 100)
    ON CONFLICT (org_id, nivel) DO NOTHING;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orgs_premiacoes_default ON public.orgs;
CREATE TRIGGER trg_orgs_premiacoes_default
    AFTER INSERT ON public.orgs
    FOR EACH ROW EXECUTE FUNCTION app.popular_premiacoes_padrao();

-- ─── View calculadora: premiacao_mensal_view ─────────────────
-- Soma pontos do mês, calcula score, classifica nível, retorna bônus.
CREATE OR REPLACE VIEW public.premiacao_mensal_view AS
SELECT
    m.org_id,
    m.user_id,
    p.nome AS funcionario,
    m.role::text AS setor,
    COALESCE(m.cargo, m.role::text) AS cargo,
    m.salario_base_cents,
    DATE_TRUNC('month', now()) AS mes_referencia,
    COALESCE(pts.total, 0) AS pontos_mes,
    -- Score baseado na regra BRONZE da org (meta_mensal_pts) como referência
    LEAST(200, ROUND(COALESCE(pts.total, 0)::numeric / NULLIF(rb.meta_mensal_pts, 0) * 100)) AS score_perc,
    CASE
        WHEN COALESCE(pts.total, 0) >= rb.meta_mensal_pts * ro.score_minimo / 100 THEN 'ouro'
        WHEN COALESCE(pts.total, 0) >= rb.meta_mensal_pts * rp.score_minimo / 100 THEN 'prata'
        WHEN COALESCE(pts.total, 0) >= rb.meta_mensal_pts * rb.score_minimo / 100 THEN 'bronze'
        ELSE 'sem_nivel'
    END AS nivel,
    CASE
        WHEN COALESCE(pts.total, 0) >= rb.meta_mensal_pts * ro.score_minimo / 100 THEN ro.bonus_perc
        WHEN COALESCE(pts.total, 0) >= rb.meta_mensal_pts * rp.score_minimo / 100 THEN rp.bonus_perc
        WHEN COALESCE(pts.total, 0) >= rb.meta_mensal_pts * rb.score_minimo / 100 THEN rb.bonus_perc
        ELSE 0
    END AS bonus_perc,
    CASE
        WHEN COALESCE(pts.total, 0) >= rb.meta_mensal_pts * ro.score_minimo / 100 THEN m.salario_base_cents * ro.bonus_perc / 100
        WHEN COALESCE(pts.total, 0) >= rb.meta_mensal_pts * rp.score_minimo / 100 THEN m.salario_base_cents * rp.bonus_perc / 100
        WHEN COALESCE(pts.total, 0) >= rb.meta_mensal_pts * rb.score_minimo / 100 THEN m.salario_base_cents * rb.bonus_perc / 100
        ELSE 0
    END AS valor_bonus_cents
FROM public.org_membros m
JOIN public.profiles p ON p.id = m.user_id
JOIN public.premiacoes_regras_org rb ON rb.org_id = m.org_id AND rb.nivel = 'bronze'
JOIN public.premiacoes_regras_org rp ON rp.org_id = m.org_id AND rp.nivel = 'prata'
JOIN public.premiacoes_regras_org ro ON ro.org_id = m.org_id AND ro.nivel = 'ouro'
LEFT JOIN LATERAL (
    SELECT SUM(pe.pontos) AS total
    FROM public.pontos_eventos pe
    WHERE pe.user_id = m.user_id
      AND pe.org_id = m.org_id
      AND pe.created_at >= DATE_TRUNC('month', now())
      AND pe.created_at <  DATE_TRUNC('month', now()) + INTERVAL '1 month'
) pts ON TRUE
WHERE m.status = 'ativo';

NOTIFY pgrst, 'reload schema';
