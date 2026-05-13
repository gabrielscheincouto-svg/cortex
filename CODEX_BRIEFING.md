# Briefing para o Codex — Cortex

> **Codex: leia este documento primeiro.** Depois leia `BRAND.md`, `README.md` e `BACKLOG.md` na mesma pasta. Trabalhe diretamente nos arquivos sob esta pasta (a pasta no disco se chama `CECOPEL 2.0/` por motivos históricos, mas o produto comercial é o **Cortex**). Decisões arquiteturais e revisão de qualidade ficam com o Claude — você foca em implementação.

## Nome do produto: Cortex

- **Cortex** — nome comercial do SaaS, sem acento
- **Tagline:** "O cérebro do escritório contábil"
- **Domínio:** usecortex.com.br
- A IA dentro do sistema **se chama Cortex também** (não tem sub-marca). "Cortex sugere...", "Cortex pensou em..."

A pasta no disco e o nome interno do repo continuam `CECOPEL 2.0` (não renomear — quebra paths). Mas:
- Em **textos visíveis ao usuário** (UI, emails, OG tags, títulos de página) → sempre "Cortex"
- Em **comentários de código, nomes de variáveis técnicas** → pode manter como está
- Quando criar **novos arquivos de branding/landing/marketing** → usar "Cortex"

**Antes de qualquer alteração visual, leia `BRAND.md`** — define paleta (inclui novo `mind-*` ramp para IA), tom de voz, microcopy e elementos do conceito "cérebro".

## O que é o projeto

SaaS para escritórios de contabilidade brasileiros. Substitui o Acessórias com:
- Liquidação automática de obrigações fiscais via robô que monitora pasta
- 4 dashboards gerenciais (prazos, comunicação, rentabilidade, produtividade)
- Mural interno + chat interno + app PWA white-label
- Gamificação sóbria (pontos, conquistas, ranking)
- **Cortex IA** — copiloto agentic com acesso a dados em tempo real + legislação BR atualizada via RAG (TASK-060 a TASK-064)
- Multi-tenant via Row Level Security no Postgres

## Stack travada (não mudar sem alinhamento)

| Camada | Tech | Pasta |
|---|---|---|
| Banco + Auth + Storage + Realtime | Supabase (Postgres + RLS) | `infra/supabase/migrations/` |
| Backend API | Go 1.22 + Fiber + pgx v5 + zerolog | `api/` |
| Super-admin (você, CECOPEL) | Next.js 14 App Router + TypeScript + Tailwind + @supabase/ssr | `admin/` |
| Frontend escritório | Next.js 14 (mesma stack do admin) | `web/` |
| Robô desktop | Tauri 2 (Rust core) + Vite/React (webview) | `robot/` |
| App cliente final (futuro) | PWA (Vite + React) | `client-app/` (não criada ainda) |

## Padrões obrigatórios

### Universal
- Português PT-BR em comentários, mensagens de usuário, nomes de variáveis de negócio (ex: `empresas`, `entregas`, `competencia`)
- Inglês em conceitos técnicos (`handler`, `repo`, `middleware`)
- Sem emoji em código (a menos que explicitamente pedido pelo usuário)
- Sentence case ("Lista de entregas", não "Lista De Entregas")

### Banco (`infra/supabase/migrations/`)
- Migrations sempre **numeradas e idempotentes** (CREATE IF NOT EXISTS, ON CONFLICT)
- Toda tabela de tenant tem `org_id UUID NOT NULL REFERENCES public.orgs(id)`
- Toda tabela tem `created_at` e (quando faz sentido) `updated_at`
- RLS sempre habilitado; políticas em `015_rls_policies.sql` no padrão `app.is_super_admin() OR app.user_pertence_a_org(org_id)`
- Logs append-only (`*_eventos`, `pontos_eventos`, `audit_log`) — sem UPDATE/DELETE policies
- Enums no schema `app` (`app.entrega_status`, `app.departamento`, etc.)

### Go API (`api/`)
- Toda query passa por `db.WithTenant()` — abre transação e injeta `SET LOCAL app.current_user_id` + `app.current_org_id`. **Nunca** queries direto no pool sem RLS, exceto jobs cron com bypass explícito.
- Handlers em `internal/handler/*.go`, queries em `internal/repo/*.go`, DTOs em `internal/models/models.go`
- Erros voltam como `{"error": "code", "message": "..."}` com status HTTP apropriado
- Logger zerolog estruturado, nunca `fmt.Println` em produção
- Endpoints sob `/api/v1/...`, autenticados via `auth.Middleware(jwtSecret, true)`

### Next.js (`admin/` e `web/`)
- App Router. Server Components por padrão; `'use client'` só quando há interação
- Queries de leitura agregada via `@supabase/ssr` (`lib/supabase.ts::createServerClient`)
- Mutações com regra de negócio via `lib/api.ts::apiServer()` (que chama a API Go)
- Componentes em `components/ui.tsx` (Card, Button, Input, Stat, Pill, Avatar, Empty) — reutilizar sempre, não duplicar
- Tailwind only — sem outros frameworks CSS
- Ícones de `lucide-react`
- Tipos compartilhados em `lib/api.ts` (cópia local, não monorepo ainda)

### Rust (`robot/src-tauri/`)
- `tokio` async, `tracing` para logs
- Erros customizados em `error.rs` com `thiserror`
- Comandos Tauri ficam em `main.rs`, expostos via `invoke_handler![...]`
- Eventos para o webview via `app.emit("pipeline://event", payload)`

## Estado atual (12/05/2026)

| Fase | Status | Pasta | O que falta |
|---|---|---|---|
| 1 — Banco | esqueleto pronto | `infra/supabase/migrations/` | aplicar no Supabase + importar catálogo Acessórias |
| 2 — API Go | esqueleto pronto | `api/` | mais handlers (ver BACKLOG); deploy Fly.io |
| 3 — Admin Next.js | esqueleto pronto | `admin/` | páginas `/catalogo`, `/conquistas`, `/faturamento`, `/telemetria`, `/robos`, `/auditoria` |
| 4 — Web escritório | esqueleto pronto | `web/` | páginas `/empresas/[id]`, `/chat/[id]`, `/solicitacoes/[id]`, `/dashboards`, `/conquistas`, `/obrigacoes`, `/configuracoes` |
| 5 — Robô Tauri | esqueleto pronto | `robot/` | parsers DCTFWeb/DIRBI/eSocial; auto-updater; ícones |
| 6 — App PWA cliente | não iniciada | `client-app/` (criar) | tudo |

## Sistema antigo

**Não mexer.** Está em produção. Mora em pastas-irmãs (`sistema cecopel/cecopel-gestao/`, `clientes/`, etc.). O Gabriel continua trabalhando lá enquanto o CECOPEL 2.0 não está 100%.

## Como trabalhar

1. **Sempre leia o BACKLOG.md** para escolher a próxima tarefa
2. **Cada item do backlog aponta para arquivos de referência** — leia antes de implementar, copie o padrão
3. **Não invente arquitetura nova** — se algo parecer faltar, pergunte ao Gabriel; ele decide com o Claude
4. **Mantenha consistência visual e de naming** com o que já existe
5. **Após implementar**, marque a tarefa como ✅ no BACKLOG.md e adicione 1-2 linhas resumindo o que mudou
6. **Não rode `npm install` ou `cargo build` se não tiver certeza** — pode quebrar lockfiles. Pergunte antes.
7. **Não delete nem renomeie arquivos existentes** sem alinhamento — outros lugares podem depender deles

## Comandos úteis (para testar localmente)

```bash
# API Go
cd api/ && make run

# Admin Next.js (porta 3000)
cd admin/ && npm run dev

# Web escritório (porta 3001)
cd web/ && npm run dev

# Robô Tauri
cd robot/ && npm run tauri:dev
```

## Convenções de commit (sugestão)

```
fase4: implementa /empresas/[id] com obrigações vinculadas
fase5: parser DCTFWeb extraindo CNPJ e competência
docs: atualiza BACKLOG após /dashboards
```

## Em caso de dúvida

Pergunte ao Gabriel. Ele consulta o Claude se for decisão arquitetural.
