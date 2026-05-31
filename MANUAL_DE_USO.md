# Manual de Uso · Cortex 2.0

> SaaS contábil multi-tenant. Esteira operacional integrada: escritório opera, robô publica, cliente acompanha pelo PWA.

---

## 1. Sumário executivo

O Cortex é o cérebro digital de um escritório contábil. Ele cuida de três frentes em uma plataforma só:

1. **Operação interna** (escritório): kanban de tarefas, controle contábil, balancete com auditoria, gestão de pessoas, premiação.
2. **Esteira automatizada**: o robô (app desktop) lê uma pasta `ROBO/`, identifica o CNPJ no arquivo, sobe pro sistema, publica para o cliente e liquida a tarefa do colaborador — tudo sem clique humano.
3. **Portal do cliente** (PWA): a empresa atendida vê suas obrigações, baixa guias e balancetes, abre chamados tipados por setor (admissão, demissão, certidão, etc).

Tudo conversa pelo mesmo banco Supabase com **RLS dupla** (escritório vê tudo da sua org; cliente vê só da própria empresa).

---

## 2. URLs e credenciais de teste

### Produção (atual)

| Aplicação | URL | Para quem |
|---|---|---|
| **Escritório (web)** | https://usecortex-app.netlify.app | Funcionários do escritório |
| **Admin Cecopel** | https://usecortex-admin.netlify.app | Super-admin (revenda) |
| **PWA Cliente** | https://usecortex-cliente.netlify.app *(deploy em andamento)* | Empresas atendidas |
| **API Go** | https://cortex-production-f46c.up.railway.app | Backend (consumido pelos apps) |
| **Supabase Studio** | https://supabase.com/dashboard/project/ocbohmnmqtnrcwgvenus | Você (DBA) |
| **GitHub** | https://github.com/gabrielscheincouto-svg/cortex | Código-fonte |

### Próximos domínios (Etapa 2 — subdomínios unificados)

- `usecortex.com.br` → landing pública (a fazer)
- `app.usecortex.com.br` → escritório
- `cliente.usecortex.com.br` → PWA
- `admin.usecortex.com.br` → super-admin

### Credenciais de teste no banco

**Escritório — admin (você):**
- Email: `gabrielscheincouto@gmail.com`
- Senha: a que você já usa
- Papel: admin da org "Cortex Demo"

**Escritório — gerente (novo, criado para testes):**
- Email: `gerente.demo@usecortex.com.br`
- Senha: `CortexGerente2026`
- Papel: gerente operacional, cargo "Gerente Operacional", salário base R$ 8.500
- Use para testar permissões intermediárias (não pode mexer em planos, mas vê tudo de operação)

**Cliente — Padaria Bom Pão (cliente modelo robusto):**
- Email: `dono.bompao@usecortex.com.br`
- Senha: `BomPao2026`
- Empresa: Padaria Bom Pão Ltda — CNPJ 22.555.888/0001-70
- Tem: 12 entregas (4 atrasadas, 4 vencendo, 4 entregues), 3 balancetes (fev/mar/abr) com 18 contas cada, 5 notificações, 3 chamados em estados diferentes
- **O balancete de abril/2026 tem 2 problemas plantados** para a auditoria detectar: receita zerada e despesa de energia 3× acima da média.

**Cliente — Cliente Modelo (simpler):**
- Email: `cliente.teste@cortex.dev`
- Senha: `Cortex@Teste2026`
- Empresa: Cliente Modelo Comércio Ltda — CNPJ 11.444.777/0001-61
- Dados mais leves (4 entregas, 3 notificações, 1 chamado)

---

## 3. Os três papéis

### 3.1 Escritório (`web/`)

Quem é membro de `org_membros`. Tem 8 níveis de role:

| Role | Pode |
|---|---|
| `admin` | Tudo — gerir membros, planos, configurações, módulos |
| `gerente` | Operação completa + premiação + ver todos os setores |
| `contabil` | Balancete, ctrl contábil, lançamentos, auditoria |
| `fiscal` | Obrigações fiscais, guias, SPED, DCTF |
| `pessoal` | Folha, eSocial, admissões, demissões |
| `societario` | Alterações contratuais, certidões, baixas |
| `comercial` | Cadastro de empresas, contratos, honorários |
| `visualizador` | Só leitura |

### 3.2 Cliente final (`client-app/`)

Quem é vinculado em `empresa_usuarios_finais`. Roles internas da empresa-cliente:

| Role | Pode |
|---|---|
| `titular` | Tudo da empresa dele |
| `financeiro` | Ver financeiro, baixar guias, abrir chamados de fiscal |
| `contador` | Ver balancetes e relatórios contábeis |
| `visualizador` | Só ler |

### 3.3 Super-admin (`admin/`)

Quem tem `profiles.is_super_admin = true`. Gere a plataforma inteira (todos os escritórios). Atualmente só a Cecopel (revenda).

---

## 4. Fluxos principais

### 4.1 Cadastrar uma nova empresa (escritório)

1. Loga no escritório: `https://usecortex-app.netlify.app`
2. Menu lateral → **Empresas** → **Nova empresa**
3. Preenche razão social, CNPJ, regime tributário, honorário, endereço
4. Após salvar, vai pra `/empresas/[id]/clientes` e convida o usuário-cliente
5. Vincula as obrigações que o escritório vai cuidar (DCTFWeb, eSocial, Balancete, etc) via `/empresas/[id]/obrigacoes`

### 4.2 Convidar funcionário do escritório

1. Menu → **Configurações** → **Time** (ou `/configuracoes/membros`)
2. **Convidar membro** → preenche email + role + cargo + salário base
3. Sistema envia magic link Supabase
4. Funcionário entra, faz primeiro login, vira ativo em `org_membros`
5. Permissões pelo role + por departamento

### 4.3 Convidar cliente final

1. Vai em `/empresas/[id]/clientes` da empresa-cliente
2. **Adicionar acesso** → email + nome + role (`titular` é o padrão)
3. Sistema envia link
4. Cliente recebe, faz cadastro de senha
5. Quando logar no PWA `usecortex-cliente.netlify.app`, vê só dados da própria empresa

### 4.4 Esteira robô → cliente (o coração)

```
   Pasta ROBO/                Robô (Tauri)              API Go               Supabase                Cliente
   ───────────                ─────────────              ────────             ──────────              ───────
arquivo entra      ────►     identifica CNPJ   ────►   upload arquivo  ───►  storage + cria         vê notificação
DAS_22555888.pdf            por nome/regex            confirmRoboEntrega    cliente_notificacoes    "Nova guia"
                            casa empresa+obrig                              atualiza entrega
                                                                            (entregue)
```

**Como rodar o robô (local):**
1. Compila o `robot/` (Tauri app — `cargo tauri build`)
2. Roda. Configura pasta ROBO/ no setup
3. Joga arquivos lá. Sai pra outra coisa.
4. O nome do arquivo precisa ter o CNPJ (com ou sem pontuação) — ex: `DAS_22555888000170_052026.pdf`
5. Robô reconhece, sobe, publica. Cliente recebe push.

**Onde acompanhar:**
- Escritório → menu **Atividade Robô** (`/robo/atividade`) — timeline de tudo que ele fez
- Cliente → notificação no sino "Nova guia: DAS Simples Nacional 05/2026"

### 4.5 Auditoria do balancete (a peça nova)

O contador só consegue **liquidar o mês** (fechar a célula em `controle_contabil_celulas`) depois que a auditoria roda sem findings em aberto.

**Como usar:**
1. Importa o balancete (planilha) por `/balancete/[empresaId]` → mês X
2. Clica em **Auditoria do balancete** no card do mês
3. Sistema roda 5 regras automaticamente:
   - `saldo_invertido` — Ativo (1.x) com saldo credor, ou Passivo (2.x) com saldo devedor
   - `variacao_extrema` — Conta mudou >150% mês a mês
   - `outlier_estatistico` — Valor a >2.5σ da média histórica
   - `receita_zerada` — Conta 3.1.x zerada mas teve faturamento antes
   - `despesa_atipica` — Conta 3.3.x ou 3.5.x 3× acima da média
4. Para cada finding o contador tem 3 ações:
   - **Justificar** — escreve por que aquele "erro" está correto (mínimo 8 caracteres)
   - **Corrigir** — marca como corrigido (geralmente reimporta o balancete)
   - **Arquivar** — sinaliza tratamento externo
5. Quando todos os findings estão tratados, o botão **Liquidar mês** libera

**Para testar agora:** logue como `gabrielscheincouto@gmail.com`, vai em `/balancete/[id da Padaria Bom Pão]/auditoria/2026-04`. Os 18 contas têm 2 problemas plantados que devem aparecer.

### 4.6 Cliente abre um chamado

1. Cliente entra no PWA `usecortex-cliente.netlify.app`
2. Aba **Solicitações** → **Nova solicitação**
3. Wizard de 3 etapas:
   1. **Setor** — Pessoal, Societário, Contábil, Fiscal ou Outro
   2. **Tipo** — escolhe entre os 12 templates (Admissão, Demissão, Certidão, Balancete, Faturamento 12m, etc)
   3. **Formulário** — campos dinâmicos por tipo (cada tipo tem seu schema em `solicitacao_tipos.campos_form`)
4. Submete → vira `solicitacoes` com `status='nova'`, `origem='app_cliente'`
5. Escritório recebe em `/solicitacoes`, atribui responsável, conversa via chat estilo Slack
6. Cliente responde no PWA pela tela de detalhe

### 4.7 Premiação

- Cada entrega entregue no prazo gera pontos automaticamente (via trigger)
- Cada org configura o peso em `premiacoes_regras_org`:
  - **Bronze**: 60% das metas → 25% bônus sobre salário base
  - **Prata**: 80% → 50% bônus
  - **Ouro**: 95% → 75% bônus
- Tela `/premiacoes` mostra ranking + cálculo R$ pra cada funcionário
- Admin/gerente edita pesos em `/premiacoes/regras`

---

## 5. Tela por tela (escritório)

| Rota | O que tem |
|---|---|
| `/` | Home — 4 KPIs (Pendentes / Atrasadas / Em andamento / Msgs), calendário do mês, minhas tarefas |
| `/kanban` | Kanban operacional — colunas por status, filtros, comentários |
| `/empresas` | Lista de empresas-cliente — busca, filtros, status |
| `/empresas/[id]` | Detalhe da empresa — dados, responsáveis, obrigações, balancetes |
| `/empresas/[id]/clientes` | Usuários-cliente da empresa (acesso ao PWA) |
| `/balancete/[empresaId]` | Matriz Ctrl Contábil — empresa × 12 meses, status célula a célula |
| `/balancete/[empresaId]/auditoria/[mes]` | FindingsBoard — auditoria do balancete daquele mês |
| `/robo/atividade` | Timeline do robô — quem publicou o quê, quando, em qual máquina |
| `/solicitacoes` | Chamados de clientes — fila, filtros, atribuição |
| `/solicitacoes/[id]` | Detalhe do chamado — conversa, dados do form, ações (resolver, fechar) |
| `/premiacoes` | Tabela funcionário × score × bônus R$ |
| `/premiacoes/regras` | Configuração dos níveis Bronze/Prata/Ouro |
| `/frequencia` | Folha de ponto digital |
| `/mural` | Mural interno do escritório |
| `/cortex/chat` | Cortex IA — assistente conversacional (em construção) |
| `/configuracoes/*` | Membros, planos, módulos, integrações |

---

## 6. Tela por tela (cliente PWA)

| Rota | O que tem |
|---|---|
| `/` | Home — 4 KPIs (Obrigações do mês / Vencendo 7d / Atrasadas / Avisos), próximas obrigações |
| `/obrigacoes` | Lista filtrada (Em aberto / Atrasadas / Entregues / Todas) + download de guias |
| `/solicitacoes` | Lista dos chamados + botão Nova solicitação |
| `/solicitacoes/[id]` | Conversa cliente↔escritório, dados enviados |
| `/documentos` | Balancetes e documentos agrupados por competência |
| `/notificacoes` | Avisos com deep-link para tela relevante |

---

## 7. Banco — tabelas principais

```
orgs (escritórios contábeis)
  ├── org_membros (funcionários — role enum)
  ├── org_departamentos (Fiscal, Pessoal, Contábil, Societário...)
  ├── org_modulos (quais módulos a org tem habilitados)
  ├── empresas (clientes do escritório)
  │   ├── empresa_responsaveis (qual funcionário cuida)
  │   ├── empresa_usuarios_finais (acessos ao PWA)
  │   ├── obrigacao_empresa (vínculos das obrigações)
  │   ├── entregas (cada obrigação × mês — coração)
  │   │   └── entrega_arquivos (anexos)
  │   ├── balancetes
  │   │   └── balancete_contas
  │   │       └── balancete_findings (auditoria)
  │   ├── controle_contabil_celulas (matriz empresa×mês)
  │   ├── solicitacoes (chamados)
  │   │   ├── solicitacao_mensagens (chat)
  │   │   └── solicitacao_anexos
  │   ├── cliente_notificacoes (sino do PWA)
  │   └── faturas (cobrança honorário)
  ├── kanban_tarefas + kanban_recorrencias
  ├── premiacoes_regras_org + pontos_eventos
  ├── frequencia_diaria
  ├── cortex_conversas (IA)
  └── ...
```

Total atual: **49 migrations versionadas** em `infra/supabase/migrations/`.

---

## 8. Stack técnica (resumo pra próximo dev)

| Camada | Tecnologia |
|---|---|
| Web (escritório) | Next.js 14 App Router + TypeScript estrito + Tailwind |
| Admin | Next.js 14 (mesma stack) |
| Client-app (PWA) | Vite + React 18 + TanStack Query + React Router v6 + vite-plugin-pwa |
| API | Go 1.22 + Fiber + pgx v5 + zerolog |
| Banco | Supabase Postgres + RLS + Storage + Auth |
| Robô | Tauri 2.0 + Rust + notify-rs (watcher) |
| Hosting | Netlify (web/admin/client-app) + Railway (API Go) + Supabase Cloud |

**Padrões obrigatórios:**
- Multi-tenant via RLS (helpers `app.user_pertence_a_org`, `app.user_eh_cliente_da_empresa`, `app.is_super_admin`)
- No backend Go, sempre usar `r.DB.WithTenant(ctx, fn)` — injeta `SET LOCAL app.current_user_id` e `app.current_org_id`
- PT-BR em copy, inglês em código técnico
- TypeScript estrito (`noUncheckedIndexedAccess`)

---

## 9. Como testar a esteira completa (script de 15 min)

1. **Login escritório** (`gabrielscheincouto@gmail.com`)
2. Vai em **Empresas** → seleciona **Padaria Bom Pão Ltda**
3. Vai em **Balancete** → mês **abril/2026** → **Auditoria**
4. Clica **Rodar auditoria** — deve detectar 2 findings (receita zerada, despesa atípica)
5. Justifica um e marca o outro como corrigido
6. Volta na matriz Ctrl Contábil — célula de abril libera **Liquidar mês**
7. Em outra aba, **Login cliente** (`dono.bompao@usecortex.com.br`)
8. PWA mostra 5 notificações no sino, 4 obrigações atrasadas, 3 chamados
9. Clica em "Admissão - Ana Padeira" → vê os dados do form
10. Responde no chat → volta no escritório → mensagem aparece em `/solicitacoes`

---

## 10. Comandos úteis (local dev)

```bash
# Subir o web (escritório) em :3000
cd web && npm install && npm run dev

# Subir o admin em :3001
cd admin && npm install && npm run dev

# Subir o PWA cliente em :3002
cd client-app && npm install && npm run dev

# Subir a API Go em :8080
cd api && go run cmd/server/main.go

# Aplicar nova migration
# (joga o arquivo em infra/supabase/migrations/0NN_descricao.sql e roda pelo Supabase MCP)
```

---

## 11. Troubleshooting

| Sintoma | Causa provável | Como resolver |
|---|---|---|
| "Você ainda não foi convidado pra escritório" | Usuário fez login no app errado (cliente entrou no web do escritório) | Acesse `usecortex-cliente.netlify.app` em vez de `usecortex-app.netlify.app` |
| Build do Netlify falha com `lru-cache@X.Y.Z not found` | Cache do npm no Netlify desatualizado | Apaga `package-lock.json` local, roda `npm install --package-lock-only`, commita |
| Cliente não vê dados | RLS bloqueando — falta vínculo em `empresa_usuarios_finais` | Verifica vínculo no banco e marca `ativo=true` |
| "findings_pendentes" ao tentar liquidar mês | Ainda tem balancete_finding em status `aberto` | Justifica, corrige ou arquiva todos antes |
| Cliente recebe notificação mas link não abre | Deep-link do PWA quebrado | Verifica payload da `cliente_notificacoes` |

---

## 12. Próximos passos (backlog ativo)

| # | Tarefa | Prioridade |
|---|---|---|
| 36 | App nativo iOS/Android via Capacitor (sobre client-app) | Alta |
| 37 | Push notifications nativos (APNs + FCM) | Alta |
| 38 | Publicar App Store | Média |
| 39 | Publicar Play Store | Média |
| 40 | Brand assets nativos (ícones, splash) | Média |
| 52 | Subdomínios usecortex.com.br (DNS Cloudflare + custom domain Netlify) | Alta |
| — | Landing pública usecortex.com.br | Média |
| — | Importador de balancete via planilha XLSX | Média |
| — | Cortex IA — assistente que olha balancetes e faz perguntas | Baixa |

---

## 13. Contato e suporte

- Repo: https://github.com/gabrielscheincouto-svg/cortex
- Supabase Studio: https://supabase.com/dashboard/project/ocbohmnmqtnrcwgvenus
- Issues do produto: criar no GitHub (`gabrielscheincouto-svg/cortex/issues`)
- Documentação adicional: `BACKLOG.md`, `BRAND.md`, `AGENTS.md`, `LEGADO_AUDIT.md` na raiz do repo

---

*Documento gerado em 31/05/2026. Atualize quando subir o domínio próprio e quando o app nativo entrar nas lojas.*
