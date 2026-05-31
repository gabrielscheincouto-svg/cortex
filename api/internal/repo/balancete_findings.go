package repo

import (
	"context"
	"fmt"
	"strings"

	"github.com/cecopel/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ListBalanceteFindings retorna findings de um balancete com filtros opcionais
// (severity, status). Ordenado por severity desc (danger primeiro) + created_at desc.
func (r *Repo) ListBalanceteFindings(
	ctx context.Context,
	balanceteID uuid.UUID,
	severityFilter *models.FindingSeverity,
	statusFilter *models.FindingStatus,
) ([]models.BalanceteFinding, error) {
	args := []any{balanceteID}
	where := []string{"balancete_id = $1"}

	if severityFilter != nil {
		args = append(args, *severityFilter)
		where = append(where, fmt.Sprintf("severity = $%d", len(args)))
	}
	if statusFilter != nil {
		args = append(args, *statusFilter)
		where = append(where, fmt.Sprintf("status = $%d", len(args)))
	}

	q := `
		SELECT id, org_id, balancete_id, severity::text, tipo::text, titulo, descricao,
		       conta_codigo, conta_descricao, valor_referencia, contexto,
		       status::text, justificativa, resolvido_por_id, resolvido_em, run_token,
		       created_at, updated_at
		FROM public.balancete_findings
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY CASE severity WHEN 'danger' THEN 0 ELSE 1 END, created_at DESC
	`

	var out []models.BalanceteFinding
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, q, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var f models.BalanceteFinding
			var severityStr, tipoStr, statusStr string
			if err := rows.Scan(
				&f.ID, &f.OrgID, &f.BalanceteID, &severityStr, &tipoStr,
				&f.Titulo, &f.Descricao,
				&f.ContaCodigo, &f.ContaDescricao, &f.ValorReferencia, &f.Contexto,
				&statusStr, &f.Justificativa, &f.ResolvidoPorID, &f.ResolvidoEm, &f.RunToken,
				&f.CreatedAt, &f.UpdatedAt,
			); err != nil {
				return err
			}
			f.Severity = models.FindingSeverity(severityStr)
			f.Tipo = models.FindingTipo(tipoStr)
			f.Status = models.FindingStatus(statusStr)
			out = append(out, f)
		}
		return rows.Err()
	})
	return out, err
}

// GetBalanceteFinding carrega 1 finding por id (escopo de tenant via RLS).
func (r *Repo) GetBalanceteFinding(ctx context.Context, id uuid.UUID) (*models.BalanceteFinding, error) {
	f := &models.BalanceteFinding{}
	var severityStr, tipoStr, statusStr string
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			SELECT id, org_id, balancete_id, severity::text, tipo::text, titulo, descricao,
			       conta_codigo, conta_descricao, valor_referencia, contexto,
			       status::text, justificativa, resolvido_por_id, resolvido_em, run_token,
			       created_at, updated_at
			FROM public.balancete_findings
			WHERE id = $1
		`, id).Scan(
			&f.ID, &f.OrgID, &f.BalanceteID, &severityStr, &tipoStr,
			&f.Titulo, &f.Descricao,
			&f.ContaCodigo, &f.ContaDescricao, &f.ValorReferencia, &f.Contexto,
			&statusStr, &f.Justificativa, &f.ResolvidoPorID, &f.ResolvidoEm, &f.RunToken,
			&f.CreatedAt, &f.UpdatedAt,
		)
	})
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	f.Severity = models.FindingSeverity(severityStr)
	f.Tipo = models.FindingTipo(tipoStr)
	f.Status = models.FindingStatus(statusStr)
	return f, nil
}

// ResolverBalanceteFinding muda o status de um finding (justificar / corrigir / arquivar)
// e marca quem resolveu + quando.
//
// Regras de validação aplicadas:
//   - status precisa estar em {justificado, corrigido, arquivado}
//   - justificativa é obrigatória para 'justificado' e 'arquivado'
//   - se já estiver resolvido, devolve ErrConflict
func (r *Repo) ResolverBalanceteFinding(
	ctx context.Context,
	id, userID uuid.UUID,
	dto models.ResolverFindingDTO,
) (*models.BalanceteFinding, error) {
	switch dto.Status {
	case models.FindingStatusJustificado, models.FindingStatusCorrigido, models.FindingStatusArquivado:
		// ok
	default:
		return nil, fmt.Errorf("status inválido: %s", dto.Status)
	}
	if (dto.Status == models.FindingStatusJustificado || dto.Status == models.FindingStatusArquivado) &&
		(dto.Justificativa == nil || strings.TrimSpace(*dto.Justificativa) == "") {
		return nil, fmt.Errorf("justificativa é obrigatória para status %s", dto.Status)
	}

	f := &models.BalanceteFinding{}
	var severityStr, tipoStr, statusStr string
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		// Trava a linha pra evitar dupla resolução
		var jaResolvido bool
		if err := tx.QueryRow(ctx, `
			SELECT status <> 'aberto' FROM public.balancete_findings
			WHERE id = $1 FOR UPDATE
		`, id).Scan(&jaResolvido); err != nil {
			return err
		}
		if jaResolvido {
			return ErrConflict
		}

		return tx.QueryRow(ctx, `
			UPDATE public.balancete_findings
			SET status = $1,
			    justificativa = COALESCE($2, justificativa),
			    resolvido_por_id = $3,
			    resolvido_em = now()
			WHERE id = $4
			RETURNING id, org_id, balancete_id, severity::text, tipo::text, titulo, descricao,
			          conta_codigo, conta_descricao, valor_referencia, contexto,
			          status::text, justificativa, resolvido_por_id, resolvido_em, run_token,
			          created_at, updated_at
		`, dto.Status, dto.Justificativa, userID, id).Scan(
			&f.ID, &f.OrgID, &f.BalanceteID, &severityStr, &tipoStr,
			&f.Titulo, &f.Descricao,
			&f.ContaCodigo, &f.ContaDescricao, &f.ValorReferencia, &f.Contexto,
			&statusStr, &f.Justificativa, &f.ResolvidoPorID, &f.ResolvidoEm, &f.RunToken,
			&f.CreatedAt, &f.UpdatedAt,
		)
	})
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	f.Severity = models.FindingSeverity(severityStr)
	f.Tipo = models.FindingTipo(tipoStr)
	f.Status = models.FindingStatus(statusStr)
	return f, nil
}

// BalanceteResumoFindings agrega contagens (total, abertos, danger, warnings, resolvidos).
// Usa o helper SQL app.balancete_findings_resumo().
func (r *Repo) BalanceteResumoFindings(ctx context.Context, balanceteID uuid.UUID) (*models.BalanceteFindingsResumo, error) {
	res := &models.BalanceteFindingsResumo{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			SELECT total, abertos, danger, warnings, resolvidos
			FROM app.balancete_findings_resumo($1)
		`, balanceteID).Scan(&res.Total, &res.Abertos, &res.Danger, &res.Warnings, &res.Resolvidos)
	})
	return res, err
}

// BalancetePodeLiquidar retorna TRUE quando não há findings em status 'aberto'.
// Usa o helper SQL app.balancete_pode_liquidar().
func (r *Repo) BalancetePodeLiquidar(ctx context.Context, balanceteID uuid.UUID) (bool, error) {
	var ok bool
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT app.balancete_pode_liquidar($1)`, balanceteID).Scan(&ok)
	})
	return ok, err
}
