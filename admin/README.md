# Cortex — Admin Next.js

Painel super-admin (`admin.usecortex.com.br`). Stack: **Next.js 14 App Router + TypeScript + Tailwind + Supabase Auth**.

## O que tem dentro

```
admin/
├── app/
│   ├── layout.tsx                          # root layout
│   ├── globals.css                         # Tailwind + tokens Cortex
│   ├── page.tsx                            # redirect → /dashboard
│   ├── login/page.tsx                      # login Supabase (email+senha)
│   └── (admin)/                            # rotas protegidas — exigem is_super_admin
│       ├── layout.tsx                      # sidebar + topbar
│       ├── dashboard/page.tsx              # KPIs globais (MRR, churn, robôs ativos)
│       ├── escritorios/
│       │   ├── page.tsx                    # lista com busca
│       │   ├── novo/page.tsx               # criar escritório (chama API Go)
│       │   └── [id]/page.tsx               # detalhe (telemetria, módulos, plano)
│       └── planos/page.tsx                 # catálogo de planos
├── components/
│   ├── ui.tsx                              # Card, Button, Input, Stat, Pill, Empty
│   ├── sidebar.tsx                         # navegação lateral
│   └── topbar.tsx                          # user + logout
├── lib/
│   ├── supabase.ts                         # clients browser + server (@supabase/ssr)
│   ├── api.ts                              # cliente da API Go (Fase 2)
│   └── utils.ts                            # cn, brl, dateBR, badges
├── middleware.ts                           # proteção de rotas + renovação de sessão
├── tailwind.config.ts                      # paleta Cortex (ink, brand, gold, rose, mind)
├── package.json
├── tsconfig.json
├── next.config.mjs
├── vercel.json                             # deploy na região gru1 (São Paulo)
└── .env.local.example
```

## Rodar local

### 1) Pré-requisitos

- Node.js 20+
- API Go da Fase 2 rodando em `http://localhost:8080` (ou pelo menos as migrations 001-016 aplicadas no Supabase)
- Você precisa estar marcado como `is_super_admin = TRUE` em `public.profiles`

### 2) Setup

```bash
cd admin/
cp .env.local.example .env.local
# Edite .env.local com os dados do seu projeto Supabase SaaS:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   NEXT_PUBLIC_API_URL=http://localhost:8080  (ou URL da API Go em produção)

npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). O middleware vai te redirecionar para `/login`. Use o email/senha do user que você marcou como super-admin no banco.

### 3) Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (hot-reload) |
| `npm run build` | Build de produção |
| `npm run start` | Roda o build localmente |
| `npm run typecheck` | Verifica tipos sem build |
| `npm run lint` | ESLint |

## Deploy no Vercel (recomendado)

Vercel é o jeito mais simples — região São Paulo já configurada em `vercel.json`.

```bash
# Uma vez:
npm i -g vercel
vercel login

# Cada deploy:
cd admin/
vercel --prod
```

No primeiro deploy, o Vercel pergunta o nome do projeto e linka com o git. Depois você sobe as variáveis no painel:

- Project Settings → Environment Variables → adicione todas do `.env.local.example`
- Project Settings → Domains → adicione `admin.usecortex.com.br` e siga as instruções de DNS

## Deploy alternativo: Netlify

```bash
# Uma vez:
npm i -g netlify-cli
netlify login

# Cada deploy:
netlify deploy --prod
```

## Como funciona a autenticação

1. User abre `/login`, digita email+senha
2. `supabase.auth.signInWithPassword()` no client → Supabase Auth cria sessão e seta cookies
3. `middleware.ts` lê os cookies em cada request, renova token e bloqueia rotas se não autenticado
4. `(admin)/layout.tsx` faz double-check: além de ter sessão, exige `profiles.is_super_admin = TRUE`
5. Server Components fazem queries ao Supabase com o JWT do usuário (RLS bypass automático quando super-admin)
6. Ações que precisam de lógica do backend (ex: criar escritório) vão para a API Go via `lib/api.ts`

## Páginas pendentes (entram nas próximas iterações)

- `/catalogo` — catálogo global de obrigações
- `/conquistas` — catálogo global de conquistas
- `/faturamento` — assinaturas Stripe + faturas
- `/telemetria` — gráficos históricos com Recharts
- `/robos` — hosts Tauri conectados
- `/auditoria` — visualizador de audit_log

Essas páginas seguem o mesmo padrão das que já existem: criar Server Component que consulta o Supabase (ou a API Go quando for operação), e usar os primitivos de `components/ui.tsx`.

## Decisões de design

- **Server Components por padrão** — Next.js 14 App Router. Só viramos client component quando há interação (`'use client'` no topo).
- **Supabase direto para leitura agregada** — quando é só SELECT de listas/contagens, vamos direto pelo `@supabase/ssr` (mais rápido). Para mutações com regra de negócio (criar org, mudar plano), passamos pela API Go.
- **Sem state management externo** — para o admin, o estado vive em URL params, server components, e `useState` local. React Query foi listado nas deps por ser útil em telas com filtros pesados (entrará quando necessário).
- **Tailwind sem componentes externos** — primitivos locais em `components/ui.tsx`. Trocar a paleta = editar 1 arquivo (`tailwind.config.ts`).
