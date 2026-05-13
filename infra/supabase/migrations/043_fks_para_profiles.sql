-- ============================================================
-- 043 — FKs secundárias pra public.profiles
-- ============================================================
-- O PostgREST (REST API do Supabase) só consegue resolver joins
-- entre tabelas se houver FK explícita. Várias colunas armazenam
-- IDs de user (auth.users) mas o frontend faz join via profiles
-- (profiles.id = auth.users.id, 1:1).
-- Adicionamos FK secundária → public.profiles(id) pra que queries
-- `profiles!<col>(...)` funcionem.
-- ============================================================

DO $$
DECLARE
    pair RECORD;
BEGIN
    FOR pair IN
        SELECT * FROM (VALUES
            ('entregas',                  'responsavel_id'),
            ('entregas',                  'co_responsavel_id'),
            ('entregas',                  'entregue_por_id'),
            ('entregas',                  'confirmada_cliente_por_id'),
            ('entrega_arquivos',          'enviado_por_id'),
            ('entrega_eventos',           'ator_id'),
            ('mural_posts',               'autor_id'),
            ('mural_comentarios',         'autor_id'),
            ('solicitacoes',              'responsavel_id'),
            ('solicitacao_mensagens',     'autor_id'),
            ('obrigacao_empresa',         'responsavel_id'),
            ('irpf_declaracoes',          'responsavel_id'),
            ('chat_mensagens',            'autor_id'),
            ('chat_membros',              'user_id'),
            ('pontos_eventos',            'user_id'),
            ('pontos_eventos',            'criado_por_id'),
            ('conquistas_usuario',        'user_id'),
            ('telemetria_tempo',          'user_id'),
            ('org_membros',               'user_id'),
            ('kanban_tarefas',            'responsavel_id'),
            ('kanban_tarefas',            'criada_por_id'),
            ('kanban_comentarios',        'autor_id'),
            ('frequencia_diaria',         'user_id'),
            ('balancetes',                'fechado_por_id'),
            ('cortex_acoes_pendentes',    'user_id'),
            ('cortex_memorias',           'user_id'),
            ('audit_log',                 'ator_id'),
            ('regras_pontuacao_org',      'criada_por_id'),
            ('uploads_pendentes',         'criado_por_id')
        ) AS x(tabela, coluna)
    LOOP
        -- Verifica se a coluna existe E se já não tem FK pra profiles
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name=pair.tabela AND column_name=pair.coluna
        ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu USING (constraint_name, table_schema)
            WHERE tc.constraint_type='FOREIGN KEY'
              AND tc.table_name=pair.tabela
              AND ccu.table_name='profiles'
              AND ccu.column_name='id'
              AND EXISTS (
                  SELECT 1 FROM information_schema.key_column_usage kcu
                  WHERE kcu.constraint_name=tc.constraint_name
                    AND kcu.column_name=pair.coluna
              )
        ) THEN
            EXECUTE format(
                'ALTER TABLE public.%I
                 ADD CONSTRAINT %I FOREIGN KEY (%I)
                 REFERENCES public.profiles(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED',
                pair.tabela,
                pair.tabela || '_' || pair.coluna || '_profiles_fkey',
                pair.coluna
            );
        END IF;
    END LOOP;
END $$;

-- Força reload do schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
