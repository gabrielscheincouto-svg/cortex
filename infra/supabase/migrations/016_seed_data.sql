-- ============================================================
-- 016 — Seed data (módulos, planos, conquistas, exemplos de obrigações)
-- ============================================================
-- Dados iniciais que TODA instalação tem.
-- Idempotente (ON CONFLICT DO NOTHING / DO UPDATE) — pode rodar várias vezes.
-- ============================================================

-- ─── MÓDULOS DO CATÁLOGO ──────────────────────────────────────
INSERT INTO public.modulos_catalogo (codigo, nome, descricao, icone, categoria, ordem) VALUES
    ('kanban',       'Kanban de tarefas',          'Quadro pessoal e da equipe',                 'ti-layout-kanban',     'core',         10),
    ('empresas',     'Empresas',                   'Cadastro de empresas atendidas',             'ti-building',           'core',         20),
    ('obrigacoes',   'Obrigações',                 'Catálogo e vínculo com empresas',            'ti-list-check',         'core',         30),
    ('entregas',     'Lista de entregas',          'Liquidação mensal das obrigações',           'ti-clipboard-check',    'core',         40),
    ('solicitacoes', 'Solicitações',               'Ticket-system com cliente',                  'ti-message-question',   'comunicacao',  50),
    ('mural',        'Mural interno',              'Comunicação corporativa do escritório',      'ti-news',               'comunicacao',  60),
    ('chat',         'Chat interno',               'Conversas 1:1, grupos e canais vinculados',  'ti-messages',           'comunicacao',  70),
    ('gamificacao',  'Gamificação',                'Pontos, conquistas e ranking',               'ti-trophy',             'gestao',       80),
    ('dashboards',   'Dashboards gerenciais',      'Prazos, comunicação, rentabilidade, prod.',  'ti-chart-bar',          'gestao',       90),
    ('rh',           'Recursos humanos',           'Funcionários, candidatos, entrevistas',      'ti-users',              'gestao',      100),
    ('irpf',         'IRPF',                       'Declaração de Imposto de Renda',             'ti-file-tax',           'core',        110),
    ('societario',   'Societário',                 'Departamento societário',                    'ti-file-certificate',   'core',        120),
    ('analise',      'Análise contábil',           'Relatórios e análise',                       'ti-report-analytics',   'gestao',      130),
    ('comercial',    'Comercial / financeiro',     'Departamento comercial e financeiro',        'ti-coin',               'gestao',      140),
    ('robo',         'Robô de liquidação',         'Captura automática de arquivos da pasta',    'ti-robot',              'premium',     150),
    ('app_cliente',  'App do cliente (PWA)',       'White-label para empresas atendidas',        'ti-device-mobile',      'premium',     160),
    ('white_label',  'White-label',                'Logo, cor e domínio personalizado',          'ti-palette',            'premium',     170)
ON CONFLICT (codigo) DO UPDATE SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    icone = EXCLUDED.icone,
    categoria = EXCLUDED.categoria,
    ordem = EXCLUDED.ordem;

-- ─── PLANOS ───────────────────────────────────────────────────
INSERT INTO public.planos (codigo, nome, preco_mensal_cents, limite_usuarios, limite_empresas, limite_storage_gb, modulos_inclusos, descricao, publico, ordem) VALUES
    ('free',
     'Free',
     0,
     3, 20, 1,
     '["kanban","empresas","obrigacoes","entregas","solicitacoes","mural","chat"]'::jsonb,
     'Para escritórios começando. Ideal para até 20 empresas atendidas.',
     TRUE, 10),

    ('pro',
     'Pro',
     14900,                                                     -- R$ 149/mês
     15, 200, 25,
     '["kanban","empresas","obrigacoes","entregas","solicitacoes","mural","chat","gamificacao","dashboards","rh","irpf","societario","analise","comercial","robo","app_cliente"]'::jsonb,
     'Escritórios em crescimento. Inclui robô de liquidação, dashboards e app do cliente.',
     TRUE, 20),

    ('enterprise',
     'Enterprise',
     49900,                                                     -- R$ 499/mês
     NULL, NULL, 250,
     '["kanban","empresas","obrigacoes","entregas","solicitacoes","mural","chat","gamificacao","dashboards","rh","irpf","societario","analise","comercial","robo","app_cliente","white_label"]'::jsonb,
     'Escritórios médios e grandes. Sem limite de empresas/usuários, com white-label.',
     TRUE, 30)
ON CONFLICT (codigo) DO UPDATE SET
    nome = EXCLUDED.nome,
    preco_mensal_cents = EXCLUDED.preco_mensal_cents,
    limite_usuarios = EXCLUDED.limite_usuarios,
    limite_empresas = EXCLUDED.limite_empresas,
    limite_storage_gb = EXCLUDED.limite_storage_gb,
    modulos_inclusos = EXCLUDED.modulos_inclusos,
    descricao = EXCLUDED.descricao,
    publico = EXCLUDED.publico,
    ordem = EXCLUDED.ordem;

-- ─── CONQUISTAS GLOBAIS ───────────────────────────────────────
-- Conquistas com org_id = NULL são herdadas por todos os escritórios.
INSERT INTO public.conquistas_catalogo
    (org_id, codigo, nome, descricao, icone, cor_ramp, nivel, pontos_bonus, criterio_codigo, criterio_params, ordem) VALUES
    (NULL, 'primeira_entrega', 'Primeira entrega',
     'Conclui sua primeira obrigação no sistema.',
     'ti-star', 'amber', 'bronze', 30,
     'entregas_concluidas', '{"quantidade": 1}'::jsonb, 10),

    (NULL, 'dez_entregas', 'Dez entregas',
     '10 obrigações concluídas. Você está pegando o ritmo.',
     'ti-trophy', 'amber', 'bronze', 50,
     'entregas_concluidas', '{"quantidade": 10}'::jsonb, 20),

    (NULL, 'pontual_bronze', 'Pontualidade bronze',
     '1 mês sem nenhuma entrega atrasada.',
     'ti-shield-check', 'amber', 'bronze', 100,
     'meses_sem_atraso', '{"meses": 1}'::jsonb, 30),

    (NULL, 'pontual_prata', 'Pontualidade prata',
     '3 meses consecutivos sem nenhuma entrega atrasada.',
     'ti-shield-check', 'gray', 'prata', 250,
     'meses_sem_atraso', '{"meses": 3}'::jsonb, 40),

    (NULL, 'pontual_aco', 'Pontual de aço',
     '6 meses consecutivos sem nenhuma entrega atrasada. Uma referência para a equipe.',
     'ti-shield-check', 'amber', 'ouro', 500,
     'meses_sem_atraso', '{"meses": 6}'::jsonb, 50),

    (NULL, 'salvador_multa', 'Salvador de multa',
     'Recuperou 3 obrigações que estavam prestes a vencer.',
     'ti-alert-triangle', 'amber', 'prata', 200,
     'entregas_de_risco_recuperadas', '{"quantidade": 3}'::jsonb, 60),

    (NULL, 'comunicador', 'Comunicador',
     'NPS médio acima de 9 em pelo menos 20 avaliações.',
     'ti-message-circle', 'teal', 'prata', 300,
     'nps_medio_periodo', '{"minimo": 9.0, "avaliacoes": 20}'::jsonb, 70),

    (NULL, 'mestre_tributarista', 'Mestre tributarista',
     '50 IRPFs entregues. Reconhecido como referência em pessoa física.',
     'ti-certificate', 'coral', 'ouro', 500,
     'entregas_de_tipo', '{"codigo_obrigacao":"IRPF", "quantidade": 50}'::jsonb, 80),

    (NULL, 'mentor', 'Mentor',
     'Apoiou colegas via chat de forma reconhecida (marcação "resolvido pelo time") em 10 ocasiões.',
     'ti-school', 'purple', 'prata', 250,
     'ajudas_marcadas', '{"quantidade": 10}'::jsonb, 90),

    (NULL, 'speed_run', 'Speed run',
     'Entregou 20 obrigações em uma única semana — produtividade excepcional.',
     'ti-bolt', 'amber', 'ouro', 400,
     'entregas_em_periodo', '{"quantidade": 20, "periodo": "semana"}'::jsonb, 100)
ON CONFLICT (org_id, codigo) DO UPDATE SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    icone = EXCLUDED.icone,
    cor_ramp = EXCLUDED.cor_ramp,
    nivel = EXCLUDED.nivel,
    pontos_bonus = EXCLUDED.pontos_bonus,
    criterio_codigo = EXCLUDED.criterio_codigo,
    criterio_params = EXCLUDED.criterio_params,
    ordem = EXCLUDED.ordem;

-- ─── OBRIGAÇÕES GLOBAIS (catálogo curado pela CECOPEL) ────────
-- Lista mínima inicial. Mais 180+ serão importadas do Acessórias na Fase 1 final.
INSERT INTO public.obrigacoes_catalogo
    (org_id, codigo, nome, departamento, periodicidade, referencia_dia, dia_legal, dias_antes_lembrete, competencia_offset,
     multa_estimada_cents, tempo_estimado_minutos, robo_processa, regex_arquivo, parser_tipo, descricao, base_legal) VALUES
    (NULL, 'DCTFWeb',         'DCTFWeb',                 'fiscal',   'mensal', 'dia_fixo', 15, 3, 1,  20000, 45, TRUE,  '^DCTFWEB_(\d{14})_(\d{6})\.(txt|xml)$', 'dctfweb',  'Declaração de Débitos e Créditos Tributários Federais Previdenciários e de Outras Entidades e Fundos', 'IN RFB 2.005/2021'),
    (NULL, 'DIRBI',           'DIRBI',                   'fiscal',   'mensal', 'dia_fixo', 20, 3, 1,  15000, 40, TRUE,  '^DIRBI_(\d{14})_(\d{6})\.(txt|xml)$',   'dirbi',    'Declaração de Incentivos, Renúncias, Benefícios e Imunidades Tributárias', 'IN RFB 2.198/2024'),
    (NULL, 'Balancete',       'Balancete mensal',        'contabil', 'mensal', 'ultimo_dia_util_competencia', NULL, 5, 1, 0, 60, FALSE, NULL, NULL, 'Balancete mensal contábil das empresas', NULL),
    (NULL, 'eSocialEvtFolha', 'eSocial — folha mensal',  'pessoal',  'mensal', 'dia_fixo', 15, 3, 1, 50000, 90, TRUE,  '^EVTREMUN_(\d{14})_(\d{6})\.xml$',      'esocial',  'Evento de fechamento de folha eSocial', 'Decreto 8.373/2014'),
    (NULL, 'SPED_EFD',        'SPED EFD-Contribuições',  'fiscal',   'mensal', 'dia_util_apos_competencia', 10, 5, 1, 80000, 120, TRUE, '^EFD_CONTRIB_(\d{14})_(\d{8})_(\d{8})\.txt$', 'sped_efd_contrib', 'EFD-Contribuições (PIS/COFINS)', 'IN RFB 1.252/2012'),
    (NULL, 'IRPF',            'IRPF anual',              'fiscal',   'anual',  'dia_fixo', 31, 30, 4, 16573, 150, FALSE, NULL, NULL, 'Declaração de Imposto de Renda Pessoa Física', 'Lei 9.250/1995')
ON CONFLICT (org_id, codigo) DO UPDATE SET
    nome = EXCLUDED.nome,
    departamento = EXCLUDED.departamento,
    periodicidade = EXCLUDED.periodicidade,
    referencia_dia = EXCLUDED.referencia_dia,
    dia_legal = EXCLUDED.dia_legal,
    multa_estimada_cents = EXCLUDED.multa_estimada_cents,
    tempo_estimado_minutos = EXCLUDED.tempo_estimado_minutos,
    robo_processa = EXCLUDED.robo_processa,
    regex_arquivo = EXCLUDED.regex_arquivo,
    parser_tipo = EXCLUDED.parser_tipo;

-- ─── REGRAS DE PONTUAÇÃO DEFAULT (globais via código no backend) ─
-- A tabela regras_pontuacao_org permite override POR ORG. Os defaults ficam hardcoded no backend Go.
-- Documentados aqui para referência:
--   entrega_no_prazo              → +10
--   entrega_antecipada            → +15
--   entrega_atrasada              → −5
--   nps_alto (5 estrelas)         → +20
--   nps_baixo (≤2 estrelas)       → −15
--   nps_medio_mensal_alto (≥9)    → +100 (bônus mensal)
--   ajudou_colega                 → +5
--   mentoria (mensal por 3 meses) → +50/mês
--   conquista_desbloqueada        → varia conforme conquistas_catalogo.pontos_bonus

-- ─── VERIFICAÇÃO FINAL ────────────────────────────────────────
-- Conta tabelas, indices e policies para confirmar que tudo subiu.
-- Resultado esperado após aplicar 001-016:
--   • ~22 tabelas em public
--   • ~80+ índices
--   • RLS habilitado em todas as tabelas de tenant
SELECT
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public') AS tabelas,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public')                    AS indices,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public')                   AS policies,
    (SELECT COUNT(*) FROM public.modulos_catalogo)                                 AS modulos,
    (SELECT COUNT(*) FROM public.planos)                                           AS planos,
    (SELECT COUNT(*) FROM public.conquistas_catalogo WHERE org_id IS NULL)         AS conquistas_globais,
    (SELECT COUNT(*) FROM public.obrigacoes_catalogo WHERE org_id IS NULL)         AS obrigacoes_globais;
