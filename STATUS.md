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

## Como subir do zero (ambiente já provisionado em 2026-05-12)

**Provisionamento JÁ feito:**
- ✅ Repo `gabrielscheincouto-svg/cortex` populado no GitHub
- ✅ Supabase `cortex saas` (ref `ocbohmnmqtnrcwgvenus`, us-west-1): 29 migrations rodadas, 57 tabelas, 40 enums, 108 RLS policies, 18 funções, 6 storage buckets, 3 planos seed, 10 conquistas seed
- ✅ Auth Site URL = `http://localhost:3000`; Redirect URLs = `localhost:3000/**` e `localhost:3001/**`
- ✅ `.env` files preenchidos localmente em `api/`, `web/`, `admin/` (não vão pro repo — `.gitignore` protege)

**Subir os serviços no Mac:**

```bash
# 1. API Go (terminal 1)
cd api && go run ./cmd/api        # → http://localhost:8080

# 2. Web (terminal 2)
cd web && npm install && npm run dev   # → http://localhost:3000

# 3. Admin (terminal 3)
cd admin && npm install && npm run dev # → http://localhost:3001

# 4. Robô Tauri (terminal 4 — opcional pra teste de upload)
cd robot && npm install && npm run tauri dev
```

**Primeiro login:**
1. Abre http://localhost:3000
2. Clica em "Cadastre-se" e usa um email seu (recebe magic link)
3. Pelo dashboard do Supabase (Authentication → Users) você vê seu user com `id`
4. Roda o SQL abaixo no SQL Editor pra criar uma org de demo e te vincular como admin:

```sql
WITH novo_org AS (
  INSERT INTO public.orgs (slug, nome, cor_primaria, plano_id, status)
  SELECT 'cortex-demo', 'Cortex Demo', '#22C55E', p.id, 'ativo'
  FROM public.planos p WHERE p.codigo = 'pro' LIMIT 1
  RETURNING id
)
INSERT INTO public.org_membros (org_id, user_id, role, status)
SELECT n.id, '<COLA-SEU-USER-UUID-AQUI>', 'admin', 'ativo' FROM novo_org n;

UPDATE public.profiles SET current_org_id = (SELECT id FROM public.orgs WHERE slug = 'cortex-demo')
WHERE id = '<COLA-SEU-USER-UUID-AQUI>';
```

## Deploy em produção (próximos passos quando quiser)

| Componente | Plataforma sugerida | Status |
|---|---|---|
| `web/` + `admin/` | Vercel (já tem `vercel.json`) | Faltam logar e clicar "Import from GitHub" |
| `api/` (Go + WS) | Fly.io ou Railway | Já tem `Dockerfile` em `api/` |
| `robot/` Tauri | Build local + distribuir .dmg/.exe | Sem deploy externo |

Quando subir, lembre de:
- Atualizar Auth Redirect URLs no Supabase para os domínios de produção
- Atualizar `CORS_ALLOWED_ORIGINS` no `.env` da API
- Atualizar `NEXT_PUBLIC_API_URL` nos `.env.local` dos frontends

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
