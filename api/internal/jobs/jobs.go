// Package jobs implementa workers cron que rodam dentro do mesmo processo da API.
//
// Para escalar (múltiplas instâncias da API rodando), migrar para um leader-election
// simples baseado em advisory locks do Postgres OU mover para um worker separado.
// Para a fase atual (1 instância da API), tudo aqui basta.
package jobs

import (
	"context"
	"time"

	"github.com/cecopel/api/internal/config"
	"github.com/cecopel/api/internal/db"
	"github.com/cecopel/api/internal/services"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog/log"
)

type Runner struct {
	DB  *db.DB
	Cfg *config.Config
}

func New(database *db.DB, cfg *config.Config) *Runner {
	return &Runner{DB: database, Cfg: cfg}
}

// Start dispara os jobs em background.
//   • Diário 03:00 BRT: fechamento de telemetria (popula org_telemetria_dia e platform_telemetria_dia)
//   • A cada 5 min: marca entregas atrasadas (status → 'atrasada' quando prazo_legal passou)
//   • A cada 10 min: atualiza heartbeat de robôs (expira hosts inativos > 1h)
//   • A cada 1h: remove uploads assinados órfãos que expiraram sem confirmação
func (r *Runner) Start(ctx context.Context) {
	go r.scheduleDaily(ctx, 3, 0, r.fechamentoDiario)
	go r.scheduleEvery(ctx, 5*time.Minute, r.marcarAtrasadas)
	go r.scheduleEvery(ctx, 10*time.Minute, r.expirarRobosInativos)
	go r.scheduleEvery(ctx, time.Hour, r.limparUploadsOrfaos)
	go r.scheduleEvery(ctx, time.Hour, r.gerarKanbanRecorrencias)
}

// scheduleEvery executa fn imediatamente e depois a cada interval, até ctx cancelar.
func (r *Runner) scheduleEvery(ctx context.Context, interval time.Duration, fn func(context.Context) error) {
	r.runWithLog(ctx, fn)
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			r.runWithLog(ctx, fn)
		}
	}
}

// scheduleDaily roda fn todo dia no horário HH:MM (TZ America/Sao_Paulo).
func (r *Runner) scheduleDaily(ctx context.Context, hour, minute int, fn func(context.Context) error) {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.UTC
	}
	for {
		now := time.Now().In(loc)
		next := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, loc)
		if !next.After(now) {
			next = next.Add(24 * time.Hour)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Until(next)):
			r.runWithLog(ctx, fn)
		}
	}
}

func (r *Runner) runWithLog(ctx context.Context, fn func(context.Context) error) {
	start := time.Now()
	if err := fn(ctx); err != nil {
		log.Error().Err(err).Str("job", funcName(fn)).Msg("job_falhou")
		return
	}
	log.Info().Str("job", funcName(fn)).Dur("duracao", time.Since(start)).Msg("job_ok")
}

func funcName(fn any) string {
	// best-effort; em produção pode-se anotar manualmente
	return "anon"
}

// ─── JOB: fechamento diário ───────────────────────────────────
// Popula org_telemetria_dia e platform_telemetria_dia para a data de ontem.
func (r *Runner) fechamentoDiario(ctx context.Context) error {
	const sql = `
		INSERT INTO public.org_telemetria_dia (
		    org_id, data, usuarios_total, empresas_ativas, empresas_total,
		    entregas_processadas_dia, entregas_no_prazo_dia, entregas_atrasadas_dia,
		    entregas_pendentes_total, entregas_atrasadas_total, arquivos_via_robo_dia,
		    solicitacoes_abertas, solicitacoes_resolvidas_dia,
		    honorarios_total_cents
		)
		SELECT
		    o.id,
		    (CURRENT_DATE - INTERVAL '1 day')::date AS data,
		    (SELECT COUNT(*) FROM public.org_membros WHERE org_id = o.id AND status='ativo'),
		    (SELECT COUNT(*) FROM public.empresas WHERE org_id = o.id AND status='ativa'),
		    (SELECT COUNT(*) FROM public.empresas WHERE org_id = o.id),
		    (SELECT COUNT(*) FROM public.entregas WHERE org_id = o.id AND entregue_em::date = CURRENT_DATE - INTERVAL '1 day'),
		    (SELECT COUNT(*) FROM public.entregas WHERE org_id = o.id AND entregue_em::date = CURRENT_DATE - INTERVAL '1 day' AND entregue_em::date <= prazo_legal),
		    (SELECT COUNT(*) FROM public.entregas WHERE org_id = o.id AND status = 'atrasada'),
		    (SELECT COUNT(*) FROM public.entregas WHERE org_id = o.id AND status IN ('pendente','em_andamento','aguardando_cliente')),
		    (SELECT COUNT(*) FROM public.entregas WHERE org_id = o.id AND status = 'atrasada'),
		    (SELECT COUNT(*) FROM public.entrega_arquivos WHERE org_id = o.id AND origem IN ('robo_tauri','robo_drive','robo_onedrive') AND created_at::date = CURRENT_DATE - INTERVAL '1 day'),
		    (SELECT COUNT(*) FROM public.solicitacoes WHERE org_id = o.id AND status IN ('nova','em_atendimento','aguardando_cliente')),
		    (SELECT COUNT(*) FROM public.solicitacoes WHERE org_id = o.id AND resolvida_em::date = CURRENT_DATE - INTERVAL '1 day'),
		    (SELECT COALESCE(SUM(honorario_mensal_cents),0) FROM public.empresas WHERE org_id = o.id AND status = 'ativa')
		FROM public.orgs o
		WHERE o.status = 'ativo' OR o.status = 'trial'
		ON CONFLICT (org_id, data) DO UPDATE SET
		    usuarios_total = EXCLUDED.usuarios_total,
		    empresas_ativas = EXCLUDED.empresas_ativas,
		    empresas_total = EXCLUDED.empresas_total,
		    entregas_processadas_dia = EXCLUDED.entregas_processadas_dia,
		    entregas_no_prazo_dia = EXCLUDED.entregas_no_prazo_dia,
		    entregas_atrasadas_dia = EXCLUDED.entregas_atrasadas_dia,
		    entregas_pendentes_total = EXCLUDED.entregas_pendentes_total,
		    entregas_atrasadas_total = EXCLUDED.entregas_atrasadas_total,
		    arquivos_via_robo_dia = EXCLUDED.arquivos_via_robo_dia,
		    solicitacoes_abertas = EXCLUDED.solicitacoes_abertas,
		    solicitacoes_resolvidas_dia = EXCLUDED.solicitacoes_resolvidas_dia,
		    honorarios_total_cents = EXCLUDED.honorarios_total_cents
	`
	_, err := r.DB.Pool.Exec(ctx, sql)
	if err != nil {
		return err
	}

	// platform-wide
	const sqlPlat = `
		INSERT INTO public.platform_telemetria_dia (
		    data, orgs_ativas, orgs_trial, orgs_pagantes,
		    novos_signups_dia, entregas_total_dia
		)
		VALUES (
		    (CURRENT_DATE - INTERVAL '1 day')::date,
		    (SELECT COUNT(*) FROM public.orgs WHERE status = 'ativo'),
		    (SELECT COUNT(*) FROM public.orgs WHERE status = 'trial'),
		    (SELECT COUNT(*) FROM public.assinaturas WHERE status = 'ativa'),
		    (SELECT COUNT(*) FROM public.orgs WHERE created_at::date = CURRENT_DATE - INTERVAL '1 day'),
		    (SELECT COUNT(*) FROM public.entregas WHERE created_at::date = CURRENT_DATE - INTERVAL '1 day')
		)
		ON CONFLICT (data) DO UPDATE SET
		    orgs_ativas = EXCLUDED.orgs_ativas,
		    orgs_trial = EXCLUDED.orgs_trial,
		    orgs_pagantes = EXCLUDED.orgs_pagantes,
		    novos_signups_dia = EXCLUDED.novos_signups_dia,
		    entregas_total_dia = EXCLUDED.entregas_total_dia
	`
	_, err = r.DB.Pool.Exec(ctx, sqlPlat)
	return err
}

// ─── JOB: marcar entregas atrasadas ───────────────────────────
// Roda a cada 5 minutos.
// Toda entrega com prazo_legal < hoje e status ∈ (pendente, em_andamento, aguardando_cliente) vira 'atrasada'.
func (r *Runner) marcarAtrasadas(ctx context.Context) error {
	const sql = `
		UPDATE public.entregas
		SET status = 'atrasada', updated_at = now()
		WHERE status IN ('pendente','em_andamento','aguardando_cliente')
		  AND prazo_legal < CURRENT_DATE
	`
	ct, err := r.DB.Pool.Exec(ctx, sql)
	if err != nil {
		return err
	}
	if ct.RowsAffected() > 0 {
		log.Warn().Int64("rows", ct.RowsAffected()).Msg("entregas_marcadas_atrasadas")
	}
	return nil
}

// ─── JOB: marcar robôs inativos ───────────────────────────────
// Hosts Tauri que não enviaram heartbeat há mais de 1 hora viram ativo=false.
func (r *Runner) expirarRobosInativos(ctx context.Context) error {
	const sql = `
		UPDATE public.robo_hosts
		SET ativo = FALSE
		WHERE ativo = TRUE AND ultimo_heartbeat_at < now() - INTERVAL '1 hour'
	`
	_, err := r.DB.Pool.Exec(ctx, sql)
	return err
}

// ─── JOB: limpar uploads órfãos ───────────────────────────────
func (r *Runner) limparUploadsOrfaos(ctx context.Context) error {
	storage, err := services.NewStorageClient(r.Cfg)
	if err != nil {
		return err
	}
	rows, err := r.DB.Pool.Query(ctx, `
		SELECT id, bucket, storage_path
		FROM public.uploads_pendentes
		WHERE confirmado_em IS NULL
		  AND cancelado_em IS NULL
		  AND expira_em < now() - INTERVAL '1 hour'
		ORDER BY expira_em
		LIMIT 100
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var id, bucket, path string
		if err := rows.Scan(&id, &bucket, &path); err != nil {
			return err
		}
		_ = storage.DeleteObject(ctx, bucket, path)
		if _, err := r.DB.Pool.Exec(ctx, `
			UPDATE public.uploads_pendentes
			SET cancelado_em = now(), erro = 'orfão expirado'
			WHERE id = $1 AND confirmado_em IS NULL AND cancelado_em IS NULL
		`, id); err != nil {
			return err
		}
	}
	return rows.Err()
}

func (r *Runner) gerarKanbanRecorrencias(ctx context.Context) error {
	_, err := r.DB.Pool.Exec(ctx, `
		WITH due AS (
			SELECT * FROM public.kanban_recorrencias
			WHERE ativa = TRUE AND proxima_geracao <= CURRENT_DATE
			LIMIT 100
		), ins AS (
			INSERT INTO public.kanban_tarefas
			    (org_id, titulo, descricao, departamento, prioridade, responsavel_id, co_responsavel_id, prazo, recorrente_id)
			SELECT org_id, titulo, descricao, departamento, prioridade, responsavel_id, co_responsavel_id,
			       proxima_geracao, id
			FROM due
			RETURNING recorrente_id
		)
		UPDATE public.kanban_recorrencias r
		SET proxima_geracao = CASE r.periodicidade
			WHEN 'diaria' THEN (r.proxima_geracao + INTERVAL '1 day')::date
			WHEN 'semanal' THEN (r.proxima_geracao + INTERVAL '7 days')::date
			WHEN 'mensal' THEN (r.proxima_geracao + INTERVAL '1 month')::date
			WHEN 'anual' THEN (r.proxima_geracao + INTERVAL '1 year')::date
			ELSE (r.proxima_geracao + INTERVAL '1 month')::date
		END
		WHERE r.id IN (SELECT recorrente_id FROM ins)
	`)
	return err
}

// Helper para usar pgx scan padrão (caso queiramos parametrizar).
var _ = pgx.ErrNoRows
