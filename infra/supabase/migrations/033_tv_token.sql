-- ============================================================
-- 033 — Token público do modo TV por organização
-- ============================================================

ALTER TABLE public.orgs
    ADD COLUMN IF NOT EXISTS tv_token TEXT;

UPDATE public.orgs
SET tv_token = encode(gen_random_bytes(24), 'hex')
WHERE tv_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_tv_token ON public.orgs(tv_token) WHERE tv_token IS NOT NULL;
