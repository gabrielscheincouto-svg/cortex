# CECOPEL 2.0

Plataforma SaaS para escritórios de contabilidade. Sucessora do sistema CECOPEL atual.

## Visão

Substituir o Acessórias para escritórios de contabilidade brasileiros, oferecendo:

- **Módulo de liquidação automática** — robô próprio (Tauri) que monitora pasta, identifica SPED/guias, dispara ao cliente e liquida obrigações
- **Gestão interna do escritório** — 4 dashboards gerenciais (prazos, comunicação, rentabilidade, produtividade)
- **Comunicação fluida** — mural interno + chat interno + app PWA white-label para o cliente final
- **Gamificação sóbria** — pontos, conquistas, ranking, integrado ao sistema de premiação existente
- **Multi-tenant** — qualquer escritório se cadastra, escolhe plano, importa empresas e começa a usar

## Arquitetura

4 níveis de acesso (Super-admin CECOPEL → Admin do Escritório → Colaborador → Cliente Final) sobre stack de produção:

| Camada | Tecnologia | Por quê |
|---|---|---|
| Banco + Auth + Storage + Realtime | Supabase (Postgres + RLS) | Multi-tenant via Row Level Security, custo baixo até dezenas de milhares de usuários |
| Backend API | Go + Fiber | Binário único ~10MB RAM, 100K+ req/s, edge regions Brasil |
| Painel super-admin | Next.js 14 (TypeScript) em `admin.cecopel.com.br` | Isolado, profissional, deploy Netlify/Vercel |
| Painel do escritório / colaborador | cecopel-gestao SPA atual + novos módulos | Reaproveita o que já está em produção |
| App do cliente final | PWA (Vite + React + Tailwind) | Sem loja de app, código único, push via OneSignal |
| Robô de liquidação | Tauri 2.0 (Rust) | Cross-platform, binário ~5–8 MB, watcher nativo do OS |

Ver organograma completo: `CECOPEL_2.0_Organograma_v2_Producao.svg`

## Estrutura de pastas

```
CECOPEL 2.0/
├── README.md                                # Este arquivo
├── CECOPEL_2.0_Diagnostico_e_Roadmap.docx   # Roadmap em 5 fases
├── CECOPEL_2.0_Organograma_v2_Producao.svg  # Diagrama de arquitetura
├── CECOPEL_2.0_Mockup_Home_Colaborador.html # Mockup navegável da tela do colaborador
│
├── infra/
│   └── supabase/
│       └── migrations/                      # ⬅ FASE ATUAL — aplicar no Supabase
│           ├── 001_extensions.sql
│           ├── 002_orgs_planos_membros.sql
│           ├── 003_modulos_assinaturas.sql
│           ├── 004_empresas.sql
│           ├── 005_obrigacoes_catalogo.sql
│           ├── 006_entregas.sql
│           ├── 007_solicitacoes.sql
│           ├── 008_telemetria.sql
│           ├── 009_mural.sql
│           ├── 010_chat.sql
│           ├── 011_gamificacao.sql
│           ├── 012_audit_log.sql
│           ├── 013_functions_helpers.sql
│           ├── 014_triggers.sql
│           ├── 015_rls_policies.sql
│           ├── 016_seed_data.sql
│           └── README.md                    # Passo-a-passo de aplicação
│
├── api/             # (Fase 2) Backend Go + Fiber
├── admin/           # (Fase 3) Next.js admin.cecopel.com.br
├── web/             # (Fase 4) Frontend do escritório (cecopel-gestao evoluído)
├── client-app/      # (Fase 5) PWA do cliente final
└── robot/           # (Fase 6) Tauri 2.0 + Rust
```

## Roadmap em 5 fases (~6 meses)

| Fase | Duração | O que entrega |
|---|---|---|
| **1 — Banco de dados** ⬅ atual | 1–2 dias | 22 tabelas no Supabase com RLS multi-tenant + seed |
| 2 — API Go | 4–6 semanas | Backend completo servindo CRUD + WebSocket + auth |
| 3 — Painel super-admin | 3–4 semanas | admin.cecopel.com.br para criar escritórios |
| 4 — Liquidação + dashboards | 6–8 semanas | Lista de Entregas, 4 dashboards, robô MVP |
| 5 — App cliente PWA | 4–6 semanas | PWA white-label com push + email |
| 6 — White-label + cobrança | contínuo | Onboarding self-service + Stripe/Pagar.me |

## Decisões arquiteturais já tomadas

- Backend: **Go + Fiber** (alta performance, baixo custo de infra)
- Robô: **Tauri 2.0 + Rust** (cross-platform, binário pequeno)
- Frontend admin: **Next.js 14 + TypeScript**
- Banco: **novo projeto Supabase** dedicado ao SaaS (o atual `ojqyjbzlkmsayxmigsay` continua servindo a CECOPEL operacional)
- Subdomínios: `admin.cecopel.com.br` (super-admin), `app.cecopel.com.br` (escritório + colaborador)
- Norma IA: **fora do escopo inicial** — pode entrar como feature premium na Fase 6+

## Próximos passos imediatos

1. Criar projeto novo no Supabase (sugestão de nome: `cecopel-saas`)
2. Anotar o `SUPABASE_URL` e `SUPABASE_ANON_KEY` do projeto novo
3. Abrir o SQL Editor do Supabase
4. Aplicar as migrations em ordem (001 → 016) — ver `infra/supabase/migrations/README.md`
5. Verificar que tudo subiu (queries de checagem no README)
6. Daí seguimos para a Fase 2: API Go
