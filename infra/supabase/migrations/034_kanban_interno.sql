-- ============================================================
-- 034 — Kanban interno com recorrências, checklist e comentários
-- ============================================================

DO $$ BEGIN CREATE TYPE app.kanban_status AS ENUM ('a_fazer', 'em_andamento', 'concluido', 'cancelado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE app.kanban_prioridade AS ENUM ('baixa', 'media', 'alta', 'urgente'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.kanban_recorrencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descricao TEXT,
    departamento app.departamento,
    prioridade app.kanban_prioridade NOT NULL DEFAULT 'media',
    responsavel_id UUID REFERENCES auth.users(id),
    co_responsavel_id UUID REFERENCES auth.users(id),
    periodicidade app.periodicidade NOT NULL,
    dia_semana INT,
    dia_mes INT,
    horario TIME,
    proxima_geracao DATE NOT NULL,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kanban_tarefas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descricao TEXT,
    departamento app.departamento,
    prioridade app.kanban_prioridade NOT NULL DEFAULT 'media',
    status app.kanban_status NOT NULL DEFAULT 'a_fazer',
    responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    co_responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
    prazo DATE,
    concluido_em TIMESTAMPTZ,
    recorrente_id UUID REFERENCES public.kanban_recorrencias(id) ON DELETE SET NULL,
    criada_por_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kanban_checklist_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarefa_id UUID NOT NULL REFERENCES public.kanban_tarefas(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    concluido BOOLEAN NOT NULL DEFAULT FALSE,
    ordem INT NOT NULL DEFAULT 0,
    concluido_por_id UUID REFERENCES auth.users(id),
    concluido_em TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.kanban_comentarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarefa_id UUID NOT NULL REFERENCES public.kanban_tarefas(id) ON DELETE CASCADE,
    autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    conteudo TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_tarefas_org_status ON public.kanban_tarefas(org_id, status);
CREATE INDEX IF NOT EXISTS idx_kanban_tarefas_resp ON public.kanban_tarefas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_kanban_tarefas_corep ON public.kanban_tarefas(co_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_kanban_tarefas_rec ON public.kanban_tarefas(recorrente_id) WHERE recorrente_id IS NOT NULL;

ALTER TABLE public.kanban_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_recorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_checklist_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_comentarios ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['kanban_tarefas','kanban_recorrencias'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t || '_all') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (app.is_super_admin() OR app.user_pertence_a_org(org_id)) WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id))', t || '_all', t);
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kanban_checklist_itens' AND policyname='kanban_check_all') THEN
    CREATE POLICY kanban_check_all ON public.kanban_checklist_itens FOR ALL
      USING (EXISTS (SELECT 1 FROM public.kanban_tarefas t WHERE t.id = tarefa_id AND app.user_pertence_a_org(t.org_id)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.kanban_tarefas t WHERE t.id = tarefa_id AND app.user_pertence_a_org(t.org_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kanban_comentarios' AND policyname='kanban_com_all') THEN
    CREATE POLICY kanban_com_all ON public.kanban_comentarios FOR ALL
      USING (EXISTS (SELECT 1 FROM public.kanban_tarefas t WHERE t.id = tarefa_id AND app.user_pertence_a_org(t.org_id)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.kanban_tarefas t WHERE t.id = tarefa_id AND app.user_pertence_a_org(t.org_id)));
  END IF;
END $$;
