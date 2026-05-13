-- ============================================================
-- 040 — Cortex v3: agente que age (action proposals com confirmação)
-- ============================================================
-- Quando o user pede algo que muda dados (criar tarefa, mudar status,
-- postar no mural), o Cortex NÃO executa direto: cria uma "ação pendente"
-- que o user precisa confirmar via UI. Isso preserva a auditabilidade
-- e dá ao user controle final sobre o que o Cortex faz.
-- ============================================================

DO $$ BEGIN
    CREATE TYPE app.cortex_acao_status AS ENUM ('pendente', 'confirmada', 'cancelada', 'falhou');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.cortex_acoes_pendentes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversa_id     UUID REFERENCES public.cortex_conversas(id) ON DELETE SET NULL,
    mensagem_id     UUID REFERENCES public.cortex_mensagens(id) ON DELETE SET NULL,
    ferramenta      TEXT NOT NULL,           -- 'criar_tarefa_kanban' | 'mudar_status_entrega' | 'postar_mural' | 'lancar_pontos_manual'
    args            JSONB NOT NULL,          -- argumentos da ação proposta
    resumo          TEXT NOT NULL,           -- texto humano: "Cortex quer criar tarefa: ..."
    status          app.cortex_acao_status NOT NULL DEFAULT 'pendente',
    resultado       JSONB,                   -- resultado quando executada
    erro            TEXT,
    expira_em       TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '1 hour',
    confirmada_em   TIMESTAMPTZ,
    cancelada_em    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cortex_acoes_user ON public.cortex_acoes_pendentes(org_id, user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cortex_acoes_pendentes ON public.cortex_acoes_pendentes(expira_em) WHERE status = 'pendente';

ALTER TABLE public.cortex_acoes_pendentes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cortex_acoes_pendentes' AND policyname='cortex_acoes_all') THEN
        CREATE POLICY cortex_acoes_all ON public.cortex_acoes_pendentes FOR ALL
            USING (app.is_super_admin() OR (user_id = app.current_user_id() AND app.user_pertence_a_org(org_id)))
            WITH CHECK (app.is_super_admin() OR (user_id = app.current_user_id() AND app.user_pertence_a_org(org_id)));
    END IF;
END $$;

-- ─── Permissões por org (qual tool pode ser proposta) ──────────────────────
CREATE TABLE IF NOT EXISTS public.cortex_permissoes_org (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    ferramenta      TEXT NOT NULL,
    permitida       BOOLEAN NOT NULL DEFAULT TRUE,
    roles_permitidas app.org_membro_role[],     -- NULL = qualquer role da org
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, ferramenta)
);

ALTER TABLE public.cortex_permissoes_org ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cortex_permissoes_org' AND policyname='cortex_perm_select') THEN
        CREATE POLICY cortex_perm_select ON public.cortex_permissoes_org FOR SELECT
            USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cortex_permissoes_org' AND policyname='cortex_perm_write') THEN
        CREATE POLICY cortex_perm_write ON public.cortex_permissoes_org FOR ALL
            USING (app.is_super_admin() OR app.user_eh_admin_da_org(org_id))
            WITH CHECK (app.is_super_admin() OR app.user_eh_admin_da_org(org_id));
    END IF;
END $$;

-- Default: todas as tools de escrita permitidas para admin/gerente
CREATE OR REPLACE FUNCTION app.popular_cortex_permissoes_padrao() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.cortex_permissoes_org (org_id, ferramenta, permitida, roles_permitidas) VALUES
        (NEW.id, 'criar_tarefa_kanban',    TRUE,  ARRAY['admin','gerente','contabil','fiscal','pessoal','societario','comercial']::app.org_membro_role[]),
        (NEW.id, 'mudar_status_entrega',   TRUE,  ARRAY['admin','gerente','contabil','fiscal','pessoal','societario']::app.org_membro_role[]),
        (NEW.id, 'postar_mural',           TRUE,  ARRAY['admin','gerente']::app.org_membro_role[]),
        (NEW.id, 'lancar_pontos_manual',   TRUE,  ARRAY['admin','gerente']::app.org_membro_role[]),
        (NEW.id, 'responder_solicitacao',  TRUE,  ARRAY['admin','gerente','contabil','fiscal','pessoal','societario','comercial']::app.org_membro_role[])
    ON CONFLICT (org_id, ferramenta) DO NOTHING;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orgs_after_insert_cortex_permissoes ON public.orgs;
CREATE TRIGGER trg_orgs_after_insert_cortex_permissoes
    AFTER INSERT ON public.orgs
    FOR EACH ROW EXECUTE FUNCTION app.popular_cortex_permissoes_padrao();

-- Para orgs já existentes
INSERT INTO public.cortex_permissoes_org (org_id, ferramenta, permitida, roles_permitidas)
SELECT o.id, 'criar_tarefa_kanban',    TRUE, ARRAY['admin','gerente','contabil','fiscal','pessoal','societario','comercial']::app.org_membro_role[]
FROM public.orgs o
ON CONFLICT (org_id, ferramenta) DO NOTHING;
INSERT INTO public.cortex_permissoes_org (org_id, ferramenta, permitida, roles_permitidas)
SELECT o.id, 'mudar_status_entrega',   TRUE, ARRAY['admin','gerente','contabil','fiscal','pessoal','societario']::app.org_membro_role[]
FROM public.orgs o
ON CONFLICT (org_id, ferramenta) DO NOTHING;
INSERT INTO public.cortex_permissoes_org (org_id, ferramenta, permitida, roles_permitidas)
SELECT o.id, 'postar_mural',           TRUE, ARRAY['admin','gerente']::app.org_membro_role[]
FROM public.orgs o
ON CONFLICT (org_id, ferramenta) DO NOTHING;
INSERT INTO public.cortex_permissoes_org (org_id, ferramenta, permitida, roles_permitidas)
SELECT o.id, 'lancar_pontos_manual',   TRUE, ARRAY['admin','gerente']::app.org_membro_role[]
FROM public.orgs o
ON CONFLICT (org_id, ferramenta) DO NOTHING;
INSERT INTO public.cortex_permissoes_org (org_id, ferramenta, permitida, roles_permitidas)
SELECT o.id, 'responder_solicitacao',  TRUE, ARRAY['admin','gerente','contabil','fiscal','pessoal','societario','comercial']::app.org_membro_role[]
FROM public.orgs o
ON CONFLICT (org_id, ferramenta) DO NOTHING;
