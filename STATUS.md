# Estado do Usecortex — 2026-05-12

> Snapshot do que está pronto e o que vem a seguir. Atualizar a cada sprint.

## ✅ MVP pronto pra subir

### Backend (Go + Supabase)
- Multi-tenant Supabase Postgres com RLS por `org_id` (migrations 001–041).
- API Fiber em `api/internal/` com pgx v5, JWT Supabase, WebSocket realtime, signed uploads.
- Endpoints completos pra: orgs, membros, empresas, entregas, obrigações, solicitações, mural, chat, kanban, frequência, balancete, IRPF, telemetria, ranking, gamificação.
- Cortex IA: conversas, mensagens com SSE streaming, ações pendentes (v3), memória persistente (v4), busca global cross-entity, comando palette.
- Workers cron: telemetria diária, alertas, ranking.

### Robô Tauri (Rust)
- `notify-rs` watcher monitora pastas configuradas.
- Identificadores: SPED, DCTFWeb, DIRBI, eSocial, IRPF.
- Pipeline: identifica → parser básico → upload com hash → confirma na API.
- Tray icon + telas Tauri (login, status, logs, config).

### Web (Next.js — escritório)
- Sidebar dinâmica por módulo + roles.
- Home com gamificação + mural + chat preview.
- Páginas core: Entregas (lista + detalhe), Empresas, Solicitações, Mural, Chat (com reconnect + JWT refresh + marcar lido), Kanban, Frequência, Balancete, IRPF (4 telas).
- Cortex IA: launcher flutuante + drawer com chat SSE + ação proposta + `/cortex/memorias` + `/configuracoes/cortex` (admin).
- **Cortex Quick (Cmd+K)**: palette tipo Linear/Raycast com 14 ações rápidas, busca cross-entity debounce 200ms, sugestão Cortex single-shot.

### Admin (Next.js — super-admin Cecopel)
- Login Supabase + middleware + clients.
- Telas: dashboard, escritórios.
- Deploy config Vercel/Netlify.

### Branding
- BRAND.md alinhado 1:1 ao brandbook oficial (maio/2026).
- Paleta oficial nos dois `tailwind.config.ts` (web + admin) + globals.css.
- Avatar Cortex = símbolo do brandbook (C em rede de nós, hemisférios verde + violeta).
- Tipografia Inter (UI) + Playfair Display (display/hero).

### Qualidade
- GitHub Actions: build + test Go, typecheck + build Next.js (web + admin), cargo check Rust.
- Tests Go: detector de intenção do Cortex (`DetectarAcao`, `inferirTipoMemoria`).

## 🟡 Bloqueado

- **TASK-061 — RAG legislação Brasileira.** Depende de você baixar os PDFs da Receita Federal (Manual eSocial, Guia DCTFWeb, manuais SPED). Quando os PDFs estiverem em `infra/rag/seed/`, o pipeline de embedding entra. Quando entrar, `BuildContextoMemoria` (já pronto) vai dentro de `<contexto_memoria>...</contexto_memoria>` no system prompt do Claude API.

## 🔵 Pós-MVP (não bloqueia subir)

- Refinamento dos parsers DCTFWeb / DIRBI / eSocial (TASK-024/025/026/027) — hoje parseiam o essencial; refinar quando aparecer caso real.
- Tests com testcontainers Postgres (RLS real).
- Tests do `identifier.rs` e parsers do robô.
- Vercel preview automático em PRs.

## Como subir do zero

```bash
# 1. Aplicar migrations no Supabase
cd infra/supabase
ls migrations/*.sql | sort | xargs -I {} psql $DATABASE_URL -f {}

# 2. API Go
cd api
cp .env.example .env  # preencher SUPABASE_JWT_SECRET, DATABASE_URL
go run ./cmd/api

# 3. Web Next
cd web
cp .env.example .env.local  # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_API_URL
npm install
npm run dev  # http://localhost:3000

# 4. Admin Next
cd admin && npm install && npm run dev  # http://localhost:3001

# 5. Robô Tauri (opcional pra dev — só pra clientes finais)
cd robot && npm install && npm run tauri dev
```

## Atalhos no app

| Atalho            | Ação                              |
|-------------------|-----------------------------------|
| `⌘K` / `Ctrl+K`   | Cortex Quick (palette de busca)   |
| `⇧⌘K`             | Drawer do Cortex (chat)           |
| Botão flutuante   | Drawer do Cortex (chat)           |
| `Esc`             | Fecha palette/drawer aberto       |
| `↑↓` no palette   | Navega pelos resultados           |
| `Enter` no palette| Abre seleção / pede ao Cortex     |

## Como testar o Cortex

1. Login no `web/`.
2. Aperte `⌘K`. Digite uma empresa — aparece nos resultados. Enter abre.
3. Aperte `⌘K`. Digite `cria tarefa: revisar DCTFWeb da Aquarela amanhã`. Aparece "Pedir ao Cortex". Enter → card de ação proposta. Confirmar → tarefa aparece em `/kanban`.
4. Clique no botão flutuante (canto inferior direito). Digite `lembre que eu prefiro ver Contábil primeiro`. Confirmar a ação proposta.
5. Digite `que memórias você tem sobre mim?` no drawer. Cortex responde.
6. Vá em `/cortex/memorias` — vê a memória, edita, arquiva.
7. Admin/gerente vai em `/configuracoes/cortex` — liga/desliga ferramentas por role.
