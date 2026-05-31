-- ============================================================
-- 013 — Functions auxiliares (RLS, tenancy, automações)
-- ============================================================
-- Essas funções são base do isolamento multi-tenant.
-- Toda policy RLS depende de pelo menos uma delas.
-- ============================================================

-- ─── app.current_user_id() ────────────────────────────────────
-- Atalho seguro para auth.uid(). Em algumas chamadas server-side
-- pode ser sobrescrito via SET LOCAL para impersonate.
CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID,
        auth.uid()
    );
$$;

COMMENT ON FUNCTION app.current_user_id IS 'Retorna o user_id atual. Respeita override via SET LOCAL app.current_user_id (usado pelo backend Go quando precisa rodar como outro usuário).';

-- ─── app.is_super_admin() ─────────────────────────────────────
-- TRUE se o usuário atual é staff CECOPEL (acesso global ao admin.cecopel.com.br).
CREATE OR REPLACE FUNCTION app.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT is_super_admin FROM public.profiles WHERE id = app.current_user_id()),
        FALSE
    );
$$;

COMMENT ON FUNCTION app.is_super_admin IS 'Bypass de RLS: TRUE quando o user atual é staff CECOPEL.';

-- ─── app.current_org_id() ─────────────────────────────────────
-- Retorna a org atualmente selecionada pelo user (de profiles.current_org_id).
-- O frontend é responsável por chamar /api/orgs/set-current quando o user troca de org.
CREATE OR REPLACE FUNCTION app.current_org_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('app.current_org_id', TRUE), '')::UUID,
        (SELECT current_org_id FROM public.profiles WHERE id = app.current_user_id())
    );
$$;

COMMENT ON FUNCTION app.current_org_id IS 'Org atualmente selecionada pelo user. Override por SET LOCAL para o robô/backend Go.';

-- ─── app.user_pertence_a_org(org_id) ──────────────────────────
-- TRUE se o user atual é membro ativo da org indicada.
CREATE OR REPLACE FUNCTION app.user_pertence_a_org(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.org_membros
        WHERE org_id = p_org_id
          AND user_id = app.current_user_id()
          AND status = 'ativo'
    );
$$;

-- ─── app.user_role_na_org(org_id) ─────────────────────────────
CREATE OR REPLACE FUNCTION app.user_role_na_org(p_org_id UUID)
RETURNS app.org_membro_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.org_membros
    WHERE org_id = p_org_id
      AND user_id = app.current_user_id()
      AND status = 'ativo'
    LIMIT 1;
$$;

-- ─── app.user_eh_admin_da_org(org_id) ─────────────────────────
CREATE OR REPLACE FUNCTION app.user_eh_admin_da_org(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.org_membros
        WHERE org_id = p_org_id
          AND user_id = app.current_user_id()
          AND role IN ('admin', 'gerente')
          AND status = 'ativo'
    );
$$;

-- ─── app.modulo_ativo_na_org(org_id, modulo) ──────────────────
-- TRUE se a org tem o módulo habilitado (seja por plano, seja por override).
CREATE OR REPLACE FUNCTION app.modulo_ativo_na_org(p_org_id UUID, p_modulo CITEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        COALESCE(
            -- override explícito na org_modulos vence
            (SELECT ativo FROM public.org_modulos WHERE org_id = p_org_id AND modulo = p_modulo LIMIT 1),
            -- senão verifica se o plano da org inclui o módulo
            (SELECT (p.modulos_inclusos ? p_modulo::TEXT)
             FROM public.orgs o
             JOIN public.planos p ON p.id = o.plano_id
             WHERE o.id = p_org_id),
            FALSE
        );
$$;

-- ─── app.touch_updated_at() ───────────────────────────────────
-- Trigger genérico para manter updated_at sincronizado.
CREATE OR REPLACE FUNCTION app.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- ─── app.handle_new_user() ────────────────────────────────────
-- Trigger em auth.users para criar uma linha em public.profiles automaticamente.
CREATE OR REPLACE FUNCTION app.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, nome, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- ─── app.entrega_denorm() ─────────────────────────────────────
-- Mantém empresa_id, obrigacao_id, departamento e org_id sincronizados em entregas
-- a partir do obrigacao_empresa_id (denormalização para queries rápidas).
CREATE OR REPLACE FUNCTION app.entrega_denorm()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT
        oe.org_id,
        oe.empresa_id,
        oe.obrigacao_id,
        oc.departamento
    INTO
        NEW.org_id,
        NEW.empresa_id,
        NEW.obrigacao_id,
        NEW.departamento
    FROM public.obrigacao_empresa oe
    JOIN public.obrigacoes_catalogo oc ON oc.id = oe.obrigacao_id
    WHERE oe.id = NEW.obrigacao_empresa_id;
    RETURN NEW;
END;
$$;

-- ─── app.chat_atualiza_ultima_mensagem() ──────────────────────
-- Atualiza chat_canais.ultima_mensagem_em a cada nova mensagem (para ordenar inbox).
CREATE OR REPLACE FUNCTION app.chat_atualiza_ultima_mensagem()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.chat_canais
    SET ultima_mensagem_em = NEW.criada_em,
        updated_at = now()
    WHERE id = NEW.canal_id;
    RETURN NEW;
END;
$$;

-- ─── app.entrega_evento_status() ──────────────────────────────
-- Registra um entrega_evento sempre que entregas.status muda.
CREATE OR REPLACE FUNCTION app.entrega_evento_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.entrega_eventos (org_id, entrega_id, tipo, ator_id, payload)
        VALUES (NEW.org_id, NEW.id, 'criada', app.current_user_id(), jsonb_build_object('status', NEW.status));
        RETURN NEW;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO public.entrega_eventos (org_id, entrega_id, tipo, ator_id, payload)
        VALUES (
            NEW.org_id,
            NEW.id,
            CASE NEW.status
                WHEN 'em_andamento'       THEN 'em_andamento'::app.entrega_evento_tipo
                WHEN 'aguardando_cliente' THEN 'enviada_cliente'::app.entrega_evento_tipo
                WHEN 'entregue'           THEN 'confirmada_cliente'::app.entrega_evento_tipo
                WHEN 'justificada'        THEN 'justificada'::app.entrega_evento_tipo
                WHEN 'dispensada'         THEN 'dispensada'::app.entrega_evento_tipo
                WHEN 'atrasada'           THEN 'atrasada'::app.entrega_evento_tipo
                ELSE 'comentario'::app.entrega_evento_tipo
            END,
            app.current_user_id(),
            jsonb_build_object('de', OLD.status, 'para', NEW.status)
        );
    END IF;
    RETURN NEW;
END;
$$;
