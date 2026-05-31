-- ============================================================
-- 049 — Cliente final pode CRIAR solicitações e responder mensagens
-- ============================================================
-- A 042 só deu SELECT pro cliente final. Falta deixar ele criar uma
-- solicitação (chamado via PWA) e responder mensagens não-internas.
--
-- Regras:
--   * solicitacoes: cliente cria sempre com status='nova', origem='app_cliente'
--   * solicitacao_mensagens: cliente cria sempre com autor_tipo='cliente'
--     e interna=FALSE (sem notas privadas).
-- ============================================================

DO $$ BEGIN
    -- Solicitações: cliente cria chamado da própria empresa
    IF NOT EXISTS (SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='solicitacoes' AND policyname='solicitacoes_cliente_insert') THEN
        CREATE POLICY solicitacoes_cliente_insert ON public.solicitacoes FOR INSERT
            WITH CHECK (
                app.user_eh_cliente_da_empresa(empresa_id)
                AND origem = 'app_cliente'
                AND status = 'nova'
            );
    END IF;

    -- Mensagens: cliente responde em chamado da própria empresa,
    -- sempre como autor_tipo='cliente' e nunca como nota interna.
    IF NOT EXISTS (SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='solicitacao_mensagens' AND policyname='solicitacao_mensagens_cliente_insert') THEN
        CREATE POLICY solicitacao_mensagens_cliente_insert ON public.solicitacao_mensagens FOR INSERT
            WITH CHECK (
                autor_tipo = 'cliente'
                AND interna = FALSE
                AND EXISTS (
                    SELECT 1 FROM public.solicitacoes s
                    WHERE s.id = solicitacao_id
                      AND app.user_eh_cliente_da_empresa(s.empresa_id)
                )
            );
    END IF;
END $$;

COMMENT ON POLICY solicitacoes_cliente_insert ON public.solicitacoes IS
    'Permite ao cliente final (PWA) abrir chamados da própria empresa, sempre como nova/app_cliente.';
COMMENT ON POLICY solicitacao_mensagens_cliente_insert ON public.solicitacao_mensagens IS
    'Permite ao cliente final (PWA) responder em chamados da própria empresa, sem usar nota interna.';
