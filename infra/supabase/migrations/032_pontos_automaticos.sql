-- ============================================================
-- 032 — Pontuação automática por entregas conforme departamento
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_pontos_entrega_evento_user
    ON public.pontos_eventos(referencia_tipo, referencia_id, evento, user_id)
    WHERE referencia_tipo = 'entrega' AND referencia_id IS NOT NULL;

CREATE OR REPLACE FUNCTION app.pontos_valor_evento(p_org_id UUID, p_evento app.evento_pontos, p_default INT)
RETURNS INT LANGUAGE sql STABLE AS $$
    SELECT COALESCE((
        SELECT pontos
        FROM public.regras_pontuacao_org
        WHERE org_id = p_org_id AND evento = p_evento AND ativo = TRUE
        LIMIT 1
    ), p_default);
$$;

CREATE OR REPLACE FUNCTION app.gerar_pontos_entrega_automatica() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_modo app.premiacao_modo;
    v_evento app.evento_pontos;
    v_pontos INT;
    v_dias_antecedencia INT;
BEGIN
    IF NEW.status <> 'entregue' OR OLD.status = 'entregue' OR NEW.responsavel_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT premiacao_modo INTO v_modo
    FROM public.org_departamentos
    WHERE org_id = NEW.org_id AND codigo = NEW.departamento;

    IF COALESCE(v_modo, 'manual') <> 'automatico' THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'atrasada' THEN
        INSERT INTO public.pontos_eventos (org_id, user_id, evento, pontos, referencia_tipo, referencia_id, justificativa)
        VALUES (NEW.org_id, NEW.responsavel_id, 'entrega_atrasada', app.pontos_valor_evento(NEW.org_id, 'entrega_atrasada', -5), 'entrega', NEW.id, 'Pontuação automática: entrega ficou atrasada antes da conclusão')
        ON CONFLICT DO NOTHING;
    END IF;

    v_dias_antecedencia := NEW.prazo_legal::date - COALESCE(NEW.entregue_em, now())::date;
    IF v_dias_antecedencia >= 3 THEN
        v_evento := 'entrega_antecipada';
        v_pontos := app.pontos_valor_evento(NEW.org_id, v_evento, 15);
    ELSIF COALESCE(NEW.entregue_em, now())::date <= NEW.prazo_legal::date THEN
        v_evento := 'entrega_no_prazo';
        v_pontos := app.pontos_valor_evento(NEW.org_id, v_evento, 10);
    ELSE
        RETURN NEW;
    END IF;

    INSERT INTO public.pontos_eventos (org_id, user_id, evento, pontos, referencia_tipo, referencia_id, justificativa)
    VALUES (NEW.org_id, NEW.responsavel_id, v_evento, v_pontos, 'entrega', NEW.id, 'Pontuação automática por entrega')
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_entregas_pontos_automaticos ON public.entregas;
CREATE TRIGGER trg_entregas_pontos_automaticos
    AFTER UPDATE OF status ON public.entregas
    FOR EACH ROW EXECUTE FUNCTION app.gerar_pontos_entrega_automatica();
