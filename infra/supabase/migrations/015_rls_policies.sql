-- ============================================================
-- 015 — Row Level Security (RLS) — isolamento por org
-- ============================================================
-- Princípio: toda tabela com org_id só permite acesso quando:
--   1) user é super_admin (staff CECOPEL), OU
--   2) user pertence à org daquela linha
--
-- A policy é DEFENSIVA: por default, o Postgres bloqueia tudo.
-- Daí as queries do backend SEMPRE filtram por org_id automaticamente.
-- ============================================================

-- Helper macro: liga RLS na tabela e adiciona policies-padrão.
-- Como Postgres não tem macro, escrevemos manualmente por tabela.

-- ─── PROFILES ─────────────────────────────────────────────────
-- Cada usuário vê o próprio profile.
-- Super-admin vê todos.
-- Membros de uma org vêem perfis de outros membros da mesma org (para autocomplete, mentions).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles FOR SELECT
    USING (
        id = app.current_user_id()
        OR app.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.org_membros m1
            JOIN public.org_membros m2 ON m1.org_id = m2.org_id
            WHERE m1.user_id = app.current_user_id() AND m2.user_id = profiles.id
        )
    );

CREATE POLICY profiles_update ON public.profiles FOR UPDATE
    USING (id = app.current_user_id() OR app.is_super_admin())
    WITH CHECK (id = app.current_user_id() OR app.is_super_admin());

CREATE POLICY profiles_insert ON public.profiles FOR INSERT
    WITH CHECK (id = app.current_user_id() OR app.is_super_admin());

-- ─── PLANOS ───────────────────────────────────────────────────
-- Todo mundo pode ler planos públicos (para tela de pricing).
-- Só super-admin escreve.
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY planos_select ON public.planos FOR SELECT USING (publico = TRUE OR app.is_super_admin());
CREATE POLICY planos_write_admin ON public.planos FOR ALL USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

-- ─── MODULOS_CATALOGO ─────────────────────────────────────────
ALTER TABLE public.modulos_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY modulos_select ON public.modulos_catalogo FOR SELECT USING (TRUE);
CREATE POLICY modulos_write_admin ON public.modulos_catalogo FOR ALL USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

-- ─── ORGS ─────────────────────────────────────────────────────
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

CREATE POLICY orgs_select ON public.orgs FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(id));

CREATE POLICY orgs_update ON public.orgs FOR UPDATE
    USING (app.is_super_admin() OR app.user_eh_admin_da_org(id))
    WITH CHECK (app.is_super_admin() OR app.user_eh_admin_da_org(id));

CREATE POLICY orgs_insert ON public.orgs FOR INSERT
    WITH CHECK (app.is_super_admin() OR criada_por = app.current_user_id());

CREATE POLICY orgs_delete ON public.orgs FOR DELETE USING (app.is_super_admin());

-- ─── ORG_MEMBROS ──────────────────────────────────────────────
ALTER TABLE public.org_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_membros_select ON public.org_membros FOR SELECT
    USING (
        app.is_super_admin()
        OR user_id = app.current_user_id()
        OR app.user_pertence_a_org(org_id)
    );

CREATE POLICY org_membros_write ON public.org_membros FOR ALL
    USING (app.is_super_admin() OR app.user_eh_admin_da_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_eh_admin_da_org(org_id));

-- ─── ORG_MODULOS ──────────────────────────────────────────────
ALTER TABLE public.org_modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_modulos_select ON public.org_modulos FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY org_modulos_write ON public.org_modulos FOR ALL
    USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

-- ─── ASSINATURAS & FATURAS ────────────────────────────────────
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY assinaturas_select ON public.assinaturas FOR SELECT
    USING (app.is_super_admin() OR app.user_eh_admin_da_org(org_id));
CREATE POLICY assinaturas_write ON public.assinaturas FOR ALL
    USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY faturas_select ON public.faturas FOR SELECT
    USING (app.is_super_admin() OR app.user_eh_admin_da_org(org_id));
CREATE POLICY faturas_write ON public.faturas FOR ALL
    USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

-- ─── EMPRESAS, RESPONSAVEIS, USUARIOS FINAIS ──────────────────
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresas_select ON public.empresas FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY empresas_write ON public.empresas FOR ALL
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

ALTER TABLE public.empresa_responsaveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY emp_resp_select ON public.empresa_responsaveis FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY emp_resp_write ON public.empresa_responsaveis FOR ALL
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

ALTER TABLE public.empresa_usuarios_finais ENABLE ROW LEVEL SECURITY;
CREATE POLICY euf_select ON public.empresa_usuarios_finais FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id) OR user_id = app.current_user_id());
CREATE POLICY euf_write ON public.empresa_usuarios_finais FOR ALL
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

-- ─── OBRIGAÇÕES ───────────────────────────────────────────────
ALTER TABLE public.obrigacoes_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY obcat_select ON public.obrigacoes_catalogo FOR SELECT
    USING (org_id IS NULL OR app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY obcat_write ON public.obrigacoes_catalogo FOR ALL
    USING (
        (org_id IS NULL AND app.is_super_admin())  -- só super-admin edita catálogo global
        OR app.is_super_admin()
        OR (org_id IS NOT NULL AND app.user_eh_admin_da_org(org_id))
    )
    WITH CHECK (
        (org_id IS NULL AND app.is_super_admin())
        OR app.is_super_admin()
        OR (org_id IS NOT NULL AND app.user_eh_admin_da_org(org_id))
    );

ALTER TABLE public.obrigacao_empresa ENABLE ROW LEVEL SECURITY;
CREATE POLICY obemp_select ON public.obrigacao_empresa FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY obemp_write ON public.obrigacao_empresa FOR ALL
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

-- ─── ENTREGAS, ARQUIVOS, EVENTOS, TELEMETRIA ──────────────────
ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY entregas_select ON public.entregas FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY entregas_write ON public.entregas FOR ALL
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

ALTER TABLE public.entrega_arquivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY arquivos_select ON public.entrega_arquivos FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY arquivos_write ON public.entrega_arquivos FOR ALL
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

ALTER TABLE public.entrega_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY eventos_select ON public.entrega_eventos FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY eventos_insert ON public.entrega_eventos FOR INSERT
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));
-- eventos não permite UPDATE nem DELETE (append-only)

ALTER TABLE public.telemetria_tempo ENABLE ROW LEVEL SECURITY;
CREATE POLICY tempo_select ON public.telemetria_tempo FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY tempo_insert ON public.telemetria_tempo FOR INSERT
    WITH CHECK (app.is_super_admin() OR (user_id = app.current_user_id() AND app.user_pertence_a_org(org_id)));

-- ─── SOLICITAÇÕES ─────────────────────────────────────────────
ALTER TABLE public.solicitacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY solic_select ON public.solicitacoes FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY solic_write ON public.solicitacoes FOR ALL
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

ALTER TABLE public.solicitacao_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY solic_msg_select ON public.solicitacao_mensagens FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY solic_msg_write ON public.solicitacao_mensagens FOR ALL
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

ALTER TABLE public.solicitacao_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY solic_anx_select ON public.solicitacao_anexos FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY solic_anx_write ON public.solicitacao_anexos FOR ALL
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

-- ─── TELEMETRIA AGREGADA ──────────────────────────────────────
ALTER TABLE public.org_telemetria_dia ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_telem_select ON public.org_telemetria_dia FOR SELECT
    USING (app.is_super_admin() OR app.user_eh_admin_da_org(org_id));
CREATE POLICY org_telem_write ON public.org_telemetria_dia FOR ALL
    USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

ALTER TABLE public.platform_telemetria_dia ENABLE ROW LEVEL SECURITY;
CREATE POLICY plat_telem_all ON public.platform_telemetria_dia FOR ALL
    USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

ALTER TABLE public.robo_hosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY robo_select ON public.robo_hosts FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY robo_write ON public.robo_hosts FOR ALL
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

-- ─── MURAL ────────────────────────────────────────────────────
ALTER TABLE public.mural_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY mural_select ON public.mural_posts FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY mural_write ON public.mural_posts FOR ALL
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

ALTER TABLE public.mural_reacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY mural_reac_select ON public.mural_reacoes FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY mural_reac_write ON public.mural_reacoes FOR ALL
    USING (app.is_super_admin() OR user_id = app.current_user_id())
    WITH CHECK (user_id = app.current_user_id() AND app.user_pertence_a_org(org_id));

ALTER TABLE public.mural_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY mural_com_select ON public.mural_comentarios FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY mural_com_write ON public.mural_comentarios FOR ALL
    USING (app.is_super_admin() OR autor_id = app.current_user_id())
    WITH CHECK (app.user_pertence_a_org(org_id));

-- ─── CHAT ─────────────────────────────────────────────────────
ALTER TABLE public.chat_canais ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_canais_select ON public.chat_canais FOR SELECT
    USING (
        app.is_super_admin()
        OR EXISTS (SELECT 1 FROM public.chat_membros WHERE canal_id = chat_canais.id AND user_id = app.current_user_id())
        OR (tipo IN ('geral','departamento') AND app.user_pertence_a_org(org_id))
    );
CREATE POLICY chat_canais_write ON public.chat_canais FOR ALL
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

ALTER TABLE public.chat_membros ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_membros_select ON public.chat_membros FOR SELECT
    USING (app.is_super_admin() OR user_id = app.current_user_id() OR app.user_pertence_a_org(org_id));
CREATE POLICY chat_membros_write ON public.chat_membros FOR ALL
    USING (app.is_super_admin() OR user_id = app.current_user_id() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_msg_select ON public.chat_mensagens FOR SELECT
    USING (
        app.is_super_admin()
        OR EXISTS (SELECT 1 FROM public.chat_membros WHERE canal_id = chat_mensagens.canal_id AND user_id = app.current_user_id())
    );
CREATE POLICY chat_msg_insert ON public.chat_mensagens FOR INSERT
    WITH CHECK (
        autor_id = app.current_user_id()
        AND EXISTS (SELECT 1 FROM public.chat_membros WHERE canal_id = chat_mensagens.canal_id AND user_id = app.current_user_id())
    );
CREATE POLICY chat_msg_update ON public.chat_mensagens FOR UPDATE
    USING (autor_id = app.current_user_id() OR app.is_super_admin())
    WITH CHECK (autor_id = app.current_user_id() OR app.is_super_admin());

ALTER TABLE public.chat_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_anx_select ON public.chat_anexos FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY chat_anx_write ON public.chat_anexos FOR ALL
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));

ALTER TABLE public.chat_reacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_reac_select ON public.chat_reacoes FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY chat_reac_write ON public.chat_reacoes FOR ALL
    USING (app.is_super_admin() OR user_id = app.current_user_id())
    WITH CHECK (user_id = app.current_user_id() AND app.user_pertence_a_org(org_id));

-- ─── GAMIFICAÇÃO ──────────────────────────────────────────────
ALTER TABLE public.conquistas_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY conq_cat_select ON public.conquistas_catalogo FOR SELECT
    USING (org_id IS NULL OR app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY conq_cat_write ON public.conquistas_catalogo FOR ALL
    USING (
        (org_id IS NULL AND app.is_super_admin())
        OR (org_id IS NOT NULL AND (app.is_super_admin() OR app.user_eh_admin_da_org(org_id)))
    )
    WITH CHECK (
        (org_id IS NULL AND app.is_super_admin())
        OR (org_id IS NOT NULL AND (app.is_super_admin() OR app.user_eh_admin_da_org(org_id)))
    );

ALTER TABLE public.conquistas_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY conq_user_select ON public.conquistas_usuario FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY conq_user_insert ON public.conquistas_usuario FOR INSERT
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));
-- update permitido só para flag de notificada
CREATE POLICY conq_user_update ON public.conquistas_usuario FOR UPDATE
    USING (app.is_super_admin() OR user_id = app.current_user_id())
    WITH CHECK (app.is_super_admin() OR user_id = app.current_user_id());

ALTER TABLE public.pontos_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY pontos_select ON public.pontos_eventos FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY pontos_insert ON public.pontos_eventos FOR INSERT
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));
-- pontos_eventos é append-only (nada de update/delete via API)

ALTER TABLE public.ranking_periodos ENABLE ROW LEVEL SECURITY;
CREATE POLICY ranking_select ON public.ranking_periodos FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY ranking_write ON public.ranking_periodos FOR ALL
    USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

ALTER TABLE public.regras_pontuacao_org ENABLE ROW LEVEL SECURITY;
CREATE POLICY regras_select ON public.regras_pontuacao_org FOR SELECT
    USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY regras_write ON public.regras_pontuacao_org FOR ALL
    USING (app.is_super_admin() OR app.user_eh_admin_da_org(org_id))
    WITH CHECK (app.is_super_admin() OR app.user_eh_admin_da_org(org_id));

-- ─── AUDIT LOG ────────────────────────────────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_select ON public.audit_log FOR SELECT
    USING (
        app.is_super_admin()
        OR (org_id IS NOT NULL AND app.user_eh_admin_da_org(org_id))
    );
CREATE POLICY audit_insert ON public.audit_log FOR INSERT
    WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id));
-- audit_log é append-only
