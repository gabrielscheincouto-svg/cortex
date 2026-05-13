-- ============================================================
-- 029 — Policies dos buckets privados/públicos no Supabase Storage
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
    ('entregas', 'entregas', false),
    ('solicitacoes', 'solicitacoes', false),
    ('mural', 'mural', false),
    ('chat', 'chat', false),
    ('avatars', 'avatars', true),
    ('logos-orgs', 'logos-orgs', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$
DECLARE
    b TEXT;
BEGIN
    FOREACH b IN ARRAY ARRAY['entregas','solicitacoes','mural','chat','avatars','logos-orgs']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = b || '_insert'
        ) THEN
            EXECUTE format($policy$
                CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated
                WITH CHECK (
                    bucket_id = %L
                    AND (split_part(name, '/', 1))::uuid IN (
                        SELECT org_id FROM public.org_membros
                        WHERE user_id = auth.uid() AND status = 'ativo'
                    )
                )
            $policy$, b || '_insert', b);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = b || '_select'
        ) THEN
            EXECUTE format($policy$
                CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated
                USING (
                    bucket_id = %L
                    AND (
                        %L IN ('avatars','logos-orgs')
                        OR (split_part(name, '/', 1))::uuid IN (
                            SELECT org_id FROM public.org_membros
                            WHERE user_id = auth.uid() AND status = 'ativo'
                        )
                    )
                )
            $policy$, b || '_select', b, b);
        END IF;
    END LOOP;
END $$;
