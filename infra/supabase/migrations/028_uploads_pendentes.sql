-- ============================================================
-- 028 — Uploads pendentes para fluxo assinado no Supabase Storage
-- ============================================================

DO $$
BEGIN
    CREATE TYPE app.upload_contexto AS ENUM (
        'robo_entrega',
        'manual_entrega',
        'solicitacao',
        'mural',
        'chat',
        'avatar',
        'logo_org',
        'cliente_arquivo'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.uploads_pendentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    bucket TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    nome_original TEXT NOT NULL,
    mime_type TEXT,
    tamanho_esperado BIGINT NOT NULL,
    hash_sha256_esperado TEXT,
    contexto app.upload_contexto NOT NULL,
    contexto_id UUID,
    contexto_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    expira_em TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '15 minutes',
    confirmado_em TIMESTAMPTZ,
    cancelado_em TIMESTAMPTZ,
    erro TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uploads_pend_open ON public.uploads_pendentes(expira_em)
    WHERE confirmado_em IS NULL AND cancelado_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_uploads_org_data ON public.uploads_pendentes(org_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_uploads_storage_path ON public.uploads_pendentes(bucket, storage_path);

ALTER TABLE public.uploads_pendentes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'uploads_pendentes' AND policyname = 'uploads_pend_select'
    ) THEN
        CREATE POLICY uploads_pend_select ON public.uploads_pendentes FOR SELECT
            USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'uploads_pendentes' AND policyname = 'uploads_pend_insert'
    ) THEN
        CREATE POLICY uploads_pend_insert ON public.uploads_pendentes FOR INSERT
            WITH CHECK (app.user_pertence_a_org(org_id));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.mural_anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.mural_posts(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    nome_original TEXT NOT NULL,
    mime_type TEXT,
    tamanho_bytes BIGINT NOT NULL,
    enviado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mural_anexos_post ON public.mural_anexos(post_id);
CREATE INDEX IF NOT EXISTS idx_mural_anexos_org_data ON public.mural_anexos(org_id, criado_em DESC);
