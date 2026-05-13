// Package db gerencia o pool de conexões com Postgres (Supabase) e
// fornece helpers para injetar contexto de tenancy (RLS) em cada query.
//
// O coração desse pacote é o WithTenant: ele faz SET LOCAL app.current_user_id
// e SET LOCAL app.current_org_id dentro de uma transação, de forma que as policies
// RLS do banco filtrem automaticamente as linhas que cada request pode ver.
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// DB é o handle público com pool conectado.
type DB struct {
	Pool *pgxpool.Pool
}

// New abre o pool de conexões e faz um ping inicial.
func New(ctx context.Context, dsn string) (*DB, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse dsn: %w", err)
	}

	// Tuning conservador, ajustar conforme observabilidade ao escalar.
	cfg.MaxConns = 20
	cfg.MinConns = 2
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.HealthCheckPeriod = 1 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}

	log.Info().Msgf("postgres conectado (max_conns=%d)", cfg.MaxConns)
	return &DB{Pool: pool}, nil
}

// Close fecha o pool.
func (db *DB) Close() { db.Pool.Close() }

// TenantCtx carrega o user_id e org_id atual do request.
// O middleware de auth (internal/auth) injeta isso no contexto após validar o JWT.
type TenantCtx struct {
	UserID uuid.UUID
	OrgID  uuid.UUID // pode ser zero (uuid.Nil) se o user ainda não selecionou org
}

type ctxKey string

const tenantKey ctxKey = "tenant"

// WithTenantValue anexa o TenantCtx ao contexto.
func WithTenantValue(ctx context.Context, t TenantCtx) context.Context {
	return context.WithValue(ctx, tenantKey, t)
}

// TenantFrom extrai o TenantCtx do contexto. Retorna zero values se ausente.
func TenantFrom(ctx context.Context) TenantCtx {
	t, _ := ctx.Value(tenantKey).(TenantCtx)
	return t
}

// WithTenant executa fn dentro de uma transação onde:
//   - SET LOCAL app.current_user_id = '<uuid>'
//   - SET LOCAL app.current_org_id  = '<uuid>'  (se não-zero)
//
// Essas configurações são lidas pelas funções RLS (app.current_user_id, app.current_org_id),
// fazendo com que TODAS as queries dentro de fn vejam apenas linhas permitidas pelo tenant.
//
// USE SEMPRE este helper para queries que não devem fazer bypass de RLS.
// Para acesso administrativo, usar o pool diretamente (db.Pool.Query).
func (db *DB) WithTenant(ctx context.Context, fn func(tx pgx.Tx) error) error {
	t := TenantFrom(ctx)
	if t.UserID == uuid.Nil {
		return fmt.Errorf("tenancy: user_id ausente no contexto")
	}

	tx, err := db.Pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx, "SELECT set_config('app.current_user_id', $1, true)", t.UserID.String()); err != nil {
		return fmt.Errorf("set user_id: %w", err)
	}
	if t.OrgID != uuid.Nil {
		if _, err := tx.Exec(ctx, "SELECT set_config('app.current_org_id', $1, true)", t.OrgID.String()); err != nil {
			return fmt.Errorf("set org_id: %w", err)
		}
	}

	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
