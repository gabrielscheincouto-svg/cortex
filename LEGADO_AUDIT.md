# Auditoria do cecopel-gestao (legado) — referência operacional

Captura tela-por-tela do sistema em produção https://cecopel.netlify.app/cecopel/ e
gap analysis contra o Cortex multi-tenant. Saída desta auditoria orienta a
**paridade operacional** antes de novas features.

## Princípio

Antes de adicionar IA, robô, portal, brandbook — o Cortex precisa ENTREGAR
o que o legado já entrega. Densidade de informação primeiro. Estética depois.

---

## 1. Home (`/`)

### Legado
- **KPIs no topo (4)**: Pendentes (7) · Atrasadas (1, em vermelho) · Em andamento (0) · Msgs não lidas (0)
- **Calendário do mês** ocupando metade esquerda, com bolinhas coloridas em datas (vermelho atrasado, amarelo prazo hoje, verde no prazo, azul info, roxo info). Dia atual destacado em violeta cheio.
- **Minhas Tarefas** ocupando metade direita, lista priorizada com cliente em destaque, depto colorido (Contábil, Gestão, Fiscal, Pessoal), prazo legível, status badge (Solicitado/Em andamento).
- **Chat e Mural de Avisos** lado-a-lado abaixo do fold.
- **Modal de Notificações** no boot avisando tarefas vencidas com botão "Entendi".

### Cortex hoje
- Hero com orb 3D + saudação + KPIs zerados.
- Card de gamificação com sequência/pontos do mês.
- Mural e Chat preview.
- **SEM calendário do mês**.
- **SEM lista de Minhas Tarefas priorizadas**.
- **SEM notificação proativa de vencidas no boot**.

### Gap → TASK-45

---

## 2. Kanban — Solicitações Internas (`/kanban`)

### Legado
- Header com subtítulo "Gestão de tarefas entre gerentes e diretores".
- Botões: **Buscar tarefa**, **Nova Tarefa**, **Recorrentes**, **Relatório**, **Painel**.
- 2 tabs: **Tarefas (15)** / **Recorrências (33)**.
- Filtros por depto: Todos · Contábil · Fiscal · Pessoal · Societário · Manutenção · Gestão.
- Filtros por pessoa (pill list): Gabriel, Diego, Matheus, Carol, Natácia, Andréa, Vitória, Luíza, Angelita, Julia.
- 3 colunas: **A FAZER (10)** · **EM ANDAMENTO (5)** · **CONCLUÍDO (23)**.
- Cards de tarefa: cliente em destaque (bold maiúsculo), badge de prioridade (ALTA/MEDIA/URGENTE em laranja/amarelo/vermelho), título, descrição (truncada 2 linhas), prazo formatado "Prazo: data inicial → data prazo · há Xd", responsável com avatar circular colorido, badge "Xd atrás" se atrasada.

### Cortex hoje
- Tela Kanban existe mas mais simples.
- Sem aba "Recorrências".
- Sem filtro por depto + pessoa simultâneo.
- Cards com menos densidade.

### Gap → TASK-47 (parte Kanban)

---

## 3. Controle de Contabilidade (`/balancete` equivalente)

### Legado
- Título **"Controle de Contabilidade 2026"** + legenda das siglas no header (C = Conciliado · C/D = Conciliado aguardando doc · L = Lançado (não conciliado) · D = Doc recebido · S = Suspensa · N = Não receberá doc).
- Filtros: dropdown de **Responsáveis** + busca de empresa + dropdown de mês + filtros chip por situação (Todos / Conciliado / Conc. Ag. Doc / Doc Recebido / Lançado).
- **Matriz**: linhas = empresas (com tributação como sub-texto "+ tributação"), colunas = JAN..DEZ.
- Cada célula é a situação do mês (C/C-D/L/D/S/N) com fundo colorido por status.
- Cadeado nas colunas dos meses já fechados.
- Empresas com flag **"sem co-resp."** em alerta amarelo + badge TERC.
- Coluna "Responsável" com avatar + nome + botão de edit inline.

### Cortex hoje
- **Não existe**. Tem `/balancete` (lista de balancetes, sem matriz mensal) e `/entregas` (lista plana).

### Gap → TASK-46 (CRÍTICO)

Essa é a tela mais importante do dia-a-dia contábil. **Sem ela, o sistema não substitui o legado pra rotina operacional**.

---

## 4. Premiações (`/premiacoes` HUB)

### Legado
- Tela hub com 7 cards (módulos):
  - **Premiação** (cálculo automático por nível)
  - **Fiscal** (controle de entregas fiscais)
  - **Pessoal** (controle do depto pessoal)
  - **Contábil** (controle de entregas contábeis)
  - **Frequência** (registro mensal)
  - **Relatórios** (análises de desempenho)
  - **Dashboard** (visão consolidada)

### 4.1 Premiação (dentro do hub)
- Header com seletor de mês (Março 2026), botões: Gerar Termo de Aceite · Metodologia · Zerar Premiação.
- Tabela: Funcionário · Setor (link clicável) · Cargo · Salário · Score% · **Nível (BRONZE/PRATA/OURO badge colorida)** · %Bônus · Valor R$ calculado.
- Bordas inferiores nos rows muito claras pra leitura rápida.

### Cortex hoje
- Existe `conquistas_catalogo`, `pontos_eventos`, `ranking_periodos` no banco.
- Frontend só mostra contagem de pontos e ranking.
- **Não calcula** automatic Score → Nível → Bônus monetário.
- **Não tem** o conceito de gerar Termo de Aceite.

### Gap → TASK-47 (parte Premiações + sub-tabs Fiscal/Pessoal/Contábil)

---

## 5. IRPF (`/irpf`)

### Legado
- Header com busca de cliente + botão "Novo Cliente".
- **6 KPIs** com barras de progresso: Total Clientes · Aguardando · Digitadas · Transmitidas · Processadas · Documentos Recebidos (X/Y).
- Tabela: # · Tipo (PRINCIPAL/DEMAIS badge colorida) · Nome · CPF · Cidade.
- Filtros inline em cada coluna (Tipo... · Nome... · CPF... · Cidade...).

### Cortex hoje
- Dashboard IRPF existe com KPIs (Total, A restituir, A pagar, Imposto retido) → **métricas diferentes, menos operacionais**.
- Lista de declarantes existe mas sem o conceito de **progresso por status** (aguardando → digitada → transmitida → processada).

### Gap → TASK-47 (parte IRPF)

---

## 6. Departamento Societário (`/societario`)

### Legado
- "Gestão de serviços societários — fluxo integrado com Financeiro".
- 3 tabs: Fluxo de Trabalho · Checklists Padrão · Premiação.
- 4 KPIs: Total · Em Andamento · Pend. Financeiro · Concluídas.
- Kanban com colunas por **etapa do fluxo**: Solicitação (responsável) · Pendente Financeiro · Em Andamento · ...
- Cards com cliente, prioridade (alta/media badge), serviço (Alteração Contratual, etc), **barra de progresso 0-100%**, prazo legal, data criação, tag "Cliente novo" quando aplicável, valor R$ se Pendente Financeiro.

### Cortex hoje
- **Não existe**.

### Gap → TASK-47 (parte Societário — módulo zero, construir do zero)

---

## 7. Sidebar (estrutura)

### Legado
Ícones grandes verticais com labels:
- Início
- Kanban
- Ctrl Contábil
- Premiações
- IRPF
- Societário
- (separador)
- Tempo real (indicador verde, **status do sync**)
- TV (modo TV)
- Sync/cloud
- Encerrar Ano
- Sair

### Cortex hoje
Sidebar com mais itens diluídos: Home / Kanban / Entregas / Empresas / Solicitações / Mural / Chat / Dashboards / Balancete / Conquistas / Frequência / Obrigações / Configurações. **13 itens**.

### Gap
Consolidar em **menos seções com submódulos**, como o legado fez. Sidebar atual está dispersa demais.

---

## Resumo da dívida

| Tela | Status legado | Status Cortex | Prioridade |
|---|---|---|---|
| Home denso (calendário + tarefas + KPIs reais) | Pronta | Faltando | **P0** |
| Matriz mensal Ctrl Contábil | Pronta | Não existe | **P0** |
| Kanban (recorrências + filtros depto+pessoa) | Pronta | Parcial | P1 |
| Premiação (cálculo Salário × Score × Nível × Bônus) | Pronta | Não existe | P1 |
| IRPF (KPIs progressivos + filtros inline) | Pronta | Parcial | P1 |
| Societário (kanban por etapa do fluxo) | Pronta | Não existe | P2 |
| Notificações proativas no boot | Pronta | Não existe | P2 |
| Tempo real (indicador de sync verde) | Pronto | Não existe | P3 |

## Princípios pra refatoração

1. **Densidade > vazio bonito.** A tela é uma ferramenta de trabalho, não uma demo.
2. **Copiar shape, melhorar tech.** Mantém o que está bom no legado, adiciona o que multi-tenant + IA permitem (busca semântica, action proposals, portal cliente).
3. **KPIs no topo, sempre 4 ou 6.** Pendentes / Atrasadas / Em andamento / Msgs não lidas é a base.
4. **Cores funcionais, não decorativas.** Vermelho = atrasado. Verde = no prazo. Amarelo = prazo hoje. Azul/roxo = informativo.
5. **Inline edits.** Trocar responsável, marcar status, mudar prioridade — tudo sem abrir modal.
