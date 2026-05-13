-- ============================================================
-- 014 — Triggers (auto-updated_at, profile sync, denormalizações)
-- ============================================================
-- Depende dos helpers definidos em 013_functions_helpers.sql
-- ============================================================

-- ─── Auto-criar profile quando um auth.users é criado ────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION app.handle_new_user();

-- ─── Auto-touch updated_at em todas as tabelas que têm a coluna ─
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT table_schema, table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'updated_at'
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_touch_updated_at ON %I.%I;',
            r.table_schema, r.table_name
        );
        EXECUTE format(
            'CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON %I.%I
             FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();',
            r.table_schema, r.table_name
        );
    END LOOP;
END$$;

-- ─── Entregas: denormalização (empresa_id, obrigacao_id, dept, org_id) ─
DROP TRIGGER IF EXISTS trg_entregas_denorm ON public.entregas;
CREATE TRIGGER trg_entregas_denorm
    BEFORE INSERT OR UPDATE OF obrigacao_empresa_id ON public.entregas
    FOR EACH ROW EXECUTE FUNCTION app.entrega_denorm();

-- ─── Entregas: gerar entrega_eventos automaticamente ─────────
DROP TRIGGER IF EXISTS trg_entregas_evento ON public.entregas;
CREATE TRIGGER trg_entregas_evento
    AFTER INSERT OR UPDATE OF status ON public.entregas
    FOR EACH ROW EXECUTE FUNCTION app.entrega_evento_status();

-- ─── Chat: manter ultima_mensagem_em no canal ────────────────
DROP TRIGGER IF EXISTS trg_chat_msg_ultima ON public.chat_mensagens;
CREATE TRIGGER trg_chat_msg_ultima
    AFTER INSERT ON public.chat_mensagens
    FOR EACH ROW EXECUTE FUNCTION app.chat_atualiza_ultima_mensagem();
