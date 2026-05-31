# Cortex — Web (escritório)

Frontend do dia-a-dia do colaborador (`app.usecortex.com.br`). Mesma stack do admin: **Next.js 14 + TypeScript + Tailwind + Supabase**.

## Estrutura

```
web/
├── app/
│   ├── layout.tsx                          # root
│   ├── globals.css                         # Tailwind + paleta Cortex
│   ├── page.tsx                            # redirect → /home
│   ├── login/page.tsx                      # login Supabase
│   └── (app)/                              # rotas protegidas
│       ├── layout.tsx                      # sidebar dinâmica + topbar
│       ├── home/page.tsx                   # home gamificada
│       ├── entregas/
│       │   ├── page.tsx                    # lista com filtros (tabs por status)
│       │   └── [id]/page.tsx               # detalhe com timeline + arquivos
│       ├── empresas/
│       │   ├── page.tsx                    # lista com busca
│       │   └── nova/page.tsx               # cadastro
│       ├── solicitacoes/page.tsx           # ticket-system
│       ├── mural/page.tsx                  # feed corporativo
│       └── chat/page.tsx                   # lista de canais
├── components/
│   ├── ui.tsx                              # Card, Button, Input, Stat, Pill, Avatar, Empty
│   ├── sidebar.tsx                         # navegação dinâmica (filtra por módulos da org)
│   └── topbar.tsx                          # seletor de org + user + logout
├── lib/
│   ├── supabase.ts                         # clients browser + server
│   ├── api.ts                              # cliente da API Go
│   ├── utils.ts                            # formatters BR, badges, avatares
│   └── modulos.ts                          # resolve módulos ativos da org
├── middleware.ts                           # proteção de rotas + renova sessão
├── tailwind.config.ts                      # paleta Cortex
├── package.json
├── vercel.json                             # deploy gru1 (São Paulo)
└── .env.local.example
```

## Diferenças de design vs o admin

| Aspecto | Admin | Web |
|---|---|---|
| Sidebar | Fundo escuro (`ink-900`) — sensação corporativa de painel | Fundo branco — sensação de produtividade do dia-a-dia |
| Cor de destaque | `rose` (super-admin) | `gold` (gamificação) + `brand` (verde Cecopel) |
| Navegação | Estática, todas as áreas | **Dinâmica** — filtra módulos conforme o plano da org + overrides |
| Audiência | Time Cortex | Colaboradores do escritório cliente |
| Porta de dev | 3000 | 3001 |

## Como a sidebar fica inteligente

Cada item de menu em `components/sidebar.tsx` pode declarar `modulo: 'liquidacao'`. No `(app)/layout.tsx`, a gente chama `loadOrgContext()` que combina:

1. `planos.modulos_inclusos` do plano contratado
2. `org_modulos` (overrides explícitos do super-admin)
3. Role do user na org (`org_membros.role`) — só admin/gerente vê /configuracoes

Resultado: um escritório no plano Free não vê Liquidação, Dashboards ou Chat. Quando upgrade para Pro, esses itens aparecem automaticamente — sem deploy, sem feature flag custom.

## Rodar local

```bash
cd web/
cp .env.local.example .env.local
# preencha NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL

npm install
npm run dev          # http://localhost:3001
```

Pré-requisitos para ver dados:
1. Migrations 001-016 aplicadas no Supabase (Fase 1)
2. API Go rodando em `localhost:8080` (Fase 2)
3. Seu user precisa pertencer a alguma org (use o admin Next.js para criar uma org e te adicionar como admin)

## Deploy Vercel

```bash
cd web/
vercel --prod
```

Depois configure:
- `Settings → Environment Variables` com as 3 vars do .env.local
- `Settings → Domains` adiciona `app.usecortex.com.br`

## Páginas backlog (próximas iterações)

| Página | O que faz |
|---|---|
| `/empresas/[id]` | Detalhe de empresa, com obrigações vinculadas e responsáveis |
| `/chat/[id]` | Conversa de um canal (lista de mensagens + composer + realtime via WebSocket) |
| `/solicitacoes/[id]` | Conversa do ticket + ações de atendimento + avaliação |
| `/mural` (criar post) | Form de novo post com markdown + categoria + departamentos-alvo |
| `/dashboards` | 4 dashboards interativos (Recharts ou ECharts) |
| `/conquistas` | Catálogo visual de conquistas + minhas conquistas + progresso |
| `/obrigacoes` | Catálogo de obrigações e vinculação com empresas |
| `/configuracoes` | Convidar usuários, gerenciar permissões, branding white-label |

Cada uma segue o mesmo padrão: Server Component que consulta Supabase ou API Go, primitivos de `components/ui.tsx`, design system consistente.

## Decisões de design

- **Sidebar branca, não escura** — o admin é onde o time Cortex entra meia hora por dia para olhar números. O web é onde o colaborador passa 8 horas/dia. Cor neutra reduz fadiga visual.
- **Gold como cor de gamificação** — herda do sistema de Premiação 2026 que já existe no cecopel-gestao. Continuidade visual com o que o time já conhece.
- **Multi-tenancy invisível** — o user nem percebe que existe `org_id` no banco. A topbar mostra o seletor só se ele pertencer a mais de uma org (caso raro).
- **Filtros de entregas via URL params** — links são compartilháveis, voltar/avançar funciona, dá pra bookmarkar "minhas atrasadas".
