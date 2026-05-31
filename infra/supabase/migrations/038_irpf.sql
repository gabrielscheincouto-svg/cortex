-- ============================================================
-- 038 — IRPF multi-tenant
-- ============================================================

DO $$ BEGIN CREATE TYPE app.irpf_status AS ENUM ('a_iniciar','coletando','em_processamento','aguardando_cliente','entregue','em_malha','retificada','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE app.irpf_situacao_final AS ENUM ('a_restituir','a_pagar','sem_imposto'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE app.irpf_lancamento_tipo AS ENUM ('rendimento_tributavel','rendimento_isento','rendimento_exclusivo','deducao_medica','deducao_educacao','deducao_previdencia','deducao_pensao','dependente','bem_direito','divida'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.irpf_declarantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
    cpf TEXT NOT NULL,
    nome_completo TEXT NOT NULL,
    data_nascimento DATE,
    email CITEXT,
    telefone TEXT,
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, cpf)
);

CREATE TABLE IF NOT EXISTS public.irpf_declaracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    declarante_id UUID NOT NULL REFERENCES public.irpf_declarantes(id) ON DELETE CASCADE,
    exercicio INT NOT NULL,
    ano_calendario INT NOT NULL,
    status app.irpf_status NOT NULL DEFAULT 'a_iniciar',
    responsavel_id UUID REFERENCES auth.users(id),
    rendimentos_total_cents BIGINT NOT NULL DEFAULT 0,
    deducoes_total_cents BIGINT NOT NULL DEFAULT 0,
    imposto_devido_cents BIGINT NOT NULL DEFAULT 0,
    imposto_retido_cents BIGINT NOT NULL DEFAULT 0,
    saldo_cents BIGINT NOT NULL DEFAULT 0,
    situacao_final app.irpf_situacao_final,
    recibo_url TEXT,
    transmitida_em TIMESTAMPTZ,
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (declarante_id, exercicio)
);

CREATE TABLE IF NOT EXISTS public.irpf_lancamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    declaracao_id UUID NOT NULL REFERENCES public.irpf_declaracoes(id) ON DELETE CASCADE,
    tipo app.irpf_lancamento_tipo NOT NULL,
    fonte_pagadora TEXT,
    fonte_cnpj TEXT,
    descricao TEXT,
    valor_cents BIGINT NOT NULL DEFAULT 0,
    imposto_retido_cents BIGINT NOT NULL DEFAULT 0,
    documento_url TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_irpf_declarantes_org ON public.irpf_declarantes(org_id);
CREATE INDEX IF NOT EXISTS idx_irpf_declaracoes_status ON public.irpf_declaracoes(org_id, status, exercicio);
CREATE INDEX IF NOT EXISTS idx_irpf_lancamentos_decl ON public.irpf_lancamentos(declaracao_id, tipo);

ALTER TABLE public.irpf_declarantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irpf_declaracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irpf_lancamentos ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['irpf_declarantes','irpf_declaracoes','irpf_lancamentos'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t || '_all') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (app.is_super_admin() OR app.user_pertence_a_org(org_id)) WITH CHECK (app.is_super_admin() OR app.user_pertence_a_org(org_id))', t || '_all', t);
    END IF;
  END LOOP;
END $$;
