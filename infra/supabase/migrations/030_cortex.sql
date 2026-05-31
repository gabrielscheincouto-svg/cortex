-- ============================================================
-- 030 — Cortex v1: conversas, mensagens e auditoria de ferramentas
-- ============================================================

DO $$
BEGIN
    CREATE TYPE app.ai_papel AS ENUM ('user', 'assistant', 'system', 'tool');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.cortex_conversas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    titulo TEXT,
    contexto_pagina TEXT,
    arquivada BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cortex_mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    conversa_id UUID NOT NULL REFERENCES public.cortex_conversas(id) ON DELETE CASCADE,
    papel app.ai_papel NOT NULL,
    conteudo TEXT,
    tool_chamadas JSONB,
    tokens_in INT,
    tokens_out INT,
    modelo TEXT,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cortex_ferramentas_executadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversa_id UUID REFERENCES public.cortex_conversas(id) ON DELETE SET NULL,
    mensagem_id UUID REFERENCES public.cortex_mensagens(id) ON DELETE SET NULL,
    ferramenta TEXT NOT NULL,
    args JSONB,
    resultado JSONB,
    erro TEXT,
    duracao_ms INT,
    executada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cortex_conv_user ON public.cortex_conversas(org_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cortex_msg_conv ON public.cortex_mensagens(conversa_id, criada_em);
CREATE INDEX IF NOT EXISTS idx_cortex_tool_user ON public.cortex_ferramentas_executadas(org_id, user_id, executada_em DESC);

ALTER TABLE public.cortex_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cortex_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cortex_ferramentas_executadas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cortex_conversas' AND policyname='cortex_conv_select') THEN
        CREATE POLICY cortex_conv_select ON public.cortex_conversas FOR SELECT
            USING (app.is_super_admin() OR (app.user_pertence_a_org(org_id) AND user_id = app.current_user_id()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cortex_conversas' AND policyname='cortex_conv_insert') THEN
        CREATE POLICY cortex_conv_insert ON public.cortex_conversas FOR INSERT
            WITH CHECK (app.user_pertence_a_org(org_id) AND user_id = app.current_user_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cortex_conv_update') THEN
        CREATE POLICY cortex_conv_update ON public.cortex_conversas FOR UPDATE
            USING (app.is_super_admin() OR (app.user_pertence_a_org(org_id) AND user_id = app.current_user_id()))
            WITH CHECK (app.is_super_admin() OR (app.user_pertence_a_org(org_id) AND user_id = app.current_user_id()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cortex_mensagens' AND policyname='cortex_msg_select') THEN
        CREATE POLICY cortex_msg_select ON public.cortex_mensagens FOR SELECT
            USING (app.is_super_admin() OR EXISTS (
                SELECT 1 FROM public.cortex_conversas c
                WHERE c.id = conversa_id AND c.org_id = org_id AND c.user_id = app.current_user_id()
            ));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cortex_mensagens' AND policyname='cortex_msg_insert') THEN
        CREATE POLICY cortex_msg_insert ON public.cortex_mensagens FOR INSERT
            WITH CHECK (app.user_pertence_a_org(org_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cortex_ferramentas_executadas' AND policyname='cortex_tool_select') THEN
        CREATE POLICY cortex_tool_select ON public.cortex_ferramentas_executadas FOR SELECT
            USING (app.is_super_admin() OR (app.user_pertence_a_org(org_id) AND user_id = app.current_user_id()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cortex_ferramentas_executadas' AND policyname='cortex_tool_insert') THEN
        CREATE POLICY cortex_tool_insert ON public.cortex_ferramentas_executadas FOR INSERT
            WITH CHECK (app.user_pertence_a_org(org_id) AND user_id = app.current_user_id());
    END IF;
END $$;

INSERT INTO public.modulos_catalogo (codigo, nome, descricao, icone, categoria, ordem, novo)
VALUES ('ai', 'Cortex', 'Consultor de leitura com dados do escritório', 'ti-brain', 'premium', 180, TRUE)
ON CONFLICT (codigo) DO UPDATE SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    icone = EXCLUDED.icone,
    categoria = EXCLUDED.categoria,
    ordem = EXCLUDED.ordem,
    novo = EXCLUDED.novo;

UPDATE public.planos
SET modulos_inclusos = modulos_inclusos || '["ai"]'::jsonb
WHERE codigo IN ('pro', 'enterprise')
  AND NOT (modulos_inclusos ? 'ai');
