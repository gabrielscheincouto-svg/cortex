-- ============================================================
-- 012 — Audit log global (compliance, debugging, security)
-- ============================================================
-- Registro de ações sensíveis. Apenas inserção, nunca update/delete.
-- Usado para:
--   • Investigar incidentes ("quem deletou aquela empresa?")
--   • Compliance (LGPD, auditoria do escritório)
--   • Debugging em produção
-- ============================================================

CREATE TYPE app.audit_acao AS ENUM (
    'login',
    'logout',
    'falha_login',
    'criou',
    'atualizou',
    'deletou',
    'restaurou',
    'exportou',
    'mudou_permissao',
    'mudou_plano',
    'convidou_usuario',
    'desativou_usuario',
    'impersonate_iniciou',     -- super-admin entrou na pele de outro usuário
    'impersonate_finalizou',
    'webhook_recebido',
    'erro_critico'
);

CREATE TABLE IF NOT EXISTS public.audit_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID REFERENCES public.orgs(id) ON DELETE SET NULL,
    user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email          TEXT,                                    -- cache (caso user seja deletado)
    user_role           TEXT,
    acao                app.audit_acao NOT NULL,
    entidade_tipo       TEXT,                                    -- 'empresa', 'entrega', 'org', 'profile', etc.
    entidade_id         UUID,
    descricao           TEXT,                                    -- humanizada ("Deletou empresa AA Participações")
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,      -- snapshot dos dados antes/depois
    ip                  INET,
    user_agent          TEXT,
    request_id          TEXT,                                    -- correlation ID com os logs da API Go
    severidade          TEXT NOT NULL DEFAULT 'info' CHECK (severidade IN ('debug','info','aviso','erro','critico')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS 'Log auditável de ações sensíveis. Append-only. Particionar por mês quando ultrapassar 10M registros.';

CREATE INDEX IF NOT EXISTS idx_audit_org_data       ON public.audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_data      ON public.audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entidade       ON public.audit_log(entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_acao_data      ON public.audit_log(acao, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_severidade     ON public.audit_log(severidade, created_at DESC) WHERE severidade IN ('erro','critico');
CREATE INDEX IF NOT EXISTS idx_audit_request_id     ON public.audit_log(request_id) WHERE request_id IS NOT NULL;
