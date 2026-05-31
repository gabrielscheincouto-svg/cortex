-- ============================================================
-- 035 — Co-responsável em entregas
-- ============================================================

ALTER TABLE public.entregas
    ADD COLUMN IF NOT EXISTS co_responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_entregas_co_responsavel ON public.entregas(co_responsavel_id)
    WHERE co_responsavel_id IS NOT NULL;
