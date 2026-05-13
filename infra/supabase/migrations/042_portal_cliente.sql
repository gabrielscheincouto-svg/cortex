-- ============================================================
-- 042 — Portal do cliente final
-- ============================================================
-- O cliente final acessa /portal/<slug_publico>/ com login próprio
-- (empresa_usuarios_finais.user_id ↔ auth.users.id).
-- Aqui adicionamos:
--   1. coluna empresas.slug_publico (UNIQUE, URL-safe)
--   2. RLS policies pra cliente final ver SUAS entregas e arquivos
--   3. helper app.user_eh_cliente_da_empresa(empresa_id)
-- ============================================================

-- ─── slug_publico em empresas ────────────────────────────────
ALTER TABLE public.empresas
    ADD COLUMN IF NOT EXISTS slug_publico TEXT UNIQUE;

-- Gera slug automaticamente se vazio (cnpj limpo como fallback)
UPDATE public.empresas
SET slug_publico = LOWER(REGEXP_REPLACE(
    COALESCE(nome_fantasia, razao_social, cnpj),
    '[^a-zA-Z0-9]+', '-', 'g'
))
WHERE slug_publico IS NULL;

CREATE INDEX IF NOT EXISTS idx_empresas_slug_publico ON public.empresas(slug_publico);

-- ─── Helper: user atual é cliente final dessa empresa? ───────
CREATE OR REPLACE FUNCTION app.user_eh_cliente_da_empresa(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, app
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.empresa_usuarios_finais
        WHERE empresa_id = p_empresa_id
          AND user_id = auth.uid()
          AND ativo = TRUE
    )
$$;

-- ─── Policies extras: cliente final lê SUAS entregas ─────────
DO $$ BEGIN
    -- Entregas
    IF NOT EXISTS (SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='entregas' AND policyname='entregas_cliente_select') THEN
        CREATE POLICY entregas_cliente_select ON public.entregas FOR SELECT
            USING (app.user_eh_cliente_da_empresa(empresa_id));
    END IF;

    -- Arquivos vinculados às entregas dele
    IF NOT EXISTS (SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='entrega_arquivos' AND policyname='entrega_arquivos_cliente_select') THEN
        CREATE POLICY entrega_arquivos_cliente_select ON public.entrega_arquivos FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.entregas e
                    WHERE e.id = entrega_id
                      AND app.user_eh_cliente_da_empresa(e.empresa_id)
                )
            );
    END IF;

    -- Solicitações da empresa dele
    IF NOT EXISTS (SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='solicitacoes' AND policyname='solicitacoes_cliente_select') THEN
        CREATE POLICY solicitacoes_cliente_select ON public.solicitacoes FOR SELECT
            USING (app.user_eh_cliente_da_empresa(empresa_id));
    END IF;

    -- Mensagens das suas solicitações (não-internas)
    IF NOT EXISTS (SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='solicitacao_mensagens' AND policyname='solicitacao_mensagens_cliente_select') THEN
        CREATE POLICY solicitacao_mensagens_cliente_select ON public.solicitacao_mensagens FOR SELECT
            USING (
                interna = FALSE AND
                EXISTS (
                    SELECT 1 FROM public.solicitacoes s
                    WHERE s.id = solicitacao_id
                      AND app.user_eh_cliente_da_empresa(s.empresa_id)
                )
            );
    END IF;

    -- Empresa: cliente lê os próprios dados básicos
    IF NOT EXISTS (SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='empresas' AND policyname='empresas_cliente_select') THEN
        CREATE POLICY empresas_cliente_select ON public.empresas FOR SELECT
            USING (app.user_eh_cliente_da_empresa(id));
    END IF;

    -- Empresa: leitura pública mínima (pra resolver slug_publico no login)
    IF NOT EXISTS (SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='empresas' AND policyname='empresas_publica_slug') THEN
        CREATE POLICY empresas_publica_slug ON public.empresas FOR SELECT
            USING (slug_publico IS NOT NULL);
    END IF;
END $$;
