-- ============================================================
-- 003 — Módulos habilitados por org e assinaturas (cobrança)
-- ============================================================
-- org_modulos    quais módulos cada escritório tem ativados (override por org)
-- assinaturas    vínculo com Stripe/Pagar.me para cobrança recorrente
-- ============================================================

-- Catálogo fixo de módulos disponíveis no sistema.
-- Cada string aqui é referenciada em planos.modulos_inclusos e em org_modulos.modulo.
-- Códigos: kanban, empresas, irpf, societario, comercial, analise, rh, premiacoes,
--          liquidacao, dashboards, chat, mural, gamificacao, robo, app_cliente, norma_ia
-- ============================================================

CREATE TABLE IF NOT EXISTS public.modulos_catalogo (
    codigo          CITEXT PRIMARY KEY,                          -- 'liquidacao', 'chat', etc.
    nome            TEXT NOT NULL,
    descricao       TEXT,
    icone           TEXT,                                        -- nome do ícone Tabler (ti-...)
    categoria       TEXT,                                        -- 'core', 'comunicacao', 'gestao', 'premium'
    novo            BOOLEAN NOT NULL DEFAULT FALSE,              -- exibir badge "Novo" no menu
    ordem           INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.modulos_catalogo IS 'Catálogo fixo de módulos do sistema. Códigos são imutáveis após criação.';

-- ─── ORG_MODULOS ──────────────────────────────────────────────
-- Liga uma org a um módulo. Por padrão o escritório herda do plano (planos.modulos_inclusos),
-- mas o super-admin pode habilitar/desabilitar módulos individuais como override.
CREATE TABLE IF NOT EXISTS public.org_modulos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    modulo          CITEXT NOT NULL REFERENCES public.modulos_catalogo(codigo),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    habilitado_por  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    motivo          TEXT,                                        -- "addon vendido", "teste", "downgrade", etc.
    expira_em       TIMESTAMPTZ,                                 -- NULL = permanente
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, modulo)
);

CREATE INDEX IF NOT EXISTS idx_org_modulos_org_ativo ON public.org_modulos(org_id, ativo);

-- ─── ASSINATURAS ──────────────────────────────────────────────
-- Estado da cobrança recorrente. Sincronizado via webhooks do Stripe/Pagar.me.
CREATE TYPE app.assinatura_status AS ENUM (
    'trial',
    'ativa',
    'pendente_pagamento',
    'inadimplente',
    'cancelada',
    'expirada'
);

CREATE TYPE app.gateway_pagamento AS ENUM ('stripe', 'pagarme', 'manual');

CREATE TABLE IF NOT EXISTS public.assinaturas (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                      UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    plano_id                    UUID NOT NULL REFERENCES public.planos(id),
    gateway                     app.gateway_pagamento NOT NULL DEFAULT 'stripe',
    gateway_customer_id         TEXT,                            -- cus_xxx (Stripe) ou cliente_id (Pagar.me)
    gateway_subscription_id     TEXT,                            -- sub_xxx
    status                      app.assinatura_status NOT NULL DEFAULT 'trial',
    valor_mensal_cents          INTEGER NOT NULL,
    iniciou_em                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_start        TIMESTAMPTZ,
    current_period_end          TIMESTAMPTZ,
    cancelada_em                TIMESTAMPTZ,
    cancelamento_motivo         TEXT,
    payload_gateway             JSONB,                           -- último webhook recebido para auditoria
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assinaturas IS 'Histórico de assinaturas por org. Uma org pode ter múltiplas (após upgrade/downgrade) mas apenas uma ativa por vez.';

CREATE INDEX IF NOT EXISTS idx_assinaturas_org_status ON public.assinaturas(org_id, status);
CREATE INDEX IF NOT EXISTS idx_assinaturas_periodo   ON public.assinaturas(current_period_end) WHERE status IN ('ativa', 'pendente_pagamento');

-- Apenas uma assinatura por org com status ∈ (trial, ativa, pendente_pagamento, inadimplente).
CREATE UNIQUE INDEX IF NOT EXISTS uq_assinaturas_org_ativa
    ON public.assinaturas(org_id)
    WHERE status IN ('trial', 'ativa', 'pendente_pagamento', 'inadimplente');

-- ─── FATURAS ──────────────────────────────────────────────────
-- Histórico de cobranças individuais (uma fatura = um período).
CREATE TYPE app.fatura_status AS ENUM ('aberta', 'paga', 'atrasada', 'cancelada', 'reembolsada');

CREATE TABLE IF NOT EXISTS public.faturas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    assinatura_id       UUID NOT NULL REFERENCES public.assinaturas(id) ON DELETE CASCADE,
    gateway_invoice_id  TEXT,                                    -- in_xxx (Stripe)
    valor_cents         INTEGER NOT NULL,
    moeda               CHAR(3) NOT NULL DEFAULT 'BRL',
    status              app.fatura_status NOT NULL DEFAULT 'aberta',
    vencimento          DATE NOT NULL,
    pago_em             TIMESTAMPTZ,
    boleto_url          TEXT,                                    -- link do boleto (Pagar.me)
    nota_fiscal_url     TEXT,                                    -- link para NF emitida
    payload_gateway     JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faturas_org_status     ON public.faturas(org_id, status);
CREATE INDEX IF NOT EXISTS idx_faturas_vencimento     ON public.faturas(vencimento) WHERE status IN ('aberta', 'atrasada');
