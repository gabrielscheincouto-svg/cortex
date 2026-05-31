# Migrations do banco — CECOPEL 2.0

Schema completo para o novo projeto Supabase: 22 tabelas, RLS multi-tenant, gamificação, mural, chat e tudo mais para a Fase 1.

## Passo 1 — Criar o projeto novo no Supabase

1. Acesse https://supabase.com/dashboard
2. Botão **New project**
3. Preencha:
   - **Name**: `cecopel-saas` (ou `cecopel-2-0`)
   - **Database password**: gere uma senha forte e **salve em algum lugar seguro** (1Password, Bitwarden, etc.). Você não vai usar ela no dia-a-dia, mas precisa dela para conexões diretas no Postgres.
   - **Region**: `South America (São Paulo)` — sempre que possível, para latência baixa com clientes brasileiros
   - **Pricing plan**: começa em Free; passa para Pro (US$25/mês) quando ultrapassar 500 MB de banco ou 1 GB de storage
4. Aguarde 1-2 minutos enquanto o Supabase provisiona

Quando criar, anote estas duas chaves (vão para o `.env` da API Go depois):

- `SUPABASE_URL` → `https://xxxxxxxxxxx.supabase.co`
- `SUPABASE_ANON_KEY` → começa com `eyJ...`
- `SUPABASE_SERVICE_ROLE_KEY` → começa com `eyJ...` (essa só o backend Go usa, **nunca expor no frontend**)

Acha as chaves em **Project Settings → API**.

## Passo 2 — Aplicar as migrations

Abra o **SQL Editor** do Supabase (ícone de banco de dados na sidebar) e execute os arquivos **em ordem**. Cada um é independente; rode um por vez, conferindo se rodou sem erro antes de passar para o próximo.

Ordem de aplicação:

| # | Arquivo | O que cria |
|---|---|---|
| 1 | `001_extensions.sql` | Extensions do PG (uuid, citext, pgcrypto, trigram, unaccent) + schema `app` |
| 2 | `002_orgs_planos_membros.sql` | Tabelas `planos`, `orgs`, `profiles`, `org_membros` |
| 3 | `003_modulos_assinaturas.sql` | `modulos_catalogo`, `org_modulos`, `assinaturas`, `faturas` |
| 4 | `004_empresas.sql` | `empresas`, `empresa_responsaveis`, `empresa_usuarios_finais` |
| 5 | `005_obrigacoes_catalogo.sql` | `obrigacoes_catalogo`, `obrigacao_empresa` |
| 6 | `006_entregas.sql` | `entregas`, `entrega_arquivos`, `entrega_eventos`, `telemetria_tempo` |
| 7 | `007_solicitacoes.sql` | `solicitacoes`, `solicitacao_mensagens`, `solicitacao_anexos` |
| 8 | `008_telemetria.sql` | `org_telemetria_dia`, `platform_telemetria_dia`, `robo_hosts` |
| 9 | `009_mural.sql` | `mural_posts`, `mural_reacoes`, `mural_comentarios` |
| 10 | `010_chat.sql` | `chat_canais`, `chat_membros`, `chat_mensagens`, `chat_anexos`, `chat_reacoes` |
| 11 | `011_gamificacao.sql` | `conquistas_catalogo`, `conquistas_usuario`, `pontos_eventos`, `ranking_periodos`, `regras_pontuacao_org` |
| 12 | `012_audit_log.sql` | `audit_log` |
| 13 | `013_functions_helpers.sql` | Funções `current_org_id()`, `is_super_admin()`, `touch_updated_at()`, etc. |
| 14 | `014_triggers.sql` | Triggers de updated_at, profile auto-create, denormalizações |
| 15 | `015_rls_policies.sql` | Row Level Security em todas as tabelas |
| 16 | `016_seed_data.sql` | Módulos, 3 planos, 10 conquistas, 6 obrigações iniciais |

**Atalho:** se preferir, dá pra concatenar todos os arquivos em ordem e rodar uma vez só:

```bash
cd "infra/supabase/migrations"
cat 0*.sql > _all.sql
# cola o conteúdo de _all.sql no SQL Editor do Supabase
```

## Passo 3 — Verificar que tudo subiu

A última migration (`016_seed_data.sql`) termina com um SELECT de verificação. Resultado esperado:

| coluna | valor esperado |
|---|---|
| `tabelas` | 22 |
| `indices` | ~80 |
| `policies` | ~60 |
| `modulos` | 17 |
| `planos` | 3 |
| `conquistas_globais` | 10 |
| `obrigacoes_globais` | 6 |

Se algum número estiver abaixo, alguma migration falhou — confira a ordem e o log de erros.

Queries adicionais de sanity check:

```sql
-- Lista todas as tabelas do schema public
SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;

-- Confere que RLS está ativo em todas as tabelas
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND rowsecurity=FALSE;
-- ↑ resultado esperado: 0 linhas (todas com RLS ativo)

-- Lista as funções do schema app
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'app';
```

## Passo 4 — Criar o primeiro super-admin (você)

Após aplicar tudo, você precisa criar o seu user no Supabase Auth e marcá-lo como super-admin.

```sql
-- 1) Crie um usuário via Authentication → Users → Add user (Supabase Dashboard)
--    Email: gabrielscheincouto@gmail.com
--    Password: ...
--    Confirma email manualmente.

-- 2) Marque como super-admin:
UPDATE public.profiles
SET is_super_admin = TRUE
WHERE email = 'gabrielscheincouto@gmail.com';

-- 3) Confere:
SELECT id, nome, email, is_super_admin FROM public.profiles WHERE is_super_admin = TRUE;
```

A partir daqui, esse user vê tudo no banco (bypass de RLS pelas policies).

## Passo 5 — Criar a primeira org (CECOPEL como cliente teste)

```sql
INSERT INTO public.orgs (slug, nome, cnpj, razao_social, plano_id, status, criada_por, onboarding_completo)
VALUES (
    'cecopel',
    'CECOPEL',
    '12345678000199',                                              -- CNPJ real da Cecopel
    'Cecopel — Centro Contábil De Pelotas Ltda',
    (SELECT id FROM public.planos WHERE codigo = 'enterprise'),
    'ativo',
    (SELECT id FROM public.profiles WHERE is_super_admin = TRUE LIMIT 1),
    TRUE
);

-- Adiciona você como admin dessa org
INSERT INTO public.org_membros (org_id, user_id, role, status, aceito_em)
VALUES (
    (SELECT id FROM public.orgs WHERE slug = 'cecopel'),
    (SELECT id FROM public.profiles WHERE is_super_admin = TRUE LIMIT 1),
    'admin',
    'ativo',
    now()
);

-- Define como org atual no profile
UPDATE public.profiles
SET current_org_id = (SELECT id FROM public.orgs WHERE slug = 'cecopel')
WHERE is_super_admin = TRUE;
```

## Passo 6 — Configurar buckets no Storage

No Supabase Dashboard → Storage → New bucket. Crie:

| Bucket | Public? | Para que serve |
|---|---|---|
| `entregas` | ❌ privado | Arquivos SPED/guias/recibos das entregas |
| `solicitacoes` | ❌ privado | Anexos das solicitações |
| `mural` | ❌ privado | Mídia anexada em posts |
| `chat` | ❌ privado | Anexos do chat interno |
| `avatars` | ✅ público | Fotos de perfil |
| `logos-orgs` | ✅ público | Logos das orgs (white-label) |

Crie as policies de storage depois — vamos cobrir isso na Fase 2 (API Go) com upload assinado.

## Troubleshooting

**"function gen_random_uuid() does not exist"** → você esqueceu de rodar a migration 001. Rode-a e tente de novo.

**"role authenticated does not exist"** → você está rodando contra um Postgres puro, não Supabase. O Supabase já tem essa role nativa.

**"new row violates row-level security policy"** ao tentar inserir → você não está autenticado, ou está autenticado mas não é membro da org daquela linha. Para queries administrativas, conecte usando a `service_role` key (no SQL Editor, isso é automático).

**Quero apagar tudo e começar de novo:**

```sql
-- DESTRUTIVO — só rode se quiser zerar o banco
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
DROP SCHEMA IF EXISTS app CASCADE;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon, authenticated, service_role;
```

Depois reaplique 001 → 016.

## Próximos passos (Fase 2: API Go)

Quando este banco estiver no ar:

1. Setup do repositório Go no diretório `api/`
2. Conexão Postgres com `pgx` + injeção de `current_user_id`/`current_org_id` via `SET LOCAL`
3. Middleware de JWT do Supabase Auth
4. Endpoints REST `/api/v1/orgs`, `/api/v1/empresas`, `/api/v1/obrigacoes`, `/api/v1/entregas`, etc.
5. WebSocket para chat + mural realtime
6. Worker cron para popular `org_telemetria_dia` e `platform_telemetria_dia`

Me avisa quando o banco estiver subido e a gente parte para a Fase 2.
