-- ============================================================
-- 047 — Notificações para o cliente final (PWA)
-- ============================================================
-- Quando algo acontece do lado do escritório (robô publicou uma guia, um
-- balancete foi liquidado, o escritório respondeu um chamado, etc), criamos
-- uma notificação para a empresa-cliente. O client-app (PWA) lê essas
-- notificações via Supabase direto (RLS garante o escopo) e mostra uma
-- bolinha vermelha no header + lista na home.
--
-- INSERT é responsabilidade do backend Go (confirmRoboEntrega e amigos).
-- SELECT/UPDATE (marcar lida) é responsabilidade do client-app via RLS.
-- ============================================================

-- ─── Enum de tipos ───────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE app.cliente_notificacao_tipo AS ENUM (
        'nova_guia',           -- robô publicou uma guia (DAS, DARF, ICMS, etc.)
        'novo_documento',      -- documento genérico anexado a uma entrega
        'novo_balancete',      -- balancete publicado/liquidado
        'resposta_chamado',    -- escritório respondeu uma solicitação
        'alerta_vencimento',   -- guia próxima do vencimento
        'alerta_atraso'        -- obrigação atrasada
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Tabela ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cliente_notificacoes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    empresa_id          UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo                app.cliente_notificacao_tipo NOT NULL,

    titulo              TEXT NOT NULL,
    corpo               TEXT,

    -- Refs livres por tipo (entrega_id, arquivo_id, balancete_id, solicitacao_id, etc).
    -- O frontend usa pra montar deep-links.
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- NULL = notificação pra qualquer usuário-cliente daquela empresa.
    -- Se preenchido, é dirigida a um usuário específico (ex.: sócio admin).
    destinatario_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    lida_em             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cliente_notificacoes IS
    'Notificações para os usuários do PWA cliente. INSERT pelo backend Go, SELECT/UPDATE pelo client-app via RLS.';

CREATE INDEX IF NOT EXISTS idx_cliente_notificacoes_empresa
    ON public.cliente_notificacoes(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cliente_notificacoes_nao_lidas
    ON public.cliente_notificacoes(empresa_id, created_at DESC)
    WHERE lida_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_cliente_notificacoes_destinatario
    ON public.cliente_notificacoes(destinatario_user_id, created_at DESC)
    WHERE destinatario_user_id IS NOT NULL;

-- Trigger updated_at (014 só pega tabelas existentes naquele momento)
DROP TRIGGER IF EXISTS trg_touch_updated_at ON public.cliente_notificacoes;
CREATE TRIGGER trg_touch_updated_at
    BEFORE UPDATE ON public.cliente_notificacoes
    FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.cliente_notificacoes ENABLE ROW LEVEL SECURITY;

-- SELECT: escritório vê tudo da org; cliente final vê só da empresa dele
DROP POLICY IF EXISTS cliente_notificacoes_select_escritorio ON public.cliente_notificacoes;
CREATE POLICY cliente_notificacoes_select_escritorio ON public.cliente_notificacoes FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));

DROP POLICY IF EXISTS cliente_notificacoes_select_cliente ON public.cliente_notificacoes;
CREATE POLICY cliente_notificacoes_select_cliente ON public.cliente_notificacoes FOR SELECT
    USING (
        app.user_eh_cliente_da_empresa(empresa_id)
        AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid())
    );

-- INSERT: só escritório (cliente nunca cria notificação direto)
DROP POLICY IF EXISTS cliente_notificacoes_insert_escritorio ON public.cliente_notificacoes;
CREATE POLICY cliente_notificacoes_insert_escritorio ON public.cliente_notificacoes FOR INSERT
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

-- UPDATE escritório: livre dentro do org (pode atualizar payload, retitular, marcar lida).
DROP POLICY IF EXISTS cliente_notificacoes_update_escritorio ON public.cliente_notificacoes;
CREATE POLICY cliente_notificacoes_update_escritorio ON public.cliente_notificacoes FOR UPDATE
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

-- UPDATE cliente: só pode marcar lida_em (não mexe em título/corpo).
-- A guarda WITH CHECK + trigger garante que outros campos não mudem.
DROP POLICY IF EXISTS cliente_notificacoes_update_cliente_lida ON public.cliente_notificacoes;
CREATE POLICY cliente_notificacoes_update_cliente_lida ON public.cliente_notificacoes FOR UPDATE
    USING (
        app.user_eh_cliente_da_empresa(empresa_id)
        AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid())
    )
    WITH CHECK (
        app.user_eh_cliente_da_empresa(empresa_id)
        AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid())
    );

-- Trigger de defesa: cliente só pode mexer em lida_em.
-- Se for cliente (não pertence à org), bloqueia mudança em qualquer outro campo.
CREATE OR REPLACE FUNCTION app.tg_cliente_notificacoes_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
    -- Se o user atual NÃO é membro da org, é cliente final — proibido mudar campos sensíveis
    IF NOT app.user_pertence_a_org(NEW.org_id) AND NOT app.is_super_admin() THEN
        IF NEW.titulo IS DISTINCT FROM OLD.titulo
            OR NEW.corpo IS DISTINCT FROM OLD.corpo
            OR NEW.tipo IS DISTINCT FROM OLD.tipo
            OR NEW.payload IS DISTINCT FROM OLD.payload
            OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
            OR NEW.org_id IS DISTINCT FROM OLD.org_id
            OR NEW.destinatario_user_id IS DISTINCT FROM OLD.destinatario_user_id THEN
            RAISE EXCEPTION 'cliente só pode atualizar lida_em' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cliente_notificacoes_guard ON public.cliente_notificacoes;
CREATE TRIGGER trg_cliente_notificacoes_guard
    BEFORE UPDATE ON public.cliente_notificacoes
    FOR EACH ROW EXECUTE FUNCTION app.tg_cliente_notificacoes_guard();

-- ─── Helper para contar não-lidas de uma empresa ─────────────
CREATE OR REPLACE FUNCTION app.cliente_notificacoes_nao_lidas(p_empresa_id UUID)
RETURNS BIGINT
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, app
AS $$
    SELECT COUNT(*)
    FROM public.cliente_notificacoes
    WHERE empresa_id = p_empresa_id
      AND lida_em IS NULL
      AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid())
$$;
