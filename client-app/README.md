# Cortex — Client App (PWA do cliente final)

App PWA white-label para o **cliente do escritório** (empresa atendida).
É a porta de entrada do cliente para o Cortex: obrigações do mês, vencimento de
guias, solicitações ao escritório e (em fases futuras) chat, documentos e push.

## Stack

| Camada | Tech | Por quê |
|---|---|---|
| Build | Vite 5 | HMR rápido, build esbuild + Rollup |
| UI | React 18 + TypeScript estrito | Mesma stack do `web/` para consistência |
| Estilos | Tailwind 3 com tokens do brandbook | Reaproveita `tailwind.config.ts` espelho do `web/` |
| Rotas | React Router v6 | Client-side routing simples |
| Estado servidor | TanStack Query v5 | Cache + revalidação + offline-first |
| Auth + DB | `@supabase/supabase-js` | Mesmo projeto Supabase do escritório (`cortex saas`) |
| PWA | vite-plugin-pwa (Workbox) | Service worker autoupdate + manifest |
| Push | OneSignal Web SDK (próxima fase) | Não amarra a uma loja |

## Como rodar

```bash
cd client-app
cp .env.example .env.local      # preencher chaves
npm install
npm run dev                     # → http://localhost:3002
```

Comandos:

| Comando | O que faz |
|---|---|
| `npm run dev` | Vite dev server na porta 3002 |
| `npm run typecheck` | Roda `tsc -b` (sem erro = aprovado) |
| `npm run lint` | ESLint estrito (zero warnings) |
| `npm run build` | typecheck + build de produção |
| `npm run preview` | Serve o build em 3002 |
| `npm run icons` | Gera os PNGs do PWA a partir de `assets/icon-master.svg` |

## PWA — manifest, ícones e atualização

O app é um PWA pleno (instala em iOS/Android, funciona offline em modo
read-only, recebe avisos quando há nova versão). Configuração principal em
`vite.config.ts` na seção `VitePWA({ ... })`.

**Gerar ícones:**

1. Edite `assets/icon-master.svg` (1024×1024, conceito Cortex já está pronto).
2. Rode `npm run icons` — gera `public/icons/icon-192.png`, `icon-512.png`,
   `icon-maskable-192.png`, `icon-maskable-512.png` + `apple-touch-icon.png`
   via `@vite-pwa/assets-generator`.
3. Commit os PNGs (eles vão pro deploy estático).

**Atualização de versão:**

Em produção, quando o usuário tem o PWA aberto e uma nova versão é publicada,
ele vê um toast discreto ("Nova versão disponível · Atualizar agora"). Ele
escolhe quando recarregar — sem perder estado em formulários abertos.

**Offline:**

- Tudo que foi navegado fica no cache (HTML/JS/CSS/fontes).
- Queries do Supabase: network-first com fallback ao cache (5s timeout).
- Storage (downloads): cache-first (URLs assinadas mudam, então a versão
  cacheada serve enquanto está válida).
- API Go: sempre network-only (mutações precisam estar consistentes).
- Quando perde conexão, uma barra amarela aparece no topo avisando.

## Estrutura

```
client-app/
├── public/
│   ├── manifest.webmanifest    # nome, ícones, theme color
│   └── icons/                  # 192, 512, maskable
├── src/
│   ├── main.tsx                # entry; monta o app
│   ├── App.tsx                 # provedores (Query, Auth, Router)
│   ├── globals.css             # Tailwind directives + reset
│   ├── lib/
│   │   ├── supabase.ts         # cliente Supabase do browser
│   │   ├── api.ts              # wrapper da API Go (mutações)
│   │   ├── auth.tsx            # context de sessão + hook useAuth
│   │   ├── queryClient.ts      # configuração do TanStack Query
│   │   └── utils.ts            # cn, formatadores BR, datas
│   ├── components/
│   │   ├── ui.tsx              # Card, Button, Stat, Pill, Avatar, Empty
│   │   └── layout/
│   │       ├── app-shell.tsx   # wrapper autenticado (sidebar + topbar + outlet)
│   │       ├── sidebar.tsx     # nav lateral mobile-first
│   │       └── topbar.tsx      # header com avatar e atalhos
│   ├── pages/
│   │   ├── login.tsx
│   │   ├── home.tsx
│   │   ├── obrigacoes/list.tsx
│   │   ├── solicitacoes/list.tsx
│   │   ├── documentos/list.tsx
│   │   └── error/not-found.tsx
│   └── routes.tsx              # configuração de rotas
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.cjs
├── tsconfig.json
└── package.json
```

## Modelo mental de autenticação

O cliente faz login com email + magic link Supabase. Após o login,
o `useAuth` resolve para qual `empresa_id` ele tem acesso (via `empresa_membros`
ou `empresa_acessos` — definir no schema). Tudo que o cliente vê é filtrado por
essa `empresa_id` via RLS no Supabase.

O cliente **nunca** vê dados de outras empresas, nem dados internos do
escritório (kanban interno, premiação, etc.). RLS garante isso no banco.

## Padrões do código

- TypeScript estrito (`noUncheckedIndexedAccess` ligado).
- Componentes funcionais, sem `class`. `useEffect` sempre com cleanup.
- Queries com TanStack Query (`useQuery`/`useMutation`). Nada de `useEffect` para fetch.
- Erros viram `toast` (futuro) ou `<Empty>` com mensagem clara — nunca `alert()`.
- Português PT-BR em copy. Inglês em código técnico (`handler`, `fetcher`).
- Sem emoji em código a menos que solicitado pelo Gabriel.
