# Cortex — API Go

Backend HTTP + WebSocket do Cortex, o cérebro do escritório contábil. Stack: **Go 1.22 + Fiber + pgx + Supabase Auth (JWT)**.

## Estrutura

```
api/
├── cmd/server/main.go             # Entrypoint
├── internal/
│   ├── config/         # Carrega .env e expõe Config tipada
│   ├── logger/         # zerolog (JSON em prod, console em dev)
│   ├── db/             # Pool pgx + helper WithTenant (RLS)
│   ├── auth/           # Middleware JWT do Supabase
│   ├── middleware/     # CORS, recover, request_id, log
│   ├── models/         # DTOs e tipos compartilhados
│   ├── repo/           # Camada de dados (queries SQL)
│   ├── handler/        # Handlers HTTP REST
│   ├── realtime/       # Hub WebSocket (chat + mural)
│   ├── jobs/           # Workers cron (telemetria, alertas)
│   └── server/         # Bootstrap Fiber + registro de rotas
├── Dockerfile          # Multi-stage build → imagem distroless ~25 MB
├── Makefile            # make run | build | test | docker | deploy
├── fly.toml            # Config para deploy no Fly.io (região GRU)
├── go.mod
└── .env.example
```

## Coração da arquitetura: RLS automático

O isolamento entre escritórios não vive no código Go — vive no Postgres via Row Level Security. O Go só **injeta o contexto** em cada query:

```go
// Em qualquer handler autenticado, o request já tem user_id e org_id no contexto.
// Toda query passa pelo helper WithTenant, que abre uma transação e roda:
//
//     SET LOCAL app.current_user_id = '<uuid>';
//     SET LOCAL app.current_org_id  = '<uuid>';
//
// As policies RLS do banco (migração 015) usam essas variáveis para filtrar
// automaticamente — não precisamos lembrar de adicionar WHERE org_id = ? em
// cada SELECT. Se esquecermos, o banco devolve zero linhas (seguro por default).
```

Veja `internal/db/db.go` (WithTenant) e `internal/auth/auth.go` (Middleware).

## Rotas (MVP da Fase 2)

| Método | Path | O que faz |
|---|---|---|
| GET | `/health` | Health check público |
| GET | `/api/v1/me` | Perfil do user + orgs em que é membro |
| PATCH | `/api/v1/me/current-org` | Define a org atual (multi-tenancy) |
| GET | `/api/v1/orgs` | Lista orgs do user |
| POST | `/api/v1/orgs` | Cria nova org (com plano + adiciona user como admin) |
| GET | `/api/v1/empresas?q=&limit=&offset=` | Lista empresas do escritório com busca |
| POST | `/api/v1/empresas` | Cadastra nova empresa atendida |
| GET | `/api/v1/entregas?status=&departamento=&competencia=` | Lista de entregas com filtros |
| PATCH | `/api/v1/entregas/:id/status` | Muda status de entrega (entregue / atrasada / etc.) |
| POST | `/api/v1/uploads/preparar` | Gera URL assinada para upload direto ao Supabase Storage |
| POST | `/api/v1/uploads/:id/confirmar` | Confirma o upload e cria registros finais |
| POST | `/api/v1/uploads/:id/cancelar` | Cancela upload pendente e tenta remover o objeto |
| GET | `/api/v1/arquivos/:id/download-url` | Gera URL assinada de download |
| GET | `/ws` | WebSocket realtime (chat + mural) |

Próximas fases vão adicionar: mural completo, chat de produção, comandos Cortex e super-admin avançado.

## Upload assinado

Arquivos grandes não passam pela API Go. O fluxo oficial é:

1. Cliente ou robô chama `POST /api/v1/uploads/preparar` com `contexto`, nome, MIME, tamanho e payload do contexto.
2. A API valida plano, MIME e tenant, cria `uploads_pendentes` e devolve `upload_url`.
3. Cliente ou robô faz `PUT` dos bytes direto na `upload_url`.
4. Cliente ou robô chama `POST /api/v1/uploads/:upload_id/confirmar`.
5. A API faz `HEAD` no Storage, compara tamanho e grava o registro final em `entrega_arquivos`, `solicitacao_anexos`, `chat_anexos`, `profiles.avatar_url` ou `orgs.logo_url`.

Contextos suportados:

| Contexto | Bucket |
|---|---|
| `robo_entrega`, `manual_entrega`, `cliente_arquivo` | `entregas` |
| `solicitacao` | `solicitacoes` |
| `mural` | `mural` |
| `chat` | `chat` |
| `avatar` | `avatars` |
| `logo_org` | `logos-orgs` |

O endpoint antigo `POST /api/v1/robo/upload` retorna `410 Gone`; o robô Tauri usa preparar → PUT → confirmar.

## Rodar local

### 1) Pré-requisitos

- Go 1.22+
- Acesso ao projeto Supabase com as migrations 001–016 aplicadas (veja `infra/supabase/migrations/`)

### 2) Configurar

```bash
cd api/
cp .env.example .env
# edite .env com seus dados do Supabase:
#   - DATABASE_URL → pegar em Settings → Database → Connection string
#   - SUPABASE_URL → Settings → API → Project URL
#   - SUPABASE_ANON_KEY → Settings → API → anon public
#   - SUPABASE_SERVICE_ROLE_KEY → Settings → API → service_role (manter privado!)
#   - SUPABASE_JWT_SECRET → Settings → API → JWT Secret
```

### 3) Rodar

```bash
make tidy   # baixa deps
make run    # sobe a API em :8080
```

Teste:

```bash
curl http://localhost:8080/health
# {"service":"cecopel-api","status":"ok"}
```

### 4) Testar uma rota autenticada

Pegue um JWT do Supabase fazendo login pelo dashboard ou pela função `supabase.auth.signInWithPassword(...)` no console do navegador:

```bash
TOKEN="eyJhbGciOi..."  # cola seu JWT aqui
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/me
```

Se você for super-admin (`profiles.is_super_admin = TRUE`), enxergará tudo. Senão, só verá as orgs em que é membro.

## Deploy no Fly.io (recomendado)

Por que Fly: edge region em São Paulo (`gru`), free tier generoso, deploy via Dockerfile, scaling automático.

### 1) Setup inicial

```bash
# Instale o fly CLI (uma vez)
curl -L https://fly.io/install.sh | sh

# Faça login
fly auth login

# Crie o app (não fazer deploy ainda — vamos subir segredos primeiro)
cd api/
fly launch --no-deploy --name cortex-api --region gru
```

### 2) Subir segredos

```bash
fly secrets set \
    DATABASE_URL="postgres://..." \
    SUPABASE_URL="https://xxx.supabase.co" \
    SUPABASE_ANON_KEY="eyJ..." \
    SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
    SUPABASE_JWT_SECRET="seu-jwt-secret" \
    CORS_ALLOWED_ORIGINS="https://app.usecortex.com.br,https://admin.usecortex.com.br"
```

### 3) Deploy

```bash
make deploy    # = fly deploy
```

A primeira deploy demora ~3 min (build + push). Próximas, ~1 min. Configure depois `api.usecortex.com.br` em Settings → Certificates.

## Próximos passos (Fase 3+)

- Painel super-admin Next.js (`/admin/`) consumindo essa API
- Frontend escritório (`/web/`) consumindo essa API
- Robô Tauri enviando arquivos via upload assinado
- Mais handlers: obrigações, solicitações, chat, mural, conquistas
- Webhooks Stripe para sincronizar `assinaturas`
