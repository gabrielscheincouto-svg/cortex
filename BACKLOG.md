# Backlog priorizado — CECOPEL 2.0

> **Codex: leia `CODEX_BRIEFING.md` antes.** Pegue tarefas de cima pra baixo. Cada item tem: contexto, arquivos de referência (copie o padrão), critério de pronto.
>
> Marque ✅ quando concluir + 1 linha do que entregou.

---

## 🔥 Prioridade alta — Fase 4 (web escritório)

### ✅ TASK-001 · `/web/app/(app)/empresas/[id]/page.tsx`
Entregue em 2026-05-12. Página de detalhe criada com header, 4 stats, dados cadastrais, responsáveis, obrigações vinculadas com última entrega e solicitações recentes.

**O que faz:** Detalhe de uma empresa atendida, mostrando dados cadastrais, responsáveis por departamento, lista de obrigações vinculadas (com últimas entregas), histórico de solicitações.

**Referência visual:** `admin/app/(admin)/escritorios/[id]/page.tsx` segue mesmo padrão de header com avatar + dados + grid de KPIs + cards.

**Queries necessárias** (via `createServerClient` em Server Component):
- `empresas` → dados básicos
- `empresa_responsaveis` JOIN `profiles` → responsáveis por departamento
- `obrigacao_empresa` JOIN `obrigacoes_catalogo` → obrigações ativas
- `entregas` últimas 12 competências da empresa
- `solicitacoes` últimas 10 da empresa

**Estrutura:**
```
1. Link "Voltar para empresas"
2. Header: avatar colorido + razão social + CNPJ + status pill + honorário
3. Grid de 4 stats: obrigações ativas, entregas no mês, % no prazo, NPS médio
4. Card "Detalhes cadastrais" (2 colunas) — usar componente Row similar ao admin/escritorios/[id]
5. Card "Responsáveis" — tabela: avatar + nome + departamento + principal/auxiliar
6. Card "Obrigações vinculadas" — tabela: nome obrigação + departamento + última entrega + status
7. Card "Solicitações recentes" — lista estilo /solicitacoes mas filtrada
```

**Critério de pronto:** Página carrega sem erro com uma empresa de teste, todos os cards renderizam com dados reais ou empty states adequados.

---

### ✅ TASK-002 · `/web/app/(app)/chat/[id]/page.tsx`
Entregue em 2026-05-12. Conversa de canal criada com SSR inicial, WebSocket, composer com Cmd/Ctrl+Enter, placeholder de anexos e endpoint `POST /api/v1/chat/canais/:id/mensagens`.

**O que faz:** Conversa de um canal — header com nome/tipo, lista de mensagens cronológica, composer de mensagem, anexos.

**Referência visual:** Estilo Slack/Linear chat — mensagens à esquerda do canal, com avatar + nome + timestamp; mensagens do próprio user à direita destacadas.

**Queries:**
- `chat_canais` por id → nome, tipo, descricao
- `chat_mensagens` JOIN `profiles` (autor) JOIN `chat_anexos` → últimas 100 ordenadas por `criada_em`
- Subscribe ao WebSocket da API Go (`/ws`) para receber `chat.message` em tempo real

**Implementar:**
1. Server Component para SSR inicial (mensagens iniciais)
2. Client Component que assume daí pra frente: subscribe WS, scroll-to-bottom, enviar via POST
3. Composer com textarea (Cmd+Enter envia), botão de anexo (placeholder por enquanto)

**Endpoint da API necessário:** `POST /api/v1/chat/canais/:id/mensagens` — **se ainda não existir, peça ao Claude implementar antes**. (Adiciona em `api/internal/handler/handler.go` ou novo `chat.go`.)

**Critério de pronto:** Abrir 2 abas com users diferentes; mensagem enviada de uma aparece na outra em < 2s.

---

### ✅ TASK-003 · `/web/app/(app)/solicitacoes/[id]/page.tsx`
Entregue em 2026-05-12. Página de detalhe criada com header, conversa, notas internas, ações de status/prioridade/responsável, composer e endpoints de atualização/mensagem.

**O que faz:** Detalhe de um ticket — header com assunto/status/prioridade, conversa (estilo email com mensagens públicas e notas internas), ações (atribuir, mudar status, fechar), avaliação NPS no fim.

**Referência visual:** Mais parecido com Linear issue ou Intercom conversation.

**Queries:**
- `solicitacoes` + `empresas` + `profiles!responsavel_id`
- `solicitacao_mensagens` ordenadas
- `solicitacao_anexos`

**Ações:**
- PATCH status (chama endpoint `/api/v1/solicitacoes/:id/status` — pode precisar criar)
- Adicionar mensagem (pública ou interna — `interna: bool`)
- Atribuir responsável

**Endpoints possivelmente faltando** na API Go: criar handlers para `solicitacoes`. Spec rápida:
- `PATCH /api/v1/solicitacoes/:id` — body: `{ status?, responsavel_id?, prioridade? }`
- `POST /api/v1/solicitacoes/:id/mensagens` — body: `{ conteudo, interna }`

Se faltar, **peça ao Claude implementar antes**.

**Critério de pronto:** Toda a conversa visível, dá pra mudar status e adicionar mensagem.

---

### ✅ TASK-004 · `/web/app/(app)/dashboards/page.tsx`
Entregue em 2026-05-12. Página criada com tabs Prazos/Comunicação/Rentabilidade/Produtividade, Recharts e visualizações com dados reais/empty states.

**O que faz:** 4 dashboards gerenciais com gráficos interativos. Tabs no topo: Prazos / Comunicação / Rentabilidade / Produtividade.

**Dependência nova:** Adicionar `recharts` em `web/package.json` (versão `^2.13.0`).

**Estrutura geral:**
- Tab Prazos: KPIs (% no prazo, atrasadas hoje, multa em risco) + heatmap dia×depto + top 10 obrigações com mais atraso
- Tab Comunicação: tempo médio resposta, NPS médio, ranking de clientes em risco
- Tab Rentabilidade: ranking de empresas por margem (honorário − custo estimado), scatter plot
- Tab Produtividade: ranking colaboradores, gráfico de barras entregas/colaborador, taxa de retrabalho

**Queries**: agregações sobre `entregas`, `solicitacoes`, `telemetria_tempo`, `pontos_eventos`. Quando ficar pesado, mover pra view materializada — combinar com Claude antes.

**Critério de pronto:** 4 tabs navegáveis, cada uma com ao menos 2 visualizações renderizando.

---

### ✅ TASK-005 · `/web/app/(app)/conquistas/page.tsx`
Entregue em 2026-05-12. Vitrine criada com catálogo global/local, conquistas desbloqueadas, pontos bônus, níveis e progresso inicial.

**O que faz:** Vitrine de conquistas — todas catalogadas + quais o user já desbloqueou + progresso para as próximas.

**Referência:** O card de gamificação em `web/app/(app)/home/page.tsx` já tem o padrão visual (círculos com ícones Tabler/lucide + cores por nível bronze/prata/ouro).

**Layout sugerido:**
- Header: "Você desbloqueou X de Y conquistas"
- Grid 3-4 colunas, cada conquista em um card:
  - Ícone grande colorido (cor depende de `nivel`)
  - Nome
  - Descrição
  - Pill com "Bronze/Prata/Ouro"
  - Se desbloqueada: data de desbloqueio + bordo verde
  - Se não: barra de progresso (precisa lógica server-side para calcular — começar com 0%)

**Critério de pronto:** Página lista todas as conquistas do catálogo da org + globais (org_id null), distingue visualmente as desbloqueadas.

---

### ✅ TASK-006 · `/web/app/(app)/obrigacoes/page.tsx`
Entregue em 2026-05-12. CRUD inicial criado com catálogo da org, herança de obrigações globais, detalhe com empresas vinculadas e endpoints de vínculo/desvínculo.

**O que faz:** CRUD do catálogo de obrigações da org (não as entregas — o cadastro). Mostra a lista de tipos de obrigação, permite vincular a empresas, ativar/desativar.

**Estrutura:**
- Lista tabular: nome, departamento, periodicidade, dia legal, quantidade de empresas vinculadas
- Botão "Adicionar do catálogo global" → modal mostra obrigações com `org_id IS NULL` que ainda não foram herdadas, marca quais ativar
- Clique em uma obrigação → drawer ou nova rota `/obrigacoes/[id]` com lista de empresas vinculadas e botões para vincular/desvincular

**Para vincular/desvincular**: precisa endpoints na API:
- `POST /api/v1/obrigacao-empresa` body `{ obrigacao_id, empresa_id, responsavel_id? }`
- `DELETE /api/v1/obrigacao-empresa/:id`

**Se faltar, peça ao Claude implementar antes.**

**Critério de pronto:** Lista carrega; dá pra ativar uma obrigação global pra org; dá pra vincular a uma empresa.

---

### ✅ TASK-007 · `/web/app/(app)/configuracoes/page.tsx`
Entregue em 2026-05-12. Configurações criada com abas de equipe, empresas, white-label, plano e pontuação, incluindo endpoints de membros e org.

**Apenas admin/gerente vê** (sidebar já filtra). Tabs:
- **Equipe**: lista de `org_membros` com role + botão "Convidar" (modal com email + role)
- **Empresas**: redirect para `/empresas` (link)
- **White-label**: form para editar `orgs.cor_primaria` e `orgs.logo_url` (upload para Supabase Storage bucket `logos-orgs`)
- **Plano**: card mostrando plano atual + uso atual vs limites + link de "fazer upgrade" (placeholder se ainda não tem Stripe)
- **Regras de pontuação**: tabela editando `regras_pontuacao_org` — cada evento + pontos

**Endpoints da API:**
- `POST /api/v1/org/membros/convidar` (cria org_membros com convite_token)
- `PATCH /api/v1/org/membros/:id` (muda role)
- `DELETE /api/v1/org/membros/:id` (status = 'inativo')
- `PATCH /api/v1/org/configuracoes` (cor_primaria, logo_url)

**Se faltar, peça ao Claude.**

**Critério de pronto:** 4 tabs navegáveis, equipe lista membros, white-label permite editar cor.

---

## 🚀 Prioridade média — Fase 3 (admin)

### ✅ TASK-010 · `/admin/app/(admin)/catalogo/page.tsx`
Entregue em 2026-05-12. Página admin do catálogo global criada com KPIs, tabela e estados vazios.

CRUD do catálogo **global** de obrigações (org_id IS NULL). Você (CECOPEL) mantém aqui — quando um escritório novo cadastra-se, herda essa lista.

Visual igual `/web/(app)/obrigacoes/page.tsx`, mas com origem global.

### ✅ TASK-011 · `/admin/app/(admin)/conquistas/page.tsx`
Entregue em 2026-05-12. Página admin de conquistas globais criada com KPIs, níveis, publicação e tabela.

CRUD do catálogo **global** de conquistas (org_id IS NULL).

### ✅ TASK-012 · `/admin/app/(admin)/faturamento/page.tsx`
Entregue em 2026-05-12. Página de faturamento criada com MRR, assinaturas, faturas abertas e filtro por status.

Lista de assinaturas e faturas de todas as orgs. Filtros por status. Visualização de MRR consolidado.

Query: `assinaturas` + `faturas` + `orgs` + `planos`. Webhooks Stripe vêm em iteração posterior.

### ✅ TASK-013 · `/admin/app/(admin)/telemetria/page.tsx`
Entregue em 2026-05-12. Página de telemetria criada lendo platform_telemetria_dia com KPIs e estado vazio.

Gráficos históricos da plataforma — `platform_telemetria_dia` em linha do tempo. MRR ao longo do tempo, churn, novos signups, entregas/dia, robôs ativos.

### ✅ TASK-014 · `/admin/app/(admin)/robos/page.tsx`
Entregue em 2026-05-12. Página de robôs criada com hosts, status online/offline e filtros por query string.

Tabela de hosts Tauri ativos — `robo_hosts`. Filtros: online/offline, por org. Detalhe mostra arquivos enviados nas últimas 24h.

### ✅ TASK-015 · `/admin/app/(admin)/auditoria/page.tsx`
Entregue em 2026-05-12. Página de auditoria criada com filtros, severidade, org e últimas ações.

Visualizador de `audit_log`. Filtros: por org, ação, severidade, data. Paginação infinita.

---

## ⚙️ Prioridade alta — Fase 5 (parsers do robô)

### ✅ TASK-020 · `robot/src-tauri/src/parser/dctfweb.rs`
Entregue em 2026-05-12. Parser DCTFWeb criado com registro 0000, extração de CNPJ/competência e registro em parser/mod.rs.

Parser do arquivo DCTFWeb. Layout do registro 0000 igual SPED. Extrai CNPJ (campo 5) e competência (campos 2-3 são DT_INI e DT_FIN no formato DDMMYYYY).

**Referência:** `parser/sped.rs` (estrutura idêntica).

Adicionar em `parser/mod.rs::for_tipo`: `"dctfweb" => Some(Box::new(dctfweb::DctfWebParser))`.

### ✅ TASK-021 · `robot/src-tauri/src/parser/dirbi.rs`
Entregue em 2026-05-12. Parser DIRBI tolerante criado para CNPJ e competência em layouts textuais de fornecedores.

Parser DIRBI. Layout próprio — pesquisar IN RFB 2.198/2024. Extrair CNPJ + competência.

### ✅ TASK-022 · `robot/src-tauri/src/parser/esocial.rs`
Entregue em 2026-05-12. Parser XML eSocial criado com quick-xml para CNPJ do empregador e período de apuração.

Parser do XML do eSocial. Usar crate `quick-xml` (adicionar em `Cargo.toml`). Extrair CNPJ do empregador e período de apuração.

### ✅ TASK-023 · `robot/src-tauri/icons/`
Entregue em 2026-05-12. PNG-base placeholder 1024 gerado e `npm run tauri icon src-tauri/icons/source.png` executado com sucesso.

Gerar ícones com `npm run tauri icon` a partir de um PNG-base 1024x1024.

---

## 🆕 Features inspiradas no sistema antigo (prioridade média)

Olhamos o `cecopel-gestao/index.html` atual em 2026-05-12 e identificamos 5 features que valem portar para o CECOPEL 2.0. Implementar depois das prioridades 🔥, antes do backlog técnico.

### ✅ TASK-050 · Modo TV / Wallboard
Entregue em 2026-05-12. Rota pública `/tv?token=...`, endpoint agregado, token por org, link em configurações e wallboard dark com 6 cards/revalidate 60s implementados.

**O que faz:** Tela cheia "modo apresentação" para projetar na parede do escritório (TV de 50"+, sem interação). Mostra em um dashboard único o que importa: mural fixado, kanban resumido, obrigações vencendo nos próximos 7 dias, ranking semanal, NPS médio do mês.

**Por que importa:** Diferencial competitivo grande. Acessórias não tem. Ideal para reunião de segunda de manhã.

**Localização:** `web/app/(app)/tv/page.tsx` (sem layout autenticado normal — usar `web/app/tv/layout.tsx` próprio, fundo escuro, sem sidebar).

**Estrutura sugerida:**
- Grid 2x3 ou 3x2 com 5-6 cards grandes:
  1. Mural — 3 posts fixados/recentes (auto-rotação a cada 15s)
  2. Kanban resumido — contadores por status × departamento
  3. Obrigações vencendo — top 10 com prazo nos próximos 7 dias, destaca atrasadas em vermelho
  4. Ranking semanal — top 5 colaboradores em pontos (cores ouro/prata/bronze)
  5. Solicitações abertas — quantidade por prioridade
  6. KPIs do mês — % no prazo, NPS médio, entregas total

**Auto-refresh:** revalidar dados a cada 60s (Next.js `revalidate = 60` na page). Sem WebSocket — TV não precisa ser instantâneo.

**Estilo:** dark mode obrigatório, tipografia grande (mínimo 18px para texto), cores fortes, alto contraste. Pode usar Inter ou DM Sans em peso 700+.

**Acesso:** rota pública dentro da org mas exige token via query (`/tv?token=abc123`) gerado em `/configuracoes` pelo admin do escritório. Salvar token em `orgs.tv_token` (migration nova mini).

**Critério de pronto:** abrir em F11 (fullscreen) numa TV mostra os 6 cards rotacionando dados reais, sem precisar de mouse.

---

### ✅ TASK-051 · Kanban interno com recorrências e co-responsável
Entregue em 2026-05-12. Schema Kanban, worker horário de recorrências, endpoints de tarefas e tela em colunas com criação/mudança de status implementados.

**O que faz:** Módulo de tarefas internas do escritório (separado das obrigações fiscais). Cada tarefa tem responsável, co-responsável, prioridade, prazo, checklist interno, comentários. Suporta tarefas pontuais e recorrentes ("toda segunda revisar X").

**Schema novo** (criar migration `017_kanban_interno.sql`):

```sql
CREATE TYPE app.kanban_status AS ENUM ('a_fazer', 'em_andamento', 'concluido', 'cancelado');
CREATE TYPE app.kanban_prioridade AS ENUM ('baixa', 'media', 'alta', 'urgente');

CREATE TABLE public.kanban_tarefas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descricao TEXT,
    departamento app.departamento,
    prioridade app.kanban_prioridade NOT NULL DEFAULT 'media',
    status app.kanban_status NOT NULL DEFAULT 'a_fazer',
    responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    co_responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,  -- opcional
    prazo DATE,
    concluido_em TIMESTAMPTZ,
    recorrente_id UUID REFERENCES public.kanban_recorrencias(id) ON DELETE SET NULL,  -- preenchido se foi gerada por recorrência
    criada_por_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.kanban_recorrencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descricao TEXT,
    departamento app.departamento,
    prioridade app.kanban_prioridade NOT NULL DEFAULT 'media',
    responsavel_id UUID REFERENCES auth.users(id),
    co_responsavel_id UUID REFERENCES auth.users(id),
    periodicidade app.periodicidade NOT NULL,  -- diaria, semanal, mensal, anual
    dia_semana INT,    -- 0-6, para periodicidade semanal
    dia_mes INT,       -- 1-31, para periodicidade mensal
    horario TIME,      -- opcional, hora em que gera no dia
    proxima_geracao DATE NOT NULL,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.kanban_checklist_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarefa_id UUID NOT NULL REFERENCES public.kanban_tarefas(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    concluido BOOLEAN NOT NULL DEFAULT FALSE,
    ordem INT NOT NULL DEFAULT 0,
    concluido_por_id UUID REFERENCES auth.users(id),
    concluido_em TIMESTAMPTZ
);

CREATE TABLE public.kanban_comentarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarefa_id UUID NOT NULL REFERENCES public.kanban_tarefas(id) ON DELETE CASCADE,
    autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    conteudo TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Aplicar RLS em todas: pertence à org. Adicionar índices por org_id+status, responsavel_id, recorrente_id.

**Worker novo:** `api/internal/jobs/kanban_recorrencias.go` roda a cada hora — para cada `kanban_recorrencias.ativa = TRUE` com `proxima_geracao <= now()`, cria nova `kanban_tarefas` e atualiza `proxima_geracao` para a próxima ocorrência.

**Endpoints novos** (em `api/internal/handler/kanban.go`):
- `GET /api/v1/kanban/tarefas?status=&dept=&responsavel=&q=`
- `POST /api/v1/kanban/tarefas`
- `PATCH /api/v1/kanban/tarefas/:id` (campos editáveis: titulo, descricao, status, prioridade, responsavel, co_responsavel, prazo)
- `DELETE /api/v1/kanban/tarefas/:id`
- `POST /api/v1/kanban/tarefas/:id/checklist`
- `PATCH /api/v1/kanban/tarefas/:id/checklist/:itemId` (toggle concluido)
- `POST /api/v1/kanban/tarefas/:id/comentarios`
- `GET /api/v1/kanban/recorrencias`
- `POST /api/v1/kanban/recorrencias` / `PATCH /:id` / `DELETE /:id`

**Telas no web/:**
- `app/(app)/kanban/page.tsx` — 4 colunas drag-drop (A fazer, Em andamento, Concluído, Cancelado) com filtros (departamento, prioridade, responsável), tabs "Tarefas" e "Recorrências"
- `app/(app)/kanban/[id]/page.tsx` ou modal — detalhe com checklist editável e timeline de comentários

**Adicionar** "kanban" ao `modulos_catalogo` (já existe na migration 016, confirmar).

**Critério de pronto:** dá pra criar tarefa, arrastar entre colunas, criar recorrência semanal "toda segunda - revisar SPED" e o worker gerar a próxima na hora correta.

---

### ✅ TASK-052 · Co-responsável em entregas (e empresa_responsaveis já tem isso)
Entregue em 2026-05-12. `co_responsavel_id` adicionado ao schema/model/API, filtro de repo e exibição de auxiliar na lista e detalhe de entregas.

**O que faz:** Adicionar campo `co_responsavel_id` em `entregas` para que uma entrega tenha responsável principal + um auxiliar. Útil quando o trainee faz e o sênior revisa.

**Migration mini** (`018_co_responsavel.sql`):

```sql
ALTER TABLE public.entregas
  ADD COLUMN co_responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_entregas_co_responsavel ON public.entregas(co_responsavel_id)
  WHERE co_responsavel_id IS NOT NULL;
```

**Mudanças:**
- `api/internal/models/models.go::Entrega` → adicionar campo
- `api/internal/repo/repo.go::ListEntregas` e `UpdateEntregaStatus` → ler/escrever
- `web/lib/api.ts::Entrega` → adicionar campo
- `web/app/(app)/entregas/page.tsx` → mostrar avatar do co-responsável na tabela
- `web/app/(app)/entregas/[id]/page.tsx` → seção "Responsáveis" com principal + auxiliar
- Filtro `?co_responsavel=` na listagem (mostra entregas em que sou auxiliar)

**Critério de pronto:** atribuir co-responsável a uma entrega; a entrega aparece também quando filtro por "minhas entregas como auxiliar".

---

### ✅ TASK-053 · Frequência (controle de presença, atrasos, faltas)
Entregue em 2026-05-12. Schema de frequência/fechamento, endpoints de matriz/registro/fechamento e tela mensal em RH implementados.

**O que faz:** Módulo dentro do RH. Por colaborador × dia, registra: presente/falta/folga/atestado, horário de chegada (atraso = chegou depois de X), justificativa. Após fechar o mês, fica read-only exceto para admin da org.

**Schema novo** (`019_frequencia.sql`):

```sql
CREATE TYPE app.frequencia_status AS ENUM ('presente', 'falta', 'folga', 'atestado', 'home_office', 'ferias');

CREATE TABLE public.frequencia_diaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    status app.frequencia_status NOT NULL DEFAULT 'presente',
    horario_chegada TIME,
    minutos_atraso INT DEFAULT 0,
    justificativa TEXT,
    registrado_por_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, user_id, data)
);

CREATE TABLE public.frequencia_meses_fechados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    competencia CHAR(7) NOT NULL,  -- 'yyyy-MM'
    fechado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    fechado_por_id UUID NOT NULL REFERENCES auth.users(id),
    UNIQUE (org_id, competencia)
);
```

**Lógica de lock:** RLS policy em `frequencia_diaria` para UPDATE/DELETE — não permite se existe registro em `frequencia_meses_fechados` para `to_char(data, 'YYYY-MM')` daquela linha, exceto se o user é admin da org (role = 'admin'). Implementar via função `app.frequencia_pode_editar(data, org_id)`.

**Endpoints:**
- `GET /api/v1/frequencia?competencia=2026-05&departamento=` — matriz mensal: colaborador × dia × status
- `PATCH /api/v1/frequencia/:user_id/:data` — body `{ status, horario_chegada, justificativa }`
- `POST /api/v1/frequencia/fechar-mes` — body `{ competencia }`. Cria linha em meses_fechados.
- `POST /api/v1/frequencia/reabrir-mes` — admin-only.

**Telas:**
- `web/app/(app)/rh/frequencia/page.tsx` — grid colaborador × dia do mês. Cores: verde=presente, vermelho=falta, amarelo=atraso, azul=folga, cinza=fim de semana. Click numa célula abre modal de edição.
- Header com select de mês + select de departamento + botão "Fechar mês" (visível só pra admin).
- Banner "Mês fechado em <data>" quando read-only.

**Critério de pronto:** registrar presença de 5 colaboradores ao longo de uma semana; fechar o mês; tentar editar uma célula daquele mês → erro 403 (a menos que admin).

---

### ✅ TASK-054 · Premiações por setor — automático vs manual
Entregue em 2026-05-12. Departamentos por org, triggers de pontos automáticos, endpoints, tela de configuração/lançamento manual e pill na home implementados.

**O que faz:** Cada departamento da org configura SE a pontuação é gerada automaticamente (regra fixa pelas entregas) ou MANUAL (gerente lança no fechamento do mês). Decidido pelo Gabriel: **Fiscal e Pessoal = automático**; **Contábil = manual**; outros = configurável.

**Schema novo** (`020_org_departamentos.sql`):

```sql
CREATE TYPE app.premiacao_modo AS ENUM ('automatico', 'manual');

CREATE TABLE public.org_departamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    codigo app.departamento NOT NULL,
    nome TEXT NOT NULL,
    gerente_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- metas informativas (aparecem no header da página do dept)
    meta_perc_no_prazo NUMERIC(5,2) DEFAULT 98.00,
    meta_dias_antecedencia INT DEFAULT 2,
    -- premiação
    premiacao_modo app.premiacao_modo NOT NULL DEFAULT 'manual',
    descricao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, codigo)
);

-- Trigger: ao criar uma org, popula org_departamentos com defaults
-- (Fiscal=automatico, Pessoal=automatico, Contábil=manual, demais=manual)
CREATE OR REPLACE FUNCTION app.popular_departamentos_padrao() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.org_departamentos (org_id, codigo, nome, premiacao_modo, meta_perc_no_prazo)
    VALUES
        (NEW.id, 'contabil',   'Contábil',   'manual',     98),
        (NEW.id, 'fiscal',     'Fiscal',     'automatico', 98),
        (NEW.id, 'pessoal',    'Pessoal',    'automatico', 98),
        (NEW.id, 'societario', 'Societário', 'manual',     NULL),
        (NEW.id, 'comercial',  'Comercial',  'manual',     NULL);
    RETURN NEW;
END $$;

CREATE TRIGGER trg_orgs_after_insert_departamentos
    AFTER INSERT ON public.orgs
    FOR EACH ROW EXECUTE FUNCTION app.popular_departamentos_padrao();
```

**Lógica automática** (criar trigger novo em `021_pontos_automaticos.sql`):
- Quando `entregas.status` muda para `'entregue'`:
  - Buscar `org_departamentos.premiacao_modo` por `(org_id, departamento)`
  - SE `automatico`:
    - Calcular diferença em dias entre `entregue_em::date` e `prazo_legal`
    - Se entregue antes do prazo - 3 dias → INSERT `pontos_eventos` com evento `entrega_antecipada` (+15 ou valor de `regras_pontuacao_org`)
    - Se entregue até o prazo → `entrega_no_prazo` (+10)
    - Se status virou `atrasada` antes de virar entregue → soma também `entrega_atrasada` (-5)
  - SE `manual`: não faz nada — fica para o gerente lançar via UI

**Endpoints novos:**
- `GET /api/v1/org/departamentos` — lista os 5 departamentos da org com configs
- `PATCH /api/v1/org/departamentos/:codigo` — body `{ premiacao_modo?, meta_perc_no_prazo?, meta_dias_antecedencia?, gerente_id? }`
- `POST /api/v1/pontos/lancamento-manual` — admin/gerente lança pontos manualmente. Body: `{ user_id, evento, pontos, justificativa, referencia_tipo?, referencia_id? }`. Cria `pontos_eventos` com `criado_por_id` preenchido.

**Tela admin do escritório** (`web/app/(app)/configuracoes/departamentos/page.tsx`):
- Lista os 5 departamentos
- Em cada um, editar: gerente, meta %, premiação modo (toggle automático/manual)
- Se modo = manual, mostra botão "Lançar pontos do mês" → modal com lista de colaboradores do dept + campo de pontos + justificativa para cada um

**Tela do colaborador** (já existe em `web/app/(app)/home/page.tsx`):
- Já mostra pontos do mês. Adicionar pill discreto indicando "Pontos lançados automaticamente" ou "Aguardando fechamento manual do gerente" conforme `org_departamentos.premiacao_modo` do dept do user.

**Crítico:** Migration 020 + 021 + endpoints + tela admin + tela "Lançar manual". Implementar tudo de uma vez (é um fluxo único).

**Critério de pronto:**
- Criar org nova → trigger popula os 5 departamentos com Fiscal/Pessoal automáticos, Contábil manual
- Atribuir entrega ao Fiscal, marcar como entregue no prazo → pontos_eventos +10 aparece sozinho
- Atribuir entrega ao Contábil, marcar como entregue no prazo → nenhum pontos_eventos
- Gerente do Contábil acessa "Lançar pontos do mês" e lança +50 para Caroline → registro criado
- Cada colaborador vê seus pontos atualizados na home

---

### ✅ TASK-055 · Módulo Análise de Balancete

Entregue em 2026-05-12. Schema/API de balancetes, importação XLSX/manual, indicadores portados do módulo antigo, comparativo mês a mês, fechamento read-only e exportação via impressão/PDF implementados.

**O que faz:** Importar/lançar balancete mensal das empresas, gerar análise comparativa (mês a mês, ano a ano), indicadores contábeis (liquidez corrente, endividamento, margem líquida), variações destacadas (>20% vermelho), exportar relatório em PDF.

**Referência no sistema antigo:** `cecopel-gestao/analise-contabil.html` (251KB) — é um módulo bem completo já em produção. **Antes de implementar do zero, leia esse arquivo** para entender as funcionalidades, padrões de cálculo e layout. Tudo o que vale é portar, modernizar visualmente, manter a lógica de cálculo intacta.

**Schema novo** (`022_balancete.sql`):

```sql
CREATE TABLE public.balancetes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    competencia CHAR(7) NOT NULL,                -- yyyy-MM
    fechado BOOLEAN NOT NULL DEFAULT FALSE,
    fechado_em TIMESTAMPTZ,
    fechado_por_id UUID REFERENCES auth.users(id),
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, competencia)
);

CREATE TABLE public.balancete_contas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    balancete_id UUID NOT NULL REFERENCES public.balancetes(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,                        -- ex: '1.1.01.001'
    descricao TEXT NOT NULL,
    grupo TEXT,                                  -- 'ativo','passivo','dre' etc.
    saldo_anterior NUMERIC(18,2) NOT NULL DEFAULT 0,
    debito NUMERIC(18,2) NOT NULL DEFAULT 0,
    credito NUMERIC(18,2) NOT NULL DEFAULT 0,
    saldo_atual NUMERIC(18,2) NOT NULL DEFAULT 0,
    natureza CHAR(1) CHECK (natureza IN ('D','C')),
    ordem INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_balancete_contas_balancete ON public.balancete_contas(balancete_id);
CREATE INDEX idx_balancete_empresa_compet ON public.balancetes(empresa_id, competencia DESC);
```

**Endpoints** (`api/internal/handler/balancete.go`):
- `GET /api/v1/balancetes?empresa_id=&competencia=&limit=`
- `POST /api/v1/balancetes` — body `{ empresa_id, competencia }` (cria vazio)
- `GET /api/v1/balancetes/:id` — com array de contas
- `POST /api/v1/balancetes/:id/contas` — bulk insert/replace das contas (input do contador OU import de planilha XLSX no frontend)
- `PATCH /api/v1/balancetes/:id/fechar`
- `GET /api/v1/balancetes/comparativo?empresa_id=&competencias=2026-04,2026-05` — devolve 2 balancetes alinhados por código de conta

**Telas (`web/app/(app)/balancete/`):**
- `page.tsx` — lista das empresas, com último balancete + status (aberto/fechado/atrasado)
- `[empresaId]/page.tsx` — timeline de balancetes da empresa (12 meses), comparativo lado-a-lado mês×mês, indicadores no topo (Liquidez, Endividamento, Margem)
- `[empresaId]/[competencia]/page.tsx` — detalhe com tabela de contas + variações em destaque + botão "Exportar PDF"

**Import de planilha:** lib `xlsx` (SheetJS). Mapping de colunas: código, descrição, saldo anterior, débito, crédito, saldo. UI mostra preview antes de salvar.

**Indicadores calculados automaticamente:**
- Liquidez Corrente = AC / PC
- Liquidez Geral = (AC + ARLP) / (PC + PNC)
- Endividamento = (PC + PNC) / Ativo Total
- Margem Líquida = Resultado / Receita Bruta

**Crítica importante:** o módulo antigo já tem essas fórmulas funcionando. **Não reinvente.** Copie a lógica de cálculo do `analise-contabil.html` (procurar funções `calcularIndicadores`, `compararMeses`, etc.), só refatore para TypeScript + Server Component.

**Critério de pronto:** criar balancete de uma empresa para Maio/2026, lançar 10 contas manualmente, abrir comparativo Abril/Maio mostrando variações em vermelho/verde, fechar o balancete (vira read-only).

---

### ✅ TASK-056 · Módulo IRPF (declaração anual)
Entregue em 2026-05-12 pelo Claude (de onde Codex parou). Backend completo: models/irpf.go, repo/irpf.go (CRUD + recálculo automático com tabela 2025 da Receita), handler/irpf.go (12 endpoints), rotas em server.go. Frontend: web/lib/irpf.ts + 4 páginas (/irpf dashboard, /irpf/declarantes lista+modal, /irpf/declaracoes lista filtrável por status, /irpf/declaracoes/[id] wizard com 4 grupos de lançamentos + botões Recalcular e Mudar status). Migration 038 e services/irpf_tabela.go já existiam.

**O que faz:** Gestão completa de declarações de IRPF dos clientes do escritório. Cadastro de declarantes (PF), importação de informes de rendimentos, lançamento de deduções (médica, educação, dependentes), cálculo do imposto devido/restituir, controle de status (em coleta, em processamento, entregue, em malha), upload do recibo da Receita.

**Referência no sistema antigo:** `cecopel-gestao/irpf.html` (149KB) + migration `supabase_irpf_migration.sql` (119KB) — o sistema antigo tem isso completo. **Leia ambos antes de implementar.**

**Schema novo** (`023_irpf.sql`) — basear-se no schema antigo (já testado), porém adaptar para multi-tenant:

```sql
CREATE TYPE app.irpf_status AS ENUM (
    'a_iniciar',         -- não começou a coleta
    'coletando',         -- escritório pedindo docs ao cliente
    'em_processamento',  -- escritório calculando
    'aguardando_cliente',-- aguardando confirmação/assinatura
    'entregue',          -- declaração transmitida
    'em_malha',          -- caiu na malha fina
    'retificada',
    'cancelada'
);

CREATE TYPE app.irpf_situacao_final AS ENUM ('a_restituir', 'a_pagar', 'sem_imposto');

CREATE TABLE public.irpf_declarantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,  -- vinculado a uma empresa atendida (sócio)
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

CREATE TABLE public.irpf_declaracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    declarante_id UUID NOT NULL REFERENCES public.irpf_declarantes(id) ON DELETE CASCADE,
    exercicio INT NOT NULL,                       -- ex: 2026 (referente a 2025)
    ano_calendario INT NOT NULL,                  -- ex: 2025
    status app.irpf_status NOT NULL DEFAULT 'a_iniciar',
    responsavel_id UUID REFERENCES auth.users(id),
    -- totais (preenchidos conforme lançamentos)
    rendimentos_total_cents BIGINT NOT NULL DEFAULT 0,
    deducoes_total_cents BIGINT NOT NULL DEFAULT 0,
    imposto_devido_cents BIGINT NOT NULL DEFAULT 0,
    imposto_retido_cents BIGINT NOT NULL DEFAULT 0,
    saldo_cents BIGINT NOT NULL DEFAULT 0,        -- positivo=a pagar, negativo=a restituir
    situacao_final app.irpf_situacao_final,
    recibo_url TEXT,                              -- link do PDF do recibo
    transmitida_em TIMESTAMPTZ,
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (declarante_id, exercicio)
);

CREATE TYPE app.irpf_lancamento_tipo AS ENUM (
    'rendimento_tributavel', 'rendimento_isento', 'rendimento_exclusivo',
    'deducao_medica', 'deducao_educacao', 'deducao_previdencia', 'deducao_pensao',
    'dependente', 'bem_direito', 'divida'
);

CREATE TABLE public.irpf_lancamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    declaracao_id UUID NOT NULL REFERENCES public.irpf_declaracoes(id) ON DELETE CASCADE,
    tipo app.irpf_lancamento_tipo NOT NULL,
    fonte_pagadora TEXT,                          -- nome do banco/empresa/médico
    fonte_cnpj TEXT,
    descricao TEXT,
    valor_cents BIGINT NOT NULL DEFAULT 0,
    imposto_retido_cents BIGINT NOT NULL DEFAULT 0,
    documento_url TEXT,                           -- comprovante anexado
    payload JSONB,                                -- campos extras conforme o tipo
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_irpf_declarantes_org ON public.irpf_declarantes(org_id);
CREATE INDEX idx_irpf_declaracoes_status ON public.irpf_declaracoes(org_id, status, exercicio);
CREATE INDEX idx_irpf_lancamentos_decl ON public.irpf_lancamentos(declaracao_id, tipo);
```

**Endpoints** (`api/internal/handler/irpf.go`):
- `GET/POST /api/v1/irpf/declarantes`
- `GET/PATCH /api/v1/irpf/declarantes/:id`
- `GET /api/v1/irpf/declaracoes?exercicio=2026&status=`
- `POST /api/v1/irpf/declaracoes`
- `GET/PATCH /api/v1/irpf/declaracoes/:id`
- `POST /api/v1/irpf/declaracoes/:id/lancamentos` (bulk)
- `DELETE /api/v1/irpf/lancamentos/:id`
- `POST /api/v1/irpf/declaracoes/:id/calcular` — recalcula imposto a partir dos lançamentos
- `POST /api/v1/irpf/declaracoes/:id/transmitir` — marca como entregue + upload do recibo

**Cálculo de imposto:** usar a tabela progressiva da Receita do ano-calendário. Hardcoded em `api/internal/services/irpf_tabela.go` (com função `CalcularImpostoIRPF(rendimentos, deducoes, ano int) int64`). Atualizar anualmente.

**Telas (`web/app/(app)/irpf/`):**
- `page.tsx` — dashboard do exercício atual: contadores por status (a iniciar, coletando, entregues, em malha), gráfico de progresso, valor total a restituir/pagar
- `declarantes/page.tsx` — CRUD de declarantes (PF clientes do escritório)
- `declaracoes/page.tsx` — lista das declarações do exercício, filtros, busca
- `declaracoes/[id]/page.tsx` — wizard em tabs: Identificação, Rendimentos, Deduções, Bens, Dívidas, Resumo (com botão "Calcular" e "Transmitir")

**Crítica importante:** copie cabeça/rabo a estrutura de cálculo do `irpf.html` antigo. O cálculo da Receita é regra de negócio crítica — não invente, replique.

**Critério de pronto:** cadastrar declarante, criar declaração 2026, lançar 3 rendimentos + 1 dedução médica, clicar "Calcular" → mostra imposto a restituir/pagar correto, transmitir (mock) → status vira `entregue`.

---

## 🧠 Cortex IA — Copiloto agentic (prioridade alta)

> Antes de tocar essas TASKs, leia `BRAND.md` na raiz. A IA se chama **Cortex** (mesmo nome do sistema), usa o ramp de cor `mind-*` (violeta) e o conceito visual de "cérebro do escritório".
>
> Modelo padrão: **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) para chat normal; **Sonnet 4.6** (`claude-sonnet-4-6`) para análise contábil pesada. Provider de embeddings: **Voyage AI** (qualidade PT-BR superior, ~$0.05/M tokens).

### ✅ TASK-060 · Cortex v1 — Consultor (leitura)
Entregue em 2026-05-12. Drawer Cmd+K com avatar hexagonal, SSE, histórico, tool cards e endpoints/migration Cortex v1 implementados com consultas reais de leitura.

**O que faz:** drawer lateral direito em todas as páginas autenticadas do `web/`. Cmd+K abre, ESC fecha. Conversa em streaming via SSE. Cortex responde perguntas lendo dados reais via tool-calling do Claude.

**Visual:** segue `BRAND.md` — avatar do Cortex como hexágono geométrico com node central, fundo `mind-100`, drawer com header `mind-500`. Pulsação neural enquanto streaming roda.

**Migrations** (`024_cortex.sql`):

```sql
CREATE TYPE app.ai_papel AS ENUM ('user', 'assistant', 'system', 'tool');

CREATE TABLE public.cortex_conversas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    titulo TEXT,
    contexto_pagina TEXT,
    arquivada BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cortex_mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    conversa_id UUID NOT NULL REFERENCES public.cortex_conversas(id) ON DELETE CASCADE,
    papel app.ai_papel NOT NULL,
    conteudo TEXT,
    tool_chamadas JSONB,
    tokens_in INT,
    tokens_out INT,
    modelo TEXT,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cortex_ferramentas_executadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversa_id UUID REFERENCES public.cortex_conversas(id) ON DELETE SET NULL,
    mensagem_id UUID REFERENCES public.cortex_mensagens(id) ON DELETE SET NULL,
    ferramenta TEXT NOT NULL,
    args JSONB,
    resultado JSONB,
    erro TEXT,
    duracao_ms INT,
    executada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cortex_conv_user ON public.cortex_conversas(org_id, user_id, updated_at DESC);
CREATE INDEX idx_cortex_msg_conv ON public.cortex_mensagens(conversa_id, criada_em);
CREATE INDEX idx_cortex_tool_user ON public.cortex_ferramentas_executadas(org_id, user_id, executada_em DESC);
```

RLS: cada user só vê suas conversas (`user_id = app.current_user_id()`). Super-admin vê tudo.

**Endpoints na API Go** (`api/internal/handler/cortex.go`):
- `POST /api/v1/cortex/conversas` — cria conversa
- `GET /api/v1/cortex/conversas` — lista do user
- `GET /api/v1/cortex/conversas/:id` — detalhe + mensagens
- `POST /api/v1/cortex/conversas/:id/mensagens` — envia mensagem, retorna SSE com streaming
- `DELETE /api/v1/cortex/conversas/:id`

**System prompt** (em `api/internal/services/cortex_prompt.go`, ~3000 tokens):
- "Você é Cortex, o cérebro do escritório contábil. Seja conciso, profissional, em PT-BR..."
- Schema completo do banco (tabelas chave + enums)
- Lista dos módulos do produto e o que cada um faz
- Regra crítica: "NUNCA afirme legislação de memória. Sempre chame `consultar_legislacao` primeiro. Sempre cite a fonte (Lei X, IN RFB Y)."
- Persona conforme `BRAND.md` (tom de voz)

**Tools v1 (leitura)** em `api/internal/services/cortex_tools.go`:
```go
// - meu_perfil()
// - listar_entregas(status?, dept?, q?)
// - detalhe_entrega(id)
// - listar_empresas(q?, status?)
// - detalhe_empresa(id)
// - consultar_obrigacao(codigo_ou_nome)
// - listar_solicitacoes(status?, empresa_id?)
// - meu_ranking()
// - estatisticas_dept(dept, periodo?)
// - obter_data_hoje()
```

Cada tool aplica RLS via `WithTenant`.

**Frontend** (`web/components/cortex/`):
- `drawer.tsx` — drawer lateral 400px, slide-in da direita
- `launcher.tsx` — botão flutuante (mind-500) canto inferior direito + binding global Cmd+K
- `message-bubble.tsx` — mensagem com avatar hexagonal do Cortex / avatar do user
- `tool-call-card.tsx` — card expandível "Cortex consultou: listar_entregas → 12 resultados"
- `streaming.ts` — utility para consumir SSE com ReadableStream
- Usar `mind-*` no fundo do drawer e nos elementos de IA

**Permissionamento:** módulo `ai` em `org_modulos`. Pro e Enterprise herdam por padrão. Free não vê.

**Rate limit:** 50 msg/h para Pro, 500 para Enterprise. Memória do processo Go (mapa simples).

**Custo estimado:** Haiku ~$0.25/M tokens. Conversa média 8k in + 2k out × 30/dia × 30 = ~900k/mês × $0.25/M = **$0.22 por usuário ativo/mês**. Absorvido no plano Pro (R$ 149).

**Critério de pronto:** Cmd+K abre drawer; perguntar "quantas entregas atrasadas?" devolve resposta em streaming < 5s; histórico salva; tool call aparece como card expandível na conversa; ações ficam auditadas em `cortex_ferramentas_executadas`.

---

### TASK-061 · Cortex v2 — Legislação viva (RAG)

**O que faz:** Cortex passa a conhecer legislação brasileira atualizada. Pergunta "como calcula DAS anexo III em 2026" → busca em vetor, cita trecho legal, fornece referência.

**Migrations** (`025_cortex_rag.sql`):

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE app.lei_tipo AS ENUM (
    'in_rfb', 'lei', 'decreto', 'instrucao_normativa',
    'portaria', 'resolucao', 'manual', 'tabela', 'outro'
);

CREATE TABLE public.cortex_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo app.lei_tipo NOT NULL,
    titulo TEXT NOT NULL,
    referencia TEXT NOT NULL,
    orgao TEXT,
    data_publicacao DATE,
    data_vigencia_inicio DATE,
    data_vigencia_fim DATE,
    url_original TEXT,
    departamento app.departamento[],
    tema TEXT[],
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cortex_documento_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id UUID NOT NULL REFERENCES public.cortex_documentos(id) ON DELETE CASCADE,
    ordem INT NOT NULL,
    titulo_secao TEXT,
    conteudo TEXT NOT NULL,
    tokens INT,
    embedding vector(1024),  -- Voyage voyage-3-large = 1024 dim (ou 1536 se OpenAI 3-small)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.cortex_documento_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_cortex_doc_tema ON public.cortex_documentos USING gin (tema);
```

**Documentos para primeira leva** (script `api/cmd/ingest_legislacao/main.go`):
- LC 123/2006 (Lei do Simples Nacional) + alterações vigentes
- Anexos I a V do Simples Nacional (alíquotas e faixas)
- IN RFB 2.005/2021 (DCTFWeb)
- IN RFB 2.198/2024 (DIRBI)
- IN RFB 1.252/2012 (SPED EFD-Contribuições)
- IN RFB 2.043/2021 (eSocial)
- Decreto 8.373/2014 (eSocial regulamentação)
- Lei 9.250/1995 (IRPF — atualizada)
- Tabela IRPF 2026
- Tabela INSS 2026
- Manual eSocial v1.3
- Lei 6.404/76 (Sociedades por Ações)
- CTN (artigos relevantes)

**Pipeline:**
1. Download PDF/HTML manualmente para `infra/legislacao/raw/`
2. Script `ingest_legislacao` faz: extrai texto, chunks ~500 tokens com 50 overlap, gera embedding Voyage, INSERT em `cortex_documento_chunks`
3. Idempotente — pode rodar quantas vezes quiser

**Tool nova** em `cortex_tools.go`:
```go
// consultar_legislacao(pergunta, tema?, tipo?, top_k=5)
// retorna {chunks: [{titulo, conteudo, referencia, url, similaridade}]}
```

Implementação:
1. Embed da pergunta via Voyage API
2. `SELECT ... FROM cortex_documento_chunks ORDER BY embedding <=> $1 LIMIT 5`
3. Filtra por tema/tipo se fornecido
4. Devolve trechos para Cortex incluir no contexto

**Worker** `api/internal/jobs/legislacao_watcher.go` (mensal):
- Scrape `in.normas.receita.fazenda.gov.br`
- Detecta INs novas comparando com `cortex_documentos.referencia`
- Se nova, baixa + processa + ingere
- Posta no mural global da CECOPEL: "Nova IN RFB X/2026 ingerida no Cortex"

**System prompt** atualizado: "Para legislação, alíquota, prazo legal, regra fiscal — SEMPRE chame `consultar_legislacao` primeiro. NUNCA afirme de memória. SEMPRE cite a fonte."

**Critério de pronto:** ingerir 5 docs; perguntar "DAS para Anexo III com receita R$ 50.000/mês em 2026" → Cortex chama `consultar_legislacao`, cita Anexo III LC 123/2006, dá o resultado.

---

### TASK-062 · Cortex v3 — Agente que age ✅

**Status:** entregue 2026-05-12.

**Entregue:**
- Migration `040_cortex_acoes.sql`: tabelas `cortex_acoes_pendentes` (status enum pendente/confirmada/cancelada/falhou, expira em 1h) e `cortex_permissoes_org` (roles_permitidas[]). Trigger popula defaults por org.
- Repo `repo/cortex_acoes.go`: `DetectarAcao` (regex), `CreateCortexAcao`, `ListCortexAcoesPendentes`, `ConfirmarCortexAcao` (com validação de permissão + roles), `CancelarCortexAcao`, dispatch `executarFerramenta` com 5 tools (`criar_tarefa_kanban`, `mudar_status_entrega`, `postar_mural`, `lancar_pontos_manual`, `responder_solicitacao`). `ListCortexPermissoes` e `UpdateCortexPermissao` (upsert).
- Handler `handler/cortex_acoes.go`: `GET /cortex/acoes`, `POST /cortex/acoes/:id/confirmar` (409 expirada/processada, 403 não permitida, 422 falhou), `POST /cortex/acoes/:id/cancelar`, `GET /cortex/permissoes`, `PATCH /cortex/permissoes/:ferramenta`.
- `handler/cortex.go` integrado: quando `DetectarAcao` retorna intenção, emite SSE `acao_proposta` em vez de executar tool read-only.
- Frontend: `web/components/cortex/action-card.tsx` (Confirmar/Cancelar com estados pendente/confirmada/falhou/expirada). Drawer renderiza inline. `web/app/(app)/configuracoes/cortex/page.tsx` para admin/gerente controlar permissões por role.

**Próximo (v3.5):** trocar `DetectarAcao` regex pela tool-calling estruturada do Claude (depende de TASK-061 RAG).

---

#### Snapshot original (mantido para referência)

**O que faz:** Cortex sai de só consultivo → executa ações sob confirmação visual. "Cria tarefa pra Carol revisar IRPF Aquarela amanhã 14h" → Cortex propõe o card, user clica Confirmar, executa.

**Tools v3 (escrita — exigem confirmação por padrão):**

```go
// - criar_tarefa_kanban(titulo, descricao?, responsavel?, prazo?, prioridade?)
// - mudar_status_entrega(entrega_id, novo_status, protocolo?, observacoes?)
// - lancar_pontos_manual(user_id, pontos, justificativa)
// - postar_mural(conteudo, categoria?, fixado?)
// - responder_solicitacao(solicitacao_id, mensagem, interna=false)
// - agendar_lembrete(quando, conteudo, para_user_id?)
// - convidar_membro(email, role, departamento?)
// - criar_recorrencia_kanban(titulo, periodicidade, dia?, responsavel?)
```

Cada tool tem flag `requires_confirmation` (default `true`).

**Fluxo UI:**

1. Cortex decide chamar `criar_tarefa_kanban(...)`
2. Em vez de executar direto, devolve mensagem tipo `tool_call_proposed`
3. UI renderiza card: "Cortex quer criar tarefa: 'Revisar IRPF Aquarela' para Carol, amanhã 14h. [Confirmar] [Editar] [Cancelar]"
4. User confirma → `POST /api/v1/cortex/conversas/:id/confirmar` com `{ tool_call_id }`
5. Backend executa, devolve resultado, Cortex continua a conversa

**Tabela** `cortex_permissoes_org`:

```sql
CREATE TABLE public.cortex_permissoes_org (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    ferramenta TEXT NOT NULL,
    auto_execute BOOLEAN NOT NULL DEFAULT FALSE,
    permitida BOOLEAN NOT NULL DEFAULT TRUE,
    roles_permitidas app.org_membro_role[],
    UNIQUE (org_id, ferramenta)
);
```

**Tela** `web/app/(app)/configuracoes/cortex/page.tsx`:
- Lista todas as tools de escrita
- Toggle "Habilitada" + "Confirmação automática" + roles permitidas

**Auditoria reforçada:** cada execução vai para `cortex_ferramentas_executadas` E `audit_log` com `acao = 'cortex_executou'`. Rastreável: "quem fez X?" → "Cortex executou em nome do user Y em 12/05 14:30".

**Critério de pronto:** pedir "Cortex, cria tarefa pra mim amanhã: ler IN DCTFWeb". Cortex propõe, confirma, vai em /kanban → tarefa criada com `criada_por_id = user` e flag `cortex_executou = true`.

---

### TASK-063 · Cortex v4 — Memória persistente ✅

**Status:** entregue 2026-05-12.

**Entregue:**
- Migration `041_cortex_memoria.sql`: enum `cortex_memoria_tipo` (fato_user/preferencia/rotina/terminologia/fato_org/cliente_chave/contexto_temporario), tabela `cortex_memorias` com `confianca`, `expira_em`, `revisada_em`, `arquivada`, índices parciais para top-N, trigger updated_at, 3 policies RLS (select user+org, write user, write org só admin). Seed `lembrar_fato` + `esquecer_fato` em `cortex_permissoes_org`.
- Repo `repo/cortex_memorias.go`: `CreateCortexMemoria`, `ListCortexMemorias` (filtro tipo, incluirArquivadas), `UpdateCortexMemoria` (parcial), `ArquivarCortexMemoria`, `EsquecerTudoDoUser`, `BuildContextoMemoria` (top 30 user + top 20 org, formatado p/ system prompt).
- Repo `repo/cortex_acoes.go` estendido: detector regex ancorado `^(lembre|lembra|lembre-se|anote|guarde|guarda)\s+...` + `^(esqueça|esquece)\s+...`. Heurística `inferirTipoMemoria` (palavras-chave → tipo). Dispatch `executarFerramenta` agora cobre `lembrar_fato` e `esquecer_fato`.
- Repo `repo/cortex.go`: nova tool read-only `listar_minhas_memorias` (responde "tenho N memórias sobre você" quando pergunta sobre memória).
- Handler `handler/cortex_memorias.go`: 5 endpoints (`GET /cortex/memorias`, `POST`, `PATCH /:id`, `DELETE /:id`, `POST /memorias/esquecer-tudo`).
- Handler `handler/cortex.go`: chama `BuildContextoMemoria` antes do tool e marca `contexto_memoria_usado=true` na metadata da mensagem assistente. (Quando integrarmos Claude API real em TASK-061, basta inserir esse texto entre `<contexto_memoria>...</contexto_memoria>` no system prompt.)
- Frontend: `web/app/(app)/cortex/memorias/page.tsx` (lista por tipo, agrupada, com cards de privacidade) + `client.tsx` (editar fato + confiança, marcar revisada, arquivar, Esquecer Tudo com confirmação). Drawer Cortex ganha ícone "BrainCircuit" no header com link rápido para `/cortex/memorias`.

**Como testar manualmente:**
1. No drawer: `lembre que eu prefiro ver Contábil primeiro` → card de ação pendente → Confirmar.
2. `lembre que Aquarela é cliente premium NPS 9` → confirma.
3. `que memórias você tem sobre mim?` → tool `listar_minhas_memorias` retorna a contagem.
4. Abrir `/cortex/memorias` → ver memórias agrupadas por tipo, editar/arquivar.
5. `esqueça que prefere Contábil` → confirma → memória arquivada.

**Próximo:** TASK-061 (RAG legislação) — quando entrar, BuildContextoMemoria vai dentro do system prompt do Claude.

---

#### Snapshot original (mantido para referência)

**O que faz:** Cortex aprende sobre o user e a org ao longo do tempo. "Carol é gerente Contábil, prefere ver Contábil filtrado por padrão, usa termo 'fechamento' em vez de 'entrega'". Fatos enriquecem system prompt automaticamente.

**Migrations** (`027_cortex_memoria.sql`):

```sql
CREATE TYPE app.cortex_memoria_tipo AS ENUM (
    'fato_user', 'preferencia', 'rotina', 'terminologia',
    'fato_org', 'cliente_chave', 'contexto_temporario'
);

CREATE TABLE public.cortex_memorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = memória da org
    tipo app.cortex_memoria_tipo NOT NULL,
    fato TEXT NOT NULL,
    confianca NUMERIC(3,2) NOT NULL DEFAULT 0.80,
    origem_conversa_id UUID REFERENCES public.cortex_conversas(id) ON DELETE SET NULL,
    expira_em TIMESTAMPTZ,
    revisada_em TIMESTAMPTZ,
    arquivada BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cortex_mem_user ON public.cortex_memorias(org_id, user_id) WHERE NOT arquivada;
```

**Como Cortex cria memórias:**

System prompt v4 inclui: "Quando o user expressar preferência, rotina ou fato útil para futuras conversas, chame `lembrar_fato`. Ex: 'eu sempre quero ver Contábil primeiro' → `lembrar_fato(tipo='preferencia', fato='User prefere visualizar Contábil como filtro default')`."

**Tools novas:**
```go
// - lembrar_fato(tipo, fato)
// - esquecer_fato(memoria_id)
// - listar_minhas_memorias()
```

**Como Cortex usa memórias:**

A cada nova conversa, antes de enviar pro Claude, o backend:
1. Top 30 memórias do user ordenadas por confiança DESC, não arquivadas, não expiradas
2. Top 20 memórias da org (user_id IS NULL)
3. Injeta no system prompt como `<contexto_memoria>...</contexto_memoria>`

**Tela** `web/app/(app)/cortex/memorias/page.tsx`:
- Lista memórias por categoria
- Editar / arquivar / marcar como revisada
- Botão "Esquecer tudo" (limpa todas — útil se trocar de função)

**Critério de pronto:** Carol expressa 3 preferências em conversa. Cortex cria 3 memórias. Próxima conversa em outro dia, Cortex demonstra que lembra ("Bom dia Carol, vou já filtrar por Contábil como você prefere"). User edita em /cortex/memorias.

---

### TASK-064 · Cmd+K — Cortex Quick (comando palette) ✅

**Status:** entregue 2026-05-12.

**Entregue:**
- Backend `repo/busca.go` + `handler/busca.go`: `GET /api/v1/busca?q=` cross-entity em 5 tabelas (empresas, entregas, solicitações, colaboradores, kanban_tarefas) com ILIKE, top 5 por tipo, RLS aplicada via `WithTenant`.
- Backend `handler/cortex_comando.go`: `POST /api/v1/cortex/comando` single-shot — detecta intenção, cria ação pendente OU retorna `acao: null`. Não usa SSE.
- Frontend `web/components/cortex/quick.tsx`: palette com 3 seções (ações rápidas locais, busca direta debounce 200ms, sugestão Cortex). Navegação ↑↓, Enter abre, Esc fecha. Ações rápidas: 14 atalhos curados (home, entregas, kanban, mural, IRPF, balancete, frequência, configurações, memórias, permissões Cortex…). Quando query parece comando (>8 chars + começa com verbo OU >4 palavras), aparece "Pedir ao Cortex".
- Launcher refatorado: **Cmd+K** abre o palette, **Shift+Cmd+K** abre o drawer de chat, **botão flutuante** abre o drawer. Esc fecha.
- Sidebar: rodapé agora mostra atalho `⌘K` em vez de versão.

**Como testar:** Cmd+K → digita "aqua" → empresas com "aquarela" aparecem. Cmd+K → "cria tarefa: revisar DCTFWeb" → aparece "Pedir ao Cortex" → Enter → card de ação proposta inline.

---

#### Snapshot original (mantido para referência)

**O que faz:** Cmd+K em qualquer página abre palette tipo Linear/Raycast. Busca textual instantânea + sugestões IA + comandos naturais.

**Frontend** (`web/components/cortex/quick.tsx`):
- Modal central com Cmd+K
- Input grande no topo, placeholder: "Pergunte ou peça algo ao Cortex..."
- Resultados em 3 seções:
  1. **Ações rápidas** (locais): "Nova empresa", "Ir para entregas atrasadas", "Abrir Cortex"
  2. **Busca direta** (debounce 200ms, `GET /api/v1/busca?q=...`): empresas, entregas, obrigações, colaboradores
  3. **Sugestões do Cortex**: se a query for frase ("crie tarefa pra Carol amanhã"), envia para `POST /api/v1/cortex/comando` que retorna ação proposta

**Endpoint** `/api/v1/cortex/comando`:
- Recebe string livre
- Classificação inicial via Haiku curto (~200 tokens): é busca / navegação / ação / pergunta?
- Retorna `{ tipo, payload }`
- Frontend executa: navega, mostra tool_call_proposed, ou abre drawer do Cortex com a pergunta

**Critério de pronto:** Cmd+K abre. Digitar "Aquarela" → mostra empresa como primeiro resultado, Enter navega. Digitar "tarefa pra Carol amanhã revisar SPED" → Cortex propõe criação de tarefa via card.

---

## ⚙️ Parsers Rust expandidos (Cortex robô — pós-MVP, sem urgência)

> Gabriel decidiu em 2026-05-12: **deixar para quando o sistema estiver funcionando em produção**. Os parsers existentes (SPED Contribuições, DCTFWeb, DIRBI, eSocial) cobrem o essencial para os primeiros escritórios começarem a usar. Estas TASKs (025, 026, 027) ativam conforme demanda real — quando algum escritório-cliente precisar processar SPED Fiscal, ECD/ECF, DAS, DARF ou guias estaduais, o Codex pega.
>
> **Pré-requisito quando ativar:** amostras reais dos PDFs (DAS, DAS-MEI, DARF, GA-RS) para calibrar regex antes de implementar — Gabriel salva em `/CECOPEL 2.0/amostras-guias/` quando chegar a hora.

### TASK-025 · SPED Fiscal, ECD e ECF (parser genérico)

**O que faz:** unifica todos os parsers SPED em um só, aproveitando que todos têm o mesmo cabeçalho registro 0000 (`|0000|DT_INI|DT_FIN|NOME|CNPJ|...`).

**Refatoração em `robot/src-tauri/src/parser/`:**

1. Renomear `sped.rs` → `sped_generico.rs` e estrutura para `SpedGenericoParser`. Manter o mesmo código de extração (já está correto).
2. Em `parser/mod.rs`, mapear novos `parser_tipo`:

```rust
pub fn for_tipo(tipo: &str) -> Option<Box<dyn FileParser + Send + Sync>> {
    match tipo {
        "dctfweb" => Some(Box::new(dctfweb::DctfWebParser)),
        "dirbi"   => Some(Box::new(dirbi::DirbiParser)),
        "esocial" | "esocial_xml" => Some(Box::new(esocial::EsocialParser)),
        // SPED — todos compartilham layout 0000
        "sped_efd_contrib" | "sped_efd"
        | "sped_efd_icms"        // SPED Fiscal (EFD-ICMS/IPI)
        | "sped_ecd"             // Escrituração Contábil Digital
        | "sped_ecf"             // Escrituração Contábil Fiscal
            => Some(Box::new(sped_generico::SpedGenericoParser)),
        _ => None,
    }
}
```

3. Acrescentar entries no catálogo de obrigações global (nova migration `030_obrigacoes_sped_completo.sql`):

```sql
INSERT INTO public.obrigacoes_catalogo
    (org_id, codigo, nome, departamento, periodicidade, referencia_dia, dia_legal, dias_antes_lembrete, competencia_offset,
     multa_estimada_cents, tempo_estimado_minutos, robo_processa, regex_arquivo, parser_tipo, descricao, base_legal) VALUES
    (NULL, 'SPED_FISCAL',     'SPED Fiscal (EFD-ICMS/IPI)', 'fiscal',   'mensal', 'dia_util_apos_competencia', 20, 5, 1, 80000, 120, TRUE,
     '^EFD_ICMS_IPI_(\d{14})_(\d{8})_(\d{8})\.txt$', 'sped_efd_icms',
     'Escrituração Fiscal Digital de ICMS e IPI', 'Convênio ICMS 143/2006 + Ajuste SINIEF 02/2009'),

    (NULL, 'SPED_ECD',        'SPED ECD (Contábil)',        'contabil', 'anual',  'dia_fixo', 31, 30, 5, 50000, 180, TRUE,
     '^SPED_ECD_(\d{14})_(\d{4})\.txt$', 'sped_ecd',
     'Escrituração Contábil Digital', 'IN RFB 1.774/2017'),

    (NULL, 'SPED_ECF',        'SPED ECF (Fiscal anual)',    'contabil', 'anual',  'dia_fixo', 31, 30, 7, 50000, 240, TRUE,
     '^SPED_ECF_(\d{14})_(\d{4})\.txt$', 'sped_ecf',
     'Escrituração Contábil Fiscal — sucessora da DIPJ', 'IN RFB 1.422/2013')
ON CONFLICT (org_id, codigo) DO UPDATE SET
    nome = EXCLUDED.nome,
    parser_tipo = EXCLUDED.parser_tipo,
    regex_arquivo = EXCLUDED.regex_arquivo;
```

**Atenção:** SPED Fiscal e ECD/ECF reais usam padrões de nome ligeiramente diferentes por gerador (PVA, Sage, Domínio, etc.). Os regex acima cobrem o padrão da Receita; ajustar conforme amostras do Gabriel.

**Tests adicionais em `sped_generico.rs`:**
```rust
#[test]
fn parse_sped_fiscal_header() {
    // |0000|3.0.0|...|DD_MM_YYYY|...|CNPJ|...
}
#[test]
fn parse_ecd_header() {
    // mesmo padrão, ano de calendário diferente
}
```

**Critério de pronto:** robô identifica e processa um arquivo `EFD_ICMS_IPI_12345678000190_01052026_31052026.txt`, extrai CNPJ + competência → entrega criada via API.

---

### TASK-026 · Parsers de PDF (DAS, DAS-MEI, DARF)

**O que faz:** robô passa a identificar e processar **PDFs de guias federais**. Cobre DAS do Simples, DAS-MEI e DARF.

**Dependência nova em `robot/src-tauri/Cargo.toml`:**

```toml
# Extração de texto de PDFs gerados digitalmente.
# pdf-extract = ~3MB no binário final, suficiente pra PDFs estruturados.
# Para PDFs escaneados (raros em guias atuais), criar TASK-028 com OCR Tesseract.
pdf-extract = "0.7"
```

**Estrutura nova `robot/src-tauri/src/parser/pdf/`:**

```
parser/
├── pdf/
│   ├── mod.rs           # extrator de texto base + helpers comuns
│   ├── das_simples.rs   # DAS do Simples Nacional
│   ├── das_mei.rs       # DAS-MEI
│   └── darf.rs          # DARF federal genérico
```

**`pdf/mod.rs`:**
```rust
use pdf_extract::extract_text;
use std::path::Path;

/// Extrai texto puro de um PDF gerado digitalmente. Retorna None se for PDF
/// escaneado (imagem) — fallback fica para OCR em TASK-028.
pub fn extract_pdf_text(path: &Path) -> Option<String> {
    extract_text(path).ok().filter(|s| s.trim().len() > 50)
}
```

**`pdf/das_simples.rs`** — busca padrões característicos do DAS:
- "CNPJ" seguido de 14 dígitos
- "Período de Apuração" seguido de MM/AAAA
- "Valor Total do Documento" seguido de R$ valor
- "Número do Documento" (código de barras)
- Vencimento

**`pdf/das_mei.rs`** — variação simplificada do DAS para MEI:
- CNPJ (14 dígitos) ou CPF (11 dígitos — MEI sem CNPJ é raro mas existe)
- Período de Apuração
- Valor fixo da categoria

**`pdf/darf.rs`** — DARF federal:
- CNPJ ou CPF
- Período de Apuração (vários formatos: MM/AAAA, semestre, ano)
- Código da Receita (4 dígitos — identifica o tributo: 0561 = IRRF, 6912 = COFINS, etc.)
- Valor

**Adicionar parser_tipos em `parser/mod.rs`:**
```rust
"das_simples" => Some(Box::new(pdf::das_simples::DasSimplesParser)),
"das_mei"     => Some(Box::new(pdf::das_mei::DasMeiParser)),
"darf"        => Some(Box::new(pdf::darf::DarfParser)),
```

**Catálogo (continuação da migration 030):**
```sql
INSERT INTO public.obrigacoes_catalogo (...) VALUES
    (NULL, 'DAS_Simples', 'DAS Simples Nacional', 'fiscal', 'mensal', 'dia_fixo', 20, 3, 1, 0, 10, TRUE,
     '^DAS_?(\d{14})_(\d{6})\.pdf$', 'das_simples',
     'Documento de Arrecadação do Simples Nacional', 'LC 123/2006'),

    (NULL, 'DAS_MEI',     'DAS MEI',              'fiscal', 'mensal', 'dia_fixo', 20, 3, 1, 0, 5, TRUE,
     '^DAS_?MEI_?(\d{14})_(\d{6})\.pdf$', 'das_mei',
     'DAS Microempreendedor Individual', 'LC 128/2008'),

    (NULL, 'DARF',        'DARF Federal',         'fiscal', 'eventual', 'data_evento', NULL, 3, 0, 0, 5, TRUE,
     '^DARF_?(\d{14})_(\d{6})_(\d{4})\.pdf$', 'darf',
     'Documento de Arrecadação de Receitas Federais', 'Lei 9.430/96')
```

**Crítico:** ANTES de implementar, **peça ao Gabriel amostras reais** de DAS, DAS-MEI e DARF (PDFs que o software dele gera hoje). Cada gerador (eCAC, Receitanet, contadores) tem layout sutilmente diferente. Sem amostras, regex vira chute.

**Critério de pronto:** robô recebe `DAS_12345678000190_202605.pdf`, extrai CNPJ + competência (e bonus: valor), cria entrega via API. Mesmo para DAS-MEI e DARF.

---

### TASK-027 · Guias estaduais (começar por SEFAZ-RS)

**O que faz:** parsers de guias de arrecadação estadual (ICMS, taxas). Começar pelo RS (sede da Cecopel), depois SP, MG, PR conforme demanda.

**Estrutura nova `parser/pdf/guias_estaduais/`:**

```
parser/pdf/guias_estaduais/
├── mod.rs
├── rs.rs   # GR-PR do RS — "GA-RS" ou "GNRE"
├── sp.rs   # GARE-SP (futuro)
├── mg.rs   # ... (futuro)
```

**Características regionais a tratar:**

| UF | Guia | Identificadores específicos |
|---|---|---|
| RS | GA-RS / GNRE | "Estado do Rio Grande do Sul" no cabeçalho, inscrição estadual 10 dígitos |
| SP | GARE-SP | "Secretaria da Fazenda - SP", IE 12 dígitos |
| MG | DAE-MG | "Documento de Arrecadação Estadual" |
| PR | GR-PR | "Estado do Paraná" |
| Outros | GNRE genérica | Padrão Convênio ICMS 13/2017 |

**Para começar (TASK-027 v1):** implementar só RS.

**`rs.rs`** — extrai CNPJ, inscrição estadual, período, valor, código de receita estadual. Procura por padrão "Estado do Rio Grande do Sul" ou "RIO GRANDE DO SUL" no texto extraído para confirmar a UF.

**Catálogo:**
```sql
INSERT INTO public.obrigacoes_catalogo (...) VALUES
    (NULL, 'GA_RS',    'Guia de Arrecadação RS',  'fiscal', 'mensal', 'dia_fixo', 15, 3, 1, 0, 8, TRUE,
     '^GA[_-]?RS_?(\d{14})_(\d{6})\.pdf$', 'guia_estadual_rs',
     'Guia de Arrecadação do Estado do Rio Grande do Sul', 'Decreto 37.699/97 (RICMS-RS)'),

    (NULL, 'GNRE',     'GNRE (interestadual)',    'fiscal', 'eventual', 'data_evento', NULL, 2, 0, 0, 5, TRUE,
     '^GNRE_?(\d{14})_(\d{6})\.pdf$', 'guia_estadual_gnre',
     'Guia Nacional de Recolhimento de Tributos Estaduais', 'Convênio ICMS 13/2017')
```

**Adicionar parser_tipos:**
```rust
"guia_estadual_rs"   => Some(Box::new(pdf::guias_estaduais::rs::GuiaRsParser)),
"guia_estadual_gnre" => Some(Box::new(pdf::guias_estaduais::gnre::GnreParser)),
```

**SP/MG/PR/etc:** criar quando aparecer escritório-cliente que precisa. Estrutura modular permite adicionar UF por UF.

**Crítico:** pedir amostra de GA-RS ao Gabriel (mesmo cuidado da TASK-026).

**Critério de pronto:** robô recebe `GA_RS_12345678000190_202605.pdf`, extrai CNPJ + competência → entrega criada.

---

## 🛠️ Backlog técnico (sem urgência)

### TASK-024 · Refinamento dos parsers Rust (revisão de 2026-05-12 pelo Claude)

Os parsers TASK-020 a TASK-022 foram aprovados na revisão, mas têm pontos pra polir quando aparecerem arquivos reais em produção:

**`robot/src-tauri/src/parser/dctfweb.rs`** — só cobre `.txt` pipe-delimited. O `.xml` oficial do eCAC (DCTFWeb pós-2021) precisa parser separado. Criar `dctfweb_xml.rs` quando aparecer amostra real e registrar `parser_tipo = "dctfweb_xml"` no catálogo.

**`robot/src-tauri/src/parser/dirbi.rs`** — substituir os 2 `.unwrap()` da linha 37 por:
```rust
br.captures(content).and_then(|c| Some(format!("{}-{}", c.get(2)?.as_str(), c.get(1)?.as_str())))
```
Adicionar regex alternativo para tags XML em inglês (alguns sistemas exportam assim).

**`robot/src-tauri/src/parser/esocial.rs`** — suporte a empregador PF (MEI):
1. Adicionar `pub cpf: Option<String>` em `ParseHint` (parser/mod.rs)
2. Em `esocial.rs` linha 33, tratar `digits.len() == 11` como CPF
3. Propagar CPF em `IdentifiedFile` (identifier.rs) e na metadata de upload (uploader.rs)
4. Backend `api/internal/handler/uploads.go` no `ConfirmarUpload` buscar empresa por CPF quando CNPJ vier vazio
5. Resetar `current` em `Event::End` para evitar falso positivo

**`quick-xml`** — quando upgrade para 0.37+, `reader.trim_text(true)` precisa virar `Config::default().trim_text(true)`.

Adicionar testes unitários:
- DCTFWeb XML real (quando exemplo disponível)
- DIRBI com tags em inglês
- eSocial com empregador CPF (11 dígitos)

---

### TASK-040 · Chat — melhorias de produção ✅

**Status:** entregue 2026-05-12.

**Entregue:**
- `web/app/(app)/chat/[id]/thread.tsx` re-escrito: reconnect exponencial 1s→2s→4s→8s (cap 30s), refresh do JWT do Supabase a cada reconexão (evita conexão com token expirado), reconexão automática quando a aba volta a ficar visível.
- Banner visual no topo da thread quando `conexao !== 'conectado'` (amarelo = reconectando, rosé = offline).
- Backend `repo/repo.go::MarcarChatLido` + `handler/handler.go::MarcarChatLido` + rota `POST /api/v1/chat/canais/:id/lido` — atualiza `chat_membros.ultima_leitura_at = now()`.
- Front chama o endpoint REST automaticamente: ao (re)conectar o WS e a cada mensagem recebida de outro user (só quando aba visível). Idempotente.

---

#### Snapshot original (mantido para referência)

### TASK-040 · Chat — melhorias de produção (snapshot)

Após a TASK-002, três pontos faltam para o chat estar pronto para uso real. Implementar em `web/app/(app)/chat/[id]/thread.tsx` (e small additions na API).

**1. Reconnect automático do WebSocket**

Hoje, se a conexão cair (sleep do laptop, troca de Wi-Fi/4G, deploy da API), o chat fica mudo sem aviso. Adicionar:
- Listener em `ws.onclose` que tenta reconectar com backoff exponencial: 1s, 2s, 4s, 8s, max 30s
- Indicador visual ("Reconectando...") no header do chat enquanto está fora
- Ao reconectar, re-subscribe ao `room` e fazer um GET das mensagens criadas depois da última conhecida (`?since=<id ou criada_em>`) para preencher o gap — endpoint novo `GET /api/v1/chat/canais/:id/mensagens?since=...` precisa ser criado no Go

**2. Tratamento de JWT expirado**

JWT do Supabase expira em ~1h. Quando expirar:
- `apiBrowser.createChatMensagem` recebe 401 → o frontend chama `supabase.auth.refreshSession()` automaticamente e refaz a tentativa uma vez
- WebSocket que era válido no handshake continua aceito pelo Go até cair (o backend só valida no handshake) — mas quando cair e reconectar, é com o token novo
- Centralizar lógica num wrapper `fetchWithAutoRefresh()` em `web/lib/api.ts` que envolva todas as chamadas POST/PATCH/DELETE

**3. Marcar mensagens como lidas**

Quando o user abre `/chat/[id]`, atualizar `chat_membros.ultima_leitura_at = now()` para zerar o badge de não-lido na sidebar do chat.

Implementação:
- Endpoint novo: `POST /api/v1/chat/canais/:id/marcar-lido` (sem body, body vazio) — backend faz `UPDATE chat_membros SET ultima_leitura_at = now() WHERE canal_id = $1 AND user_id = $2`
- Client Component `ChatThread` chama esse endpoint no mount + a cada nova mensagem que chega via WS (debounce de 1s)
- Pedir ao Claude para adicionar handler `MarcarLido` e método `MarcarChatLido` no repo

**Critério de pronto:** 
- Desliga e religa o Wi-Fi → chat reconecta sozinho em < 30s, mensagens perdidas aparecem
- Deixa o chat aberto por 1h → mensagem nova funciona sem precisar reload
- Abre /chat/[id] → badge do canal desaparece da sidebar de /chat

---

### ✅ TASK-030 · Upload assinado para Supabase Storage ⚙️ aprovado pelo Claude (2026-05-12)
Entregue em 2026-05-12. Fluxo preparar → PUT direto no Storage → confirmar implementado na API, robô Tauri e logo da org, com migrations 028/029, worker de limpeza e documentação.

**Arquitetura aprovada** — implementar em 3 passos sem decisões pendentes. Detalhes completos abaixo.

#### Fluxo

```
[1] Cliente/robô → POST /api/v1/uploads/preparar  → recebe {upload_id, upload_url, storage_path, expires_at}
[2] Cliente/robô → PUT bytes direto na upload_url do Supabase Storage (API Go NÃO toca os bytes)
[3] Cliente/robô → POST /api/v1/uploads/:upload_id/confirmar → cria registros finais (entrega, arquivo)
```

#### Migration nova `028_uploads_pendentes.sql`

```sql
CREATE TYPE app.upload_contexto AS ENUM (
    'robo_entrega',       -- robô Tauri publicando arquivo
    'manual_entrega',     -- upload manual via portal numa entrega
    'solicitacao',        -- anexo em ticket
    'mural',              -- mídia em post do mural
    'chat',               -- arquivo em mensagem do chat
    'avatar',             -- foto de perfil
    'logo_org',           -- logo white-label da org
    'cliente_arquivo'     -- cliente final enviando doc pelo PWA
);

CREATE TABLE public.uploads_pendentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    bucket TEXT NOT NULL,                             -- 'entregas','solicitacoes','mural','chat','avatars','logos-orgs'
    storage_path TEXT NOT NULL,                       -- '<org_id>/<contexto>/<yyyy-mm>/<uuid>-<nome>'
    nome_original TEXT NOT NULL,
    mime_type TEXT,
    tamanho_esperado BIGINT NOT NULL,
    hash_sha256_esperado TEXT,
    contexto app.upload_contexto NOT NULL,
    contexto_id UUID,                                 -- entrega_id, solicitacao_id, etc. (pode ser NULL quando robô vai criar)
    contexto_payload JSONB NOT NULL DEFAULT '{}'::jsonb, -- ex: {cnpj, competencia, obrigacao_id} pro robô
    expira_em TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '15 minutes',
    confirmado_em TIMESTAMPTZ,
    cancelado_em TIMESTAMPTZ,
    erro TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_uploads_pend_open ON public.uploads_pendentes(expira_em)
  WHERE confirmado_em IS NULL AND cancelado_em IS NULL;
CREATE INDEX idx_uploads_org_data ON public.uploads_pendentes(org_id, created_at DESC);

-- RLS
ALTER TABLE public.uploads_pendentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY uploads_pend_select ON public.uploads_pendentes FOR SELECT
  USING (app.is_super_admin() OR app.user_pertence_a_org(org_id));
CREATE POLICY uploads_pend_insert ON public.uploads_pendentes FOR INSERT
  WITH CHECK (app.user_pertence_a_org(org_id));
-- UPDATE só pela própria API Go com service role (não há policy pública)
```

#### Migration de Storage policies `029_storage_policies.sql`

```sql
-- Aplicar para cada bucket privado: 'entregas', 'solicitacoes', 'mural', 'chat'
-- Padrão: usuário só pode operar em arquivos com primeiro segmento do path = org dele

-- INSERT
CREATE POLICY entregas_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'entregas'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT org_id FROM public.org_membros WHERE user_id = auth.uid() AND status = 'ativo'
    )
  );

-- SELECT (necessário para URLs assinadas de download funcionarem)
CREATE POLICY entregas_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'entregas'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT org_id FROM public.org_membros WHERE user_id = auth.uid() AND status = 'ativo'
    )
  );

-- Repetir os 2 padrões para 'solicitacoes', 'mural', 'chat'.
-- Para buckets públicos (avatars, logos-orgs): liberar SELECT para anon, manter INSERT só authenticated.
```

#### Endpoints na API Go (`api/internal/handler/uploads.go`)

**1. `POST /api/v1/uploads/preparar`**

```go
type PrepararUploadRequest struct {
    Contexto         string  `json:"contexto"` // 'robo_entrega' | 'manual_entrega' | etc.
    ContextoID       *string `json:"contexto_id"`
    ContextoPayload  map[string]any `json:"contexto_payload"`
    NomeOriginal     string  `json:"nome_original"`
    MimeType         string  `json:"mime_type"`
    TamanhoBytes     int64   `json:"tamanho_bytes"`
    HashSHA256       string  `json:"hash_sha256"`
}

type PrepararUploadResponse struct {
    UploadID     string    `json:"upload_id"`
    UploadURL    string    `json:"upload_url"`
    StoragePath  string    `json:"storage_path"`
    Bucket       string    `json:"bucket"`
    ExpiresAt    time.Time `json:"expires_at"`
    MaxBytes     int64     `json:"max_bytes"`
}
```

Validações:
- User pertence à org (RLS automático)
- Mime type permitido para o contexto (lista hardcoded em `services/uploads_policies.go`)
- Tamanho não excede limite do plano (`planos.limite_storage_gb`)
- Espaço total da org ainda comporta (somatório de `entrega_arquivos.tamanho_bytes` + outros)
- Para `robo_entrega`: contexto_payload tem `cnpj_extraido`, `competencia`, `obrigacao_id`

Geração da URL assinada:
- Bucket conforme contexto (ver mapa abaixo)
- Path: `<org_id>/<contexto>/<yyyy-mm>/<uuid_v4>-<sanitize(nome)>`
- Chamar API Supabase Storage: `POST /storage/v1/object/upload/sign/<bucket>/<path>?expiresIn=300` (com service_role key)
- INSERT em `uploads_pendentes` com expira_em = now() + 15min
- Retorna URL assinada

**Mapa contexto → bucket:**
| Contexto | Bucket |
|---|---|
| robo_entrega, manual_entrega | `entregas` |
| solicitacao | `solicitacoes` |
| mural | `mural` |
| chat | `chat` |
| avatar | `avatars` (público) |
| logo_org | `logos-orgs` (público) |
| cliente_arquivo | `entregas` |

**2. `POST /api/v1/uploads/:upload_id/confirmar`**

```go
type ConfirmarUploadRequest struct {
    HashSHA256      string `json:"hash_sha256"`
    ContextoPayload map[string]any `json:"contexto_payload"` // overrides do payload inicial
}

type ConfirmarUploadResponse struct {
    EntregaID    *string `json:"entrega_id,omitempty"`
    ArquivoID    *string `json:"arquivo_id,omitempty"`
    SolicitacaoAnexoID *string `json:"solicitacao_anexo_id,omitempty"`
    Status       string  `json:"status"` // 'sucesso', 'duplicado'
}
```

Lógica:
1. Busca `uploads_pendentes` por id; valida org_id do user; valida não expirado nem cancelado
2. HEAD no Supabase Storage: `HEAD /storage/v1/object/<bucket>/<path>` — se 404, erro 422 ("arquivo não chegou ao Storage")
3. Compara tamanho retornado com `tamanho_esperado` — se diverge >10%, erro
4. Switch por contexto:
   - **`robo_entrega`**: replica lógica de `RoboUpload` atual — busca empresa por CNPJ, obrigacao_empresa, cria/atualiza entrega, cria entrega_arquivos com storage_path, cria entrega_eventos
   - **`manual_entrega`**: usa `contexto_id` (entrega já existente), cria entrega_arquivos
   - **`solicitacao`**: usa `contexto_id` (solicitacao_id), cria solicitacao_anexos
   - **`mural`/`chat`**: cria mural_anexos / chat_anexos (precisa adicionar tabelas se ainda não tem)
   - **`avatar`**: atualiza `profiles.avatar_url` com URL pública do bucket
   - **`logo_org`**: atualiza `orgs.logo_url`
5. Marca `uploads_pendentes.confirmado_em = now()`
6. Retorna IDs criados

**3. `POST /api/v1/uploads/:upload_id/cancelar`** (idempotente)

Marca cancelado_em + dispara delete no Storage assíncrono.

**4. `GET /api/v1/arquivos/:arquivo_id/download-url`** (novo)

```go
type DownloadURLResponse struct {
    URL       string    `json:"url"`
    ExpiresAt time.Time `json:"expires_at"` // now() + 1h
}
```

- Busca `entrega_arquivos` por ID (RLS aplica — só vê se pertence à org)
- Gera URL assinada de download: `POST /storage/v1/object/sign/<bucket>/<path>?expiresIn=3600`
- Retorna

#### Worker cron novo `api/internal/jobs/uploads_limpeza.go`

A cada 1 hora:
```sql
SELECT id, bucket, storage_path FROM uploads_pendentes
WHERE confirmado_em IS NULL
  AND cancelado_em IS NULL
  AND expira_em < now() - INTERVAL '1 hour';
```

Para cada:
1. Tenta DELETE no Storage (ok se 404, já não existe)
2. UPDATE `uploads_pendentes SET cancelado_em = now(), erro = 'orfão expirado'`

#### Mudanças no robô Tauri (`robot/src-tauri/src/uploader.rs`)

Substituir função `upload` por sequência:
```rust
pub async fn upload(&self, creds: &StoredCredentials, path: &Path, identified: &IdentifiedFile, hostname: &str) -> RoboResult<UploadResponse> {
    // 1) preparar
    let prep = self.preparar_upload(creds, path, identified, hostname).await?;
    // 2) PUT direto
    self.put_bytes(&prep.upload_url, path).await?;
    // 3) confirmar
    self.confirmar_upload(creds, &prep.upload_id, identified).await
}
```

Hash SHA-256 calculado uma vez, enviado nos passos 1 e 3.

Retry: se PUT falhar com 401 ou 403, voltar ao passo 1 (URL pode ter expirado).

#### Limites por plano (em `services/uploads_policies.go`)

```go
type LimitesUpload struct {
    MaxBytesPorArquivo int64
    MaxBytesTotalOrg   int64
}

func LimitesParaPlano(codigo string) LimitesUpload {
    switch codigo {
    case "free":       return LimitesUpload{100*MB, 1*GB}
    case "pro":        return LimitesUpload{1*GB,  25*GB}
    case "enterprise": return LimitesUpload{5*GB,  250*GB}
    default:           return LimitesUpload{100*MB, 1*GB}
    }
}
```

Validação no `/preparar`: rejeitar se `tamanho_bytes > MaxBytesPorArquivo` ou se org já está acima de `MaxBytesTotalOrg`.

#### Mime types permitidos por contexto

```go
var MimesPermitidos = map[string][]string{
    "robo_entrega":    {"application/octet-stream", "text/plain", "application/xml", "application/pdf"},
    "manual_entrega":  {"application/octet-stream", "text/plain", "application/xml", "application/pdf", "image/jpeg", "image/png"},
    "solicitacao":     {"image/jpeg", "image/png", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
    "mural":           {"image/jpeg", "image/png", "image/webp", "application/pdf"},
    "chat":            {"image/jpeg", "image/png", "image/webp", "application/pdf", "application/octet-stream"},
    "avatar":          {"image/jpeg", "image/png", "image/webp"},
    "logo_org":        {"image/jpeg", "image/png", "image/webp", "image/svg+xml"},
    "cliente_arquivo": {"application/pdf", "image/jpeg", "image/png", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
}

// Bloqueio global, mesmo se aparecer:
var MimesBloqueados = []string{
    "application/x-msdownload", "application/x-msdos-program", "application/x-executable",
    "application/x-mach-binary", "application/vnd.debian.binary-package",
}
```

#### Migração dos arquivos existentes

Como nada está em produção ainda, **não há migração de dados** — basta aplicar as migrations 028/029 e atualizar o handler antigo `RoboUpload` para retornar 410 Gone com mensagem "endpoint descontinuado, use /uploads/preparar + /uploads/:id/confirmar". Robô antigo já não existe (binário ainda não distribuído).

Se eventualmente houver arquivos `entrega_arquivos` com `storage_path` pointing a path que nunca foi uploadado fisicamente, deletar essas linhas órfãs em uma migration de cleanup.

#### Critério de pronto

1. Aplicar migrations 028 + 029
2. Implementar handlers + worker de limpeza na API Go
3. Atualizar robô Tauri para o novo fluxo
4. Atualizar frontend (web/admin) para upload em mural/chat/solicitações via novo fluxo
5. Atualizar `/configuracoes` (TASK-007) para upload do logo da org via novo fluxo
6. Testar manualmente: criar entrega via robô → arquivo aparece no Storage com path correto → cliente baixa via URL assinada
7. Testar limpeza: criar upload sem confirmar → 1h depois cron deleta + marca cancelado
8. Documentar em `api/README.md` o novo fluxo

**Codex: pode atacar essa TASK direto agora — não precisa esperar mais nada.**

### TASK-031 · Tests unitários ✅ (parcial — base estabelecida)

**Status:** base entregue 2026-05-12.

**Entregue:**
- `api/internal/repo/cortex_acoes_test.go` cobrindo o detector de intenção (`DetectarAcao`) com 15 casos: criar tarefa, postar mural, lançar pontos, lembrar/esquecer fato + casos negativos ("que memórias…", "do que você lembra…") que NÃO devem virar comando. Inclui `TestInferirTipoMemoria`.
- Rodar com `cd api && go test -race ./...`

**A continuar (post-MVP):**
- Tests para `internal/repo/repo.go` com testcontainers Postgres + RLS real.
- Tests para `robot/src-tauri/identifier.rs` e `parser/`.

### TASK-032 · CI/CD ✅

**Status:** entregue 2026-05-12.

**Entregue:** `.github/workflows/ci.yml` com 4 jobs:
- **api-go** → `go mod verify` + `go vet ./...` + `go build ./...` + `go test -race -count=1 ./...`
- **web-next** → `npm ci` + `tsc --noEmit` + `npm run build`
- **admin-next** → `npm ci` + `tsc --noEmit` + `npm run build`
- **robot-rust** → `cargo check --all-targets` (com libs de sistema Tauri)

Roda em push pra `main` e em todo PR. Deploy automático Vercel preview pode ser plugado depois.

---

## 📝 Quando concluir uma tarefa

Marque com ✅ e adicione 1 linha:

```
### ✅ TASK-001 · /web/app/(app)/empresas/[id]/page.tsx
Entregue em 2026-05-XX. Página carrega com 4 stats + 4 cards. Faltou dashboard de NPS — depende de TASK-004.
```

Se descobriu algo que mudou a especificação, atualize a tarefa em vez de só descrever.
