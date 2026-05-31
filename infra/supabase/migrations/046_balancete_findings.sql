-- ============================================================
-- 046 — Auditoria do balancete (findings + justificativa)
-- ============================================================
-- Esteira: o funcionário só consegue LIQUIDAR o mês contábil de uma empresa
-- depois que a auditoria passou. A auditoria roda 5 regras + bate-DRE sobre
-- public.balancete_contas e grava achados em balancete_findings.
--
-- Para cada finding o funcionário pode:
--   (a) JUSTIFICAR — informa por que aquele "erro" está correto
--   (b) CORRIGIR — re-importa o balancete e roda a auditoria de novo
--   (c) ARQUIVAR — sinaliza que vai tratar fora do sistema (raro, audit log gravado)
--
-- Quando todos os findings estão em status != 'aberto', a função
-- app.balancete_pode_liquidar() retorna TRUE e a UI libera o botão de fechar
-- o mês (que muda a célula em controle_contabil_celulas pra 'c').
-- ============================================================

-- ─── Enums ───────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE app.finding_severity AS ENUM ('warning', 'danger');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE app.finding_status AS ENUM ('aberto', 'justificado', 'corrigido', 'arquivado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE app.finding_tipo AS ENUM (
        'saldo_invertido',      -- Ativo com saldo credor ou Passivo/PL com saldo devedor
        'variacao_extrema',     -- Mudança >150% mês-a-mês
        'conta_reativada',      -- Conta zerada voltou com saldo relevante
        'outlier_estatistico',  -- >2.5σ acima da média histórica
        'receita_zerada',       -- 3.1.x zerada mas tem histórico
        'despesa_atipica',      -- 3x acima da média histórica
        'bate_dre_divergente'   -- Resumo do balancete ≠ DRE calculado das contas
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Tabela balancete_findings ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.balancete_findings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    balancete_id        UUID NOT NULL REFERENCES public.balancetes(id) ON DELETE CASCADE,
    severity            app.finding_severity NOT NULL,
    tipo                app.finding_tipo NOT NULL,
    titulo              TEXT NOT NULL,
    descricao           TEXT NOT NULL,
    conta_codigo        TEXT,                                         -- classificacao da conta (ex: "3.1.01.001")
    conta_descricao     TEXT,
    valor_referencia    NUMERIC(18,2),                                -- valor focal do achado
    contexto            JSONB NOT NULL DEFAULT '{}'::jsonb,            -- ex: { "previous_value": ..., "media": ..., "sigma": ... }

    status              app.finding_status NOT NULL DEFAULT 'aberto',
    justificativa       TEXT,
    resolvido_por_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolvido_em        TIMESTAMPTZ,

    -- Idempotência da auditoria: ao rodar de novo, descarta findings já gerados
    -- com a mesma (balancete_id, tipo, conta_codigo) e gera novos. O id é regerado.
    run_token           UUID,                                         -- token da rodada que gerou (set pelo service)

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.balancete_findings IS
    'Achados de auditoria contábil em balancete importado. Cada finding precisa ser tratado (justificar/corrigir) antes de liquidar o mês.';

CREATE INDEX IF NOT EXISTS idx_balancete_findings_balancete
    ON public.balancete_findings(balancete_id);

CREATE INDEX IF NOT EXISTS idx_balancete_findings_status_org
    ON public.balancete_findings(org_id, balancete_id, status);

CREATE INDEX IF NOT EXISTS idx_balancete_findings_severity
    ON public.balancete_findings(balancete_id, severity, status);

-- FK pra profiles (PostgREST joins consistentes com outras tabelas)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'balancete_findings_resolvido_por_profiles_fkey'
    ) THEN
        ALTER TABLE public.balancete_findings
            ADD CONSTRAINT balancete_findings_resolvido_por_profiles_fkey
            FOREIGN KEY (resolvido_por_id) REFERENCES public.profiles(id)
            ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

-- Trigger de updated_at (a 014 só aplica a tabelas existentes no momento da migration dela)
DROP TRIGGER IF EXISTS trg_touch_updated_at ON public.balancete_findings;
CREATE TRIGGER trg_touch_updated_at
    BEFORE UPDATE ON public.balancete_findings
    FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.balancete_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS balancete_findings_select ON public.balancete_findings;
CREATE POLICY balancete_findings_select ON public.balancete_findings FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));

DROP POLICY IF EXISTS balancete_findings_write ON public.balancete_findings;
CREATE POLICY balancete_findings_write ON public.balancete_findings FOR ALL
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

-- ─── Helper: o balancete pode ser liquidado? ─────────────────
-- Retorna TRUE se não há findings em status 'aberto' para esse balancete.
-- Usado pela UI e pelos endpoints como guarda antes de fechar o mês.
CREATE OR REPLACE FUNCTION app.balancete_pode_liquidar(p_balancete_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, app
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM public.balancete_findings
        WHERE balancete_id = p_balancete_id
          AND status = 'aberto'
    )
$$;

COMMENT ON FUNCTION app.balancete_pode_liquidar(UUID) IS
    'Retorna TRUE quando não há findings em aberto. UI usa pra liberar o botão "Liquidar mês".';

-- ─── Helper: contagens agregadas (pra UI) ────────────────────
CREATE OR REPLACE FUNCTION app.balancete_findings_resumo(p_balancete_id UUID)
RETURNS TABLE (
    total      BIGINT,
    abertos    BIGINT,
    danger     BIGINT,
    warnings   BIGINT,
    resolvidos BIGINT
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, app
AS $$
    SELECT
        COUNT(*)                                                 AS total,
        COUNT(*) FILTER (WHERE status = 'aberto')                AS abertos,
        COUNT(*) FILTER (WHERE severity = 'danger')              AS danger,
        COUNT(*) FILTER (WHERE severity = 'warning')             AS warnings,
        COUNT(*) FILTER (WHERE status IN ('justificado','corrigido','arquivado')) AS resolvidos
    FROM public.balancete_findings
    WHERE balancete_id = p_balancete_id
$$;
