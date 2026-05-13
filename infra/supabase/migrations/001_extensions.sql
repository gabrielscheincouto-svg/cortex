-- ============================================================
-- 001 — Extensions do Postgres usadas pelo CECOPEL 2.0
-- ============================================================
-- Aplicar primeiro. Cria as extensions necessárias para:
--   • uuid-ossp     → geração de UUIDs (gen_random_uuid já é nativo no PG 13+, mas mantemos)
--   • pgcrypto      → hashing seguro (usado para invite tokens, password reset, etc.)
--   • citext        → emails e slugs case-insensitive
--   • pg_trgm       → busca por similaridade (autocomplete de empresa, busca de mensagens)
--   • btree_gin     → índices GIN sobre arrays e JSONB (para filtros multi-valor)
--   • unaccent      → busca ignorando acentos (importante PT-BR)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Schema dedicado para funções auxiliares (helpers de RLS, tenancy, etc.)
CREATE SCHEMA IF NOT EXISTS app;
COMMENT ON SCHEMA app IS 'Schema próprio para funções e tipos da camada de aplicação CECOPEL 2.0';

-- Tipo enum reutilizável para o status genérico de "ativo / desativado / arquivado"
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_basico') THEN
        CREATE TYPE app.status_basico AS ENUM ('ativo', 'inativo', 'arquivado');
    END IF;
END$$;
