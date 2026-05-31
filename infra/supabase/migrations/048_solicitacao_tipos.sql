-- ============================================================
-- 048 — Catálogo de TIPOS de solicitação por setor
-- ============================================================
-- O cliente final escolhe o tipo de chamado no PWA (Admissão, Demissão,
-- Certidão, Solicitação de Balancete, Faturamento 12 meses, etc). Cada tipo
-- pertence a um departamento e define os CAMPOS que o cliente preenche.
--
-- A UI usa o "campos_form" (JSON schema simples) pra renderizar dinamicamente
-- o formulário no PWA. Quando o cliente submete, virou uma row em solicitacoes,
-- e os dados do form ficam no JSON `dados_form` (ainda adicionar coluna).
--
-- Tipos podem ser ATIVOS/INATIVOS sem precisar deletar (mantém histórico).
-- Cada org pode personalizar o catálogo: marcas que sobrescrevem o seed.
-- ============================================================

-- ─── Tabela ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.solicitacao_tipos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL = template global (vale pra todas as orgs); UUID = override por escritório
    org_id              UUID REFERENCES public.orgs(id) ON DELETE CASCADE,

    codigo              TEXT NOT NULL,                            -- ex: 'admissao', 'demissao', 'certidao', 'balancete'
    label               TEXT NOT NULL,                            -- ex: 'Admitir colaborador'
    descricao           TEXT,                                     -- breve explicação que aparece pro cliente
    departamento        app.departamento NOT NULL,                -- a qual setor pertence (pessoal, societario, etc.)

    -- Schema do formulário — array de campos com tipo, label, obrigatório, opções.
    -- Formato:
    --   [{
    --     "name":"colaborador_nome", "label":"Nome completo", "type":"text",
    --     "required":true, "placeholder":"Maria Silva"
    --   }, {
    --     "name":"cpf", "label":"CPF", "type":"text", "mask":"cpf", "required":true
    --   }, {
    --     "name":"data_admissao", "label":"Data prevista", "type":"date", "required":true
    --   }, {
    --     "name":"cargo", "label":"Cargo", "type":"text", "required":true
    --   }, {
    --     "name":"salario", "label":"Salário (R$)", "type":"number", "required":true
    --   }, {
    --     "name":"observacoes", "label":"Observações", "type":"textarea"
    --   }]
    --
    -- Tipos suportados pela UI: text | textarea | date | number | select | checkbox | file
    campos_form         JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- SLA-padrão pro tipo: o cliente vê "resposta em até Xh"
    sla_resposta_horas  INTEGER NOT NULL DEFAULT 24,
    sla_resolucao_horas INTEGER NOT NULL DEFAULT 72,

    -- Cosméticos para a UI
    icone               TEXT,                                     -- nome de ícone Lucide ('UserPlus', 'FileText', etc)
    ordem               INTEGER NOT NULL DEFAULT 0,

    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Unicidade: (org_id, codigo) — permite uma org sobrescrever um global com mesmo código
    UNIQUE NULLS NOT DISTINCT (org_id, codigo)
);

COMMENT ON TABLE public.solicitacao_tipos IS
    'Catálogo de tipos de chamado disponíveis pro cliente no PWA. NULL em org_id = template global.';

CREATE INDEX IF NOT EXISTS idx_solicitacao_tipos_dept
    ON public.solicitacao_tipos(departamento, ordem)
    WHERE ativo = TRUE;

CREATE INDEX IF NOT EXISTS idx_solicitacao_tipos_org
    ON public.solicitacao_tipos(org_id, departamento)
    WHERE org_id IS NOT NULL;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_touch_updated_at ON public.solicitacao_tipos;
CREATE TRIGGER trg_touch_updated_at
    BEFORE UPDATE ON public.solicitacao_tipos
    FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.solicitacao_tipos ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer authenticated user pode ler templates globais (org_id IS NULL).
-- Membros da org veem os overrides da própria org. Cliente final também lê
-- (precisa pra renderizar o form no PWA).
DROP POLICY IF EXISTS solicitacao_tipos_select ON public.solicitacao_tipos;
CREATE POLICY solicitacao_tipos_select ON public.solicitacao_tipos FOR SELECT
    USING (
        ativo = TRUE
        AND (
            org_id IS NULL
            OR app.is_super_admin()
            OR app.user_pertence_a_org(org_id)
            OR EXISTS (
                SELECT 1 FROM public.empresa_usuarios_finais euf
                WHERE euf.user_id = auth.uid()
                  AND euf.ativo = TRUE
                  AND euf.org_id = solicitacao_tipos.org_id
            )
        )
    );

-- WRITE: só membros da org (admin do escritório) ou super-admin.
DROP POLICY IF EXISTS solicitacao_tipos_write ON public.solicitacao_tipos;
CREATE POLICY solicitacao_tipos_write ON public.solicitacao_tipos FOR ALL
    USING (app.is_super_admin() OR (org_id IS NOT NULL AND app.user_pertence_a_org(org_id)))
    WITH CHECK (app.is_super_admin() OR (org_id IS NOT NULL AND app.user_pertence_a_org(org_id)));

-- ─── Coluna em solicitacoes pra guardar os dados do form preenchido ──
ALTER TABLE public.solicitacoes
    ADD COLUMN IF NOT EXISTS tipo_codigo TEXT;

ALTER TABLE public.solicitacoes
    ADD COLUMN IF NOT EXISTS dados_form JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.solicitacoes.tipo_codigo IS
    'Código do tipo escolhido em solicitacao_tipos (snapshot — o tipo pode ser renomeado depois).';
COMMENT ON COLUMN public.solicitacoes.dados_form IS
    'Dados preenchidos no formulário do tipo. Schema variável conforme tipo_codigo.';

-- ─── Seed dos templates globais ──────────────────────────────
-- Marcamos org_id = NULL pra valer pra todas as orgs. Cada escritório
-- pode sobrescrever depois inserindo uma row com mesmo codigo e org_id != NULL.

INSERT INTO public.solicitacao_tipos (org_id, codigo, label, descricao, departamento, campos_form, icone, ordem, sla_resposta_horas, sla_resolucao_horas)
VALUES
-- ─ PESSOAL
(NULL, 'admissao', 'Admitir colaborador', 'Solicite a admissão de um novo colaborador na sua empresa.', 'pessoal',
 '[
   {"name":"colaborador_nome","label":"Nome completo","type":"text","required":true,"placeholder":"Maria da Silva"},
   {"name":"cpf","label":"CPF","type":"text","required":true,"mask":"cpf","placeholder":"000.000.000-00"},
   {"name":"data_admissao","label":"Data prevista de admissão","type":"date","required":true},
   {"name":"cargo","label":"Cargo","type":"text","required":true,"placeholder":"Auxiliar administrativo"},
   {"name":"salario","label":"Salário (R$)","type":"number","required":true,"placeholder":"3000.00"},
   {"name":"jornada","label":"Jornada","type":"select","required":true,"options":["44h semanais","40h semanais","30h semanais","20h semanais","Outra"]},
   {"name":"vt","label":"Vale transporte?","type":"checkbox"},
   {"name":"vr","label":"Vale refeição/alimentação?","type":"checkbox"},
   {"name":"observacoes","label":"Observações","type":"textarea","placeholder":"Benefícios especiais, anotações, etc."}
 ]'::jsonb,
 'UserPlus', 1, 12, 48),

(NULL, 'demissao', 'Demitir colaborador', 'Solicite a rescisão de contrato de um colaborador.', 'pessoal',
 '[
   {"name":"colaborador_nome","label":"Nome do colaborador","type":"text","required":true},
   {"name":"cpf","label":"CPF","type":"text","mask":"cpf"},
   {"name":"data_demissao","label":"Data prevista da rescisão","type":"date","required":true},
   {"name":"motivo","label":"Tipo de rescisão","type":"select","required":true,"options":["Sem justa causa (pedido empresa)","Pedido de demissão","Comum acordo","Justa causa","Término de contrato","Outro"]},
   {"name":"aviso_previo","label":"Aviso prévio","type":"select","required":true,"options":["Trabalhado","Indenizado","Dispensado"]},
   {"name":"observacoes","label":"Observações","type":"textarea"}
 ]'::jsonb,
 'UserMinus', 2, 12, 48),

(NULL, 'ferias', 'Solicitar férias', 'Solicite o cálculo de férias de um colaborador.', 'pessoal',
 '[
   {"name":"colaborador_nome","label":"Nome do colaborador","type":"text","required":true},
   {"name":"data_inicio","label":"Data de início das férias","type":"date","required":true},
   {"name":"dias","label":"Quantos dias","type":"select","required":true,"options":["30","20","15","10"]},
   {"name":"abono","label":"Vai vender 1/3 (abono pecuniário)?","type":"checkbox"},
   {"name":"adiantamento_13","label":"Vai adiantar a 1ª parcela do 13º?","type":"checkbox"},
   {"name":"observacoes","label":"Observações","type":"textarea"}
 ]'::jsonb,
 'Calendar', 3, 24, 72),

-- ─ SOCIETÁRIO
(NULL, 'certidao_negativa', 'Certidão negativa', 'Solicite a emissão de certidão negativa (Receita, FGTS, Trabalhista, etc).', 'societario',
 '[
   {"name":"certidoes","label":"Quais certidões precisa?","type":"select","required":true,"options":["Receita Federal","FGTS","Trabalhista","Estadual","Municipal","Todas as principais"]},
   {"name":"finalidade","label":"Para qual finalidade?","type":"text","placeholder":"Participação em licitação, financiamento, etc."},
   {"name":"prazo","label":"Tem prazo para entregar?","type":"date"},
   {"name":"observacoes","label":"Observações","type":"textarea"}
 ]'::jsonb,
 'ShieldCheck', 1, 24, 48),

(NULL, 'alteracao_contratual', 'Alteração contratual', 'Mudança de endereço, capital social, sócios, atividades, nome fantasia, etc.', 'societario',
 '[
   {"name":"tipo_alteracao","label":"O que vai mudar?","type":"select","required":true,"options":["Endereço","Capital social","Sócios","Atividades (CNAE)","Nome fantasia","Mais de um item"]},
   {"name":"detalhes","label":"Descreva a mudança","type":"textarea","required":true,"placeholder":"Ex: aumentar capital de R$ 10.000 para R$ 50.000, integralizado em dinheiro"},
   {"name":"data_pretendida","label":"Data pretendida da alteração","type":"date"},
   {"name":"observacoes","label":"Observações","type":"textarea"}
 ]'::jsonb,
 'FileText', 2, 24, 168),

(NULL, 'baixa_empresa', 'Baixa de empresa', 'Solicite a baixa formal da empresa nos órgãos competentes.', 'societario',
 '[
   {"name":"motivo","label":"Motivo da baixa","type":"select","required":true,"options":["Cessação de atividades","Falência","Incorporação","Fusão","Outro"]},
   {"name":"data_cessacao","label":"Última data de movimento","type":"date","required":true},
   {"name":"observacoes","label":"Observações","type":"textarea"}
 ]'::jsonb,
 'XCircle', 3, 24, 240),

-- ─ CONTÁBIL
(NULL, 'balancete', 'Solicitar balancete', 'Peça uma cópia do balancete de uma competência específica.', 'contabil',
 '[
   {"name":"competencia","label":"Competência (mês/ano)","type":"text","required":true,"placeholder":"05/2026 ou Maio/2026"},
   {"name":"finalidade","label":"Para qual finalidade?","type":"select","required":true,"options":["Análise interna","Banco / financiamento","Sócios","Auditoria externa","Outro"]},
   {"name":"formato","label":"Formato preferido","type":"select","required":true,"options":["PDF","Excel","Ambos"]},
   {"name":"observacoes","label":"Observações","type":"textarea"}
 ]'::jsonb,
 'BookOpen', 1, 24, 48),

(NULL, 'faturamento_12m', 'Faturamento dos últimos 12 meses', 'Relatório de faturamento consolidado dos últimos 12 meses.', 'contabil',
 '[
   {"name":"data_referencia","label":"Data de referência (último mês)","type":"date","required":true},
   {"name":"finalidade","label":"Para qual finalidade?","type":"select","required":true,"options":["Banco / financiamento","Licitação","Análise interna","Outro"]},
   {"name":"detalhamento","label":"Quer detalhamento por filial/CNPJ?","type":"checkbox"},
   {"name":"observacoes","label":"Observações","type":"textarea"}
 ]'::jsonb,
 'TrendingUp', 2, 24, 48),

(NULL, 'extrato_contabil', 'Extrato de conta contábil', 'Movimentação de uma conta específica em um período.', 'contabil',
 '[
   {"name":"conta","label":"Conta ou descrição","type":"text","required":true,"placeholder":"Ex: 1.1.01.001 ou Caixa"},
   {"name":"competencia_inicio","label":"Competência inicial","type":"text","placeholder":"01/2026"},
   {"name":"competencia_fim","label":"Competência final","type":"text","placeholder":"05/2026"},
   {"name":"observacoes","label":"Observações","type":"textarea"}
 ]'::jsonb,
 'List', 3, 24, 48),

-- ─ FISCAL
(NULL, 'segunda_via_guia', 'Segunda via de guia', 'Solicite segunda via de uma guia (DAS, DARF, ICMS, ISS, etc).', 'fiscal',
 '[
   {"name":"tipo_guia","label":"Qual guia?","type":"select","required":true,"options":["DAS Simples Nacional","DARF","ICMS","ISS","INSS","FGTS","Outra"]},
   {"name":"competencia","label":"Competência","type":"text","required":true,"placeholder":"05/2026"},
   {"name":"observacoes","label":"Observações","type":"textarea"}
 ]'::jsonb,
 'Receipt', 1, 12, 24),

(NULL, 'consulta_fiscal', 'Consulta tributária', 'Pergunta sobre tributação, alíquota, regime, etc.', 'fiscal',
 '[
   {"name":"assunto","label":"Sobre o que é a dúvida?","type":"text","required":true,"placeholder":"Ex: alíquota de ICMS em venda interestadual"},
   {"name":"contexto","label":"Detalhes da operação","type":"textarea","required":true,"placeholder":"Quem vende, quem compra, produto, valores envolvidos"},
   {"name":"urgencia","label":"Quando precisa da resposta?","type":"select","required":true,"options":["Quando puder","Esta semana","Hoje (urgente)"]}
 ]'::jsonb,
 'HelpCircle', 2, 24, 72),

-- ─ GENÉRICO (Outro) — fallback
(NULL, 'outro', 'Outro assunto', 'Não encontrou o tipo certo? Abra um chamado livre.', 'outro',
 '[
   {"name":"assunto","label":"Assunto","type":"text","required":true},
   {"name":"descricao","label":"Descreva sua solicitação","type":"textarea","required":true}
 ]'::jsonb,
 'MessageSquare', 99, 24, 72)

ON CONFLICT (org_id, codigo) DO UPDATE SET
    label               = EXCLUDED.label,
    descricao           = EXCLUDED.descricao,
    departamento        = EXCLUDED.departamento,
    campos_form         = EXCLUDED.campos_form,
    icone               = EXCLUDED.icone,
    ordem               = EXCLUDED.ordem,
    sla_resposta_horas  = EXCLUDED.sla_resposta_horas,
    sla_resolucao_horas = EXCLUDED.sla_resolucao_horas,
    updated_at          = now();
