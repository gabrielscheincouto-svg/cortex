-- ============================================================
-- 041 — Cortex v4: memória persistente
-- ============================================================
-- O Cortex aprende sobre user/org ao longo das conversas. Cada fato
-- útil ("Carol prefere ver Contábil primeiro") vira uma linha em
-- cortex_memorias. Antes de cada nova resposta, as top-N memórias
-- relevantes são injetadas como contexto no system prompt.
-- Memórias com user_id NULL valem para a org inteira.
-- ============================================================

DO $$ BEGIN
    CREATE TYPE app.cortex_memoria_tipo AS ENUM (
        'fato_user',           -- "User é gerente do depto Contábil"
        'preferencia',         -- "User prefere ver Contábil filtrado primeiro"
        'rotina',              -- "User entrega DCTFWeb sempre na 2a quinzena"
        'terminologia',        -- "Usa 'fechamento' em vez de 'entrega'"
        'fato_org',            -- "O escritório atende mais Simples Nacional"
        'cliente_chave',       -- "Aquarela é cliente premium, NPS 9"
        'contexto_temporario'  -- "Carol está em férias até 25/05"
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.cortex_memorias (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = memória da org inteira
    tipo                app.cortex_memoria_tipo NOT NULL,
    fato                TEXT NOT NULL,
    confianca           NUMERIC(3,2) NOT NULL DEFAULT 0.80,
    origem_conversa_id  UUID REFERENCES public.cortex_conversas(id) ON DELETE SET NULL,
    origem_mensagem_id  UUID REFERENCES public.cortex_mensagens(id) ON DELETE SET NULL,
    expira_em           TIMESTAMPTZ,                                       -- NULL = não expira
    revisada_em         TIMESTAMPTZ,                                       -- user confirmou que ainda é válida
    arquivada           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (confianca >= 0 AND confianca <= 1)
);

CREATE INDEX IF NOT EXISTS idx_cortex_memorias_user
    ON public.cortex_memorias (org_id, user_id, tipo, confianca DESC)
    WHERE NOT arquivada;
CREATE INDEX IF NOT EXISTS idx_cortex_memorias_org
    ON public.cortex_memorias (org_id, tipo, confianca DESC)
    WHERE user_id IS NULL AND NOT arquivada;

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION app.touch_cortex_memoria_updated() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cortex_memorias_updated ON public.cortex_memorias;
CREATE TRIGGER trg_cortex_memorias_updated
    BEFORE UPDATE ON public.cortex_memorias
    FOR EACH ROW EXECUTE FUNCTION app.touch_cortex_memoria_updated();

ALTER TABLE public.cortex_memorias ENABLE ROW LEVEL SECURITY;

-- RLS:
-- — SELECT: super_admin OU (memória do user atual) OU (memória da org)
-- — INSERT/UPDATE/DELETE: super_admin OU dono da memória OU admin da org (para fatos_org)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cortex_memorias' AND policyname='cortex_mem_select') THEN
        CREATE POLICY cortex_mem_select ON public.cortex_memorias FOR SELECT
            USING (
                app.is_super_admin()
                OR (
                    app.user_pertence_a_org(org_id)
                    AND (user_id = app.current_user_id() OR user_id IS NULL)
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cortex_memorias' AND policyname='cortex_mem_write_user') THEN
        CREATE POLICY cortex_mem_write_user ON public.cortex_memorias FOR ALL
            USING (
                app.is_super_admin()
                OR (user_id = app.current_user_id() AND app.user_pertence_a_org(org_id))
            )
            WITH CHECK (
                app.is_super_admin()
                OR (user_id = app.current_user_id() AND app.user_pertence_a_org(org_id))
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cortex_memorias' AND policyname='cortex_mem_write_org') THEN
        CREATE POLICY cortex_mem_write_org ON public.cortex_memorias FOR ALL
            USING (
                app.is_super_admin()
                OR (user_id IS NULL AND app.user_eh_admin_da_org(org_id))
            )
            WITH CHECK (
                app.is_super_admin()
                OR (user_id IS NULL AND app.user_eh_admin_da_org(org_id))
            );
    END IF;
END $$;

-- ─── Adiciona lembrar_fato + esquecer_fato nas permissões de tools ─────────
INSERT INTO public.cortex_permissoes_org (org_id, ferramenta, permitida, roles_permitidas)
SELECT o.id, 'lembrar_fato',  TRUE,
       ARRAY['admin','gerente','contabil','fiscal','pessoal','societario','comercial','visualizador']::app.org_membro_role[]
FROM public.orgs o
ON CONFLICT (org_id, ferramenta) DO NOTHING;

INSERT INTO public.cortex_permissoes_org (org_id, ferramenta, permitida, roles_permitidas)
SELECT o.id, 'esquecer_fato', TRUE,
       ARRAY['admin','gerente','contabil','fiscal','pessoal','societario','comercial','visualizador']::app.org_membro_role[]
FROM public.orgs o
ON CONFLICT (org_id, ferramenta) DO NOTHING;

-- Atualiza o trigger de popular_cortex_permissoes_padrao p/ incluir as duas novas tools
CREATE OR REPLACE FUNCTION app.popular_cortex_permissoes_padrao() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.cortex_permissoes_org (org_id, ferramenta, permitida, roles_permitidas) VALUES
        (NEW.id, 'criar_tarefa_kanban',    TRUE,  ARRAY['admin','gerente','contabil','fiscal','pessoal','societario','comercial']::app.org_membro_role[]),
        (NEW.id, 'mudar_status_entrega',   TRUE,  ARRAY['admin','gerente','contabil','fiscal','pessoal','societario']::app.org_membro_role[]),
        (NEW.id, 'postar_mural',           TRUE,  ARRAY['admin','gerente']::app.org_membro_role[]),
        (NEW.id, 'lancar_pontos_manual',   TRUE,  ARRAY['admin','gerente']::app.org_membro_role[]),
        (NEW.id, 'responder_solicitacao',  TRUE,  ARRAY['admin','gerente','contabil','fiscal','pessoal','societario','comercial']::app.org_membro_role[]),
        (NEW.id, 'lembrar_fato',           TRUE,  ARRAY['admin','gerente','contabil','fiscal','pessoal','societario','comercial','visualizador']::app.org_membro_role[]),
        (NEW.id, 'esquecer_fato',          TRUE,  ARRAY['admin','gerente','contabil','fiscal','pessoal','societario','comercial','visualizador']::app.org_membro_role[])
    ON CONFLICT (org_id, ferramenta) DO NOTHING;
    RETURN NEW;
END $$;
