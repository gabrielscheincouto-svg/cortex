package repo

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/cecopel/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Repo) ListBalancetes(ctx context.Context, orgID uuid.UUID, empresaID *uuid.UUID, competencia *string, limit int) (*models.Page[models.Balancete], error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	where := []string{"b.org_id = $1"}
	args := []any{orgID}
	if empresaID != nil {
		args = append(args, *empresaID)
		where = append(where, fmt.Sprintf("b.empresa_id = $%d", len(args)))
	}
	if competencia != nil && *competencia != "" {
		args = append(args, *competencia)
		where = append(where, fmt.Sprintf("b.competencia = $%d", len(args)))
	}
	args = append(args, limit)
	limitPos := len(args)
	whereSQL := strings.Join(where, " AND ")

	page := &models.Page[models.Balancete]{Limit: limit, Offset: 0}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		countQ := fmt.Sprintf(`SELECT COUNT(*) FROM public.balancetes b WHERE %s`, whereSQL)
		if err := tx.QueryRow(ctx, countQ, args[:len(args)-1]...).Scan(&page.Total); err != nil {
			return err
		}
		listQ := fmt.Sprintf(`
			SELECT b.id, b.org_id, b.empresa_id, e.razao_social, b.competencia, b.fechado,
			       b.fechado_em, b.fechado_por_id, b.observacoes,
			       COUNT(c.id)::int AS contas_count, b.created_at, b.updated_at
			FROM public.balancetes b
			JOIN public.empresas e ON e.id = b.empresa_id
			LEFT JOIN public.balancete_contas c ON c.balancete_id = b.id
			WHERE %s
			GROUP BY b.id, e.razao_social
			ORDER BY b.competencia DESC, e.razao_social
			LIMIT $%d
		`, whereSQL, limitPos)
		rows, err := tx.Query(ctx, listQ, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var b models.Balancete
			if err := rows.Scan(&b.ID, &b.OrgID, &b.EmpresaID, &b.EmpresaNome, &b.Competencia, &b.Fechado, &b.FechadoEm, &b.FechadoPorID, &b.Observacoes, &b.ContasCount, &b.CreatedAt, &b.UpdatedAt); err != nil {
				return err
			}
			page.Data = append(page.Data, b)
		}
		return rows.Err()
	})
	return page, err
}

func (r *Repo) CreateBalancete(ctx context.Context, orgID uuid.UUID, dto models.CreateBalanceteDTO) (*models.Balancete, error) {
	var b models.Balancete
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			INSERT INTO public.balancetes (org_id, empresa_id, competencia, observacoes)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (empresa_id, competencia) DO UPDATE
			SET observacoes = COALESCE(EXCLUDED.observacoes, public.balancetes.observacoes),
			    updated_at = now()
			RETURNING id, org_id, empresa_id,
			          (SELECT razao_social FROM public.empresas WHERE id = empresa_id),
			          competencia, fechado, fechado_em, fechado_por_id, observacoes,
			          (SELECT COUNT(*)::int FROM public.balancete_contas WHERE balancete_id = public.balancetes.id),
			          created_at, updated_at
		`, orgID, dto.EmpresaID, dto.Competencia, dto.Observacoes).Scan(&b.ID, &b.OrgID, &b.EmpresaID, &b.EmpresaNome, &b.Competencia, &b.Fechado, &b.FechadoEm, &b.FechadoPorID, &b.Observacoes, &b.ContasCount, &b.CreatedAt, &b.UpdatedAt)
	})
	return &b, err
}

func (r *Repo) GetBalancete(ctx context.Context, id uuid.UUID) (*models.BalanceteDetalhe, error) {
	out := &models.BalanceteDetalhe{Contas: []models.BalanceteConta{}}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, `
			SELECT b.id, b.org_id, b.empresa_id, e.razao_social, b.competencia, b.fechado,
			       b.fechado_em, b.fechado_por_id, b.observacoes,
			       (SELECT COUNT(*)::int FROM public.balancete_contas c WHERE c.balancete_id = b.id),
			       b.created_at, b.updated_at
			FROM public.balancetes b
			JOIN public.empresas e ON e.id = b.empresa_id
			WHERE b.id = $1
		`, id).Scan(&out.Balancete.ID, &out.Balancete.OrgID, &out.Balancete.EmpresaID, &out.Balancete.EmpresaNome, &out.Balancete.Competencia, &out.Balancete.Fechado, &out.Balancete.FechadoEm, &out.Balancete.FechadoPorID, &out.Balancete.Observacoes, &out.Balancete.ContasCount, &out.Balancete.CreatedAt, &out.Balancete.UpdatedAt); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `
			SELECT id, balancete_id, org_id, codigo, descricao, grupo, saldo_anterior,
			       debito, credito, saldo_atual, natureza, ordem
			FROM public.balancete_contas
			WHERE balancete_id = $1
			ORDER BY ordem, codigo
		`, id)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var c models.BalanceteConta
			if err := rows.Scan(&c.ID, &c.BalanceteID, &c.OrgID, &c.Codigo, &c.Descricao, &c.Grupo, &c.SaldoAnterior, &c.Debito, &c.Credito, &c.SaldoAtual, &c.Natureza, &c.Ordem); err != nil {
				return err
			}
			out.Contas = append(out.Contas, c)
		}
		return rows.Err()
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return out, err
}

func (r *Repo) ReplaceBalanceteContas(ctx context.Context, id, orgID uuid.UUID, dto models.ReplaceBalanceteContasDTO) error {
	return r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		var fechado bool
		if err := tx.QueryRow(ctx, `SELECT fechado FROM public.balancetes WHERE id = $1 AND org_id = $2`, id, orgID).Scan(&fechado); err != nil {
			return err
		}
		if fechado {
			return fmt.Errorf("balancete_fechado")
		}
		if _, err := tx.Exec(ctx, `DELETE FROM public.balancete_contas WHERE balancete_id = $1`, id); err != nil {
			return err
		}
		batch := &pgx.Batch{}
		for i, conta := range dto.Contas {
			ordem := conta.Ordem
			if ordem == 0 {
				ordem = i + 1
			}
			batch.Queue(`
				INSERT INTO public.balancete_contas
				    (balancete_id, org_id, codigo, descricao, grupo, saldo_anterior, debito, credito, saldo_atual, natureza, ordem)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
			`, id, orgID, conta.Codigo, conta.Descricao, conta.Grupo, conta.SaldoAnterior, conta.Debito, conta.Credito, conta.SaldoAtual, conta.Natureza, ordem)
		}
		br := tx.SendBatch(ctx, batch)
		if err := br.Close(); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `UPDATE public.balancetes SET updated_at = now() WHERE id = $1`, id)
		return err
	})
}

func (r *Repo) FecharBalancete(ctx context.Context, id, orgID, userID uuid.UUID) (*models.Balancete, error) {
	var b models.Balancete
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			UPDATE public.balancetes b
			SET fechado = TRUE, fechado_em = COALESCE(fechado_em, now()), fechado_por_id = COALESCE(fechado_por_id, $3), updated_at = now()
			WHERE b.id = $1 AND b.org_id = $2
			RETURNING b.id, b.org_id, b.empresa_id,
			          (SELECT razao_social FROM public.empresas WHERE id = b.empresa_id),
			          b.competencia, b.fechado, b.fechado_em, b.fechado_por_id, b.observacoes,
			          (SELECT COUNT(*)::int FROM public.balancete_contas WHERE balancete_id = b.id),
			          b.created_at, b.updated_at
		`, id, orgID, userID).Scan(&b.ID, &b.OrgID, &b.EmpresaID, &b.EmpresaNome, &b.Competencia, &b.Fechado, &b.FechadoEm, &b.FechadoPorID, &b.Observacoes, &b.ContasCount, &b.CreatedAt, &b.UpdatedAt)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &b, err
}

func (r *Repo) GetBalanceteComparativo(ctx context.Context, orgID, empresaID uuid.UUID, competencias []string) (*models.BalanceteComparativo, error) {
	out := &models.BalanceteComparativo{Competencias: competencias, Linhas: []models.BalanceteComparativoLinha{}}
	if len(competencias) == 0 {
		return out, nil
	}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT id, org_id, empresa_id,
			       (SELECT razao_social FROM public.empresas WHERE id = b.empresa_id),
			       competencia, fechado, fechado_em, fechado_por_id, observacoes,
			       (SELECT COUNT(*)::int FROM public.balancete_contas c WHERE c.balancete_id = b.id),
			       created_at, updated_at
			FROM public.balancetes b
			WHERE org_id = $1 AND empresa_id = $2 AND competencia = ANY($3)
			ORDER BY competencia
		`, orgID, empresaID, competencias)
		if err != nil {
			return err
		}
		balanceteIDs := []uuid.UUID{}
		defer rows.Close()
		for rows.Next() {
			var b models.Balancete
			if err := rows.Scan(&b.ID, &b.OrgID, &b.EmpresaID, &b.EmpresaNome, &b.Competencia, &b.Fechado, &b.FechadoEm, &b.FechadoPorID, &b.Observacoes, &b.ContasCount, &b.CreatedAt, &b.UpdatedAt); err != nil {
				return err
			}
			out.Balancetes = append(out.Balancetes, b)
			balanceteIDs = append(balanceteIDs, b.ID)
		}
		if err := rows.Err(); err != nil {
			return err
		}
		if len(balanceteIDs) == 0 {
			return nil
		}
		contas, err := tx.Query(ctx, `
			SELECT b.competencia, c.codigo, c.descricao, c.grupo, c.natureza, c.saldo_atual
			FROM public.balancete_contas c
			JOIN public.balancetes b ON b.id = c.balancete_id
			WHERE c.balancete_id = ANY($1)
			ORDER BY c.ordem, c.codigo
		`, balanceteIDs)
		if err != nil {
			return err
		}
		defer contas.Close()
		byCode := map[string]*models.BalanceteComparativoLinha{}
		order := []string{}
		for contas.Next() {
			var competencia, codigo, descricao string
			var grupo, natureza *string
			var saldo float64
			if err := contas.Scan(&competencia, &codigo, &descricao, &grupo, &natureza, &saldo); err != nil {
				return err
			}
			line, ok := byCode[codigo]
			if !ok {
				line = &models.BalanceteComparativoLinha{Codigo: codigo, Descricao: descricao, Grupo: grupo, Natureza: natureza, Valores: map[string]float64{}}
				byCode[codigo] = line
				order = append(order, codigo)
			}
			line.Valores[competencia] = saldo
		}
		if err := contas.Err(); err != nil {
			return err
		}
		if len(competencias) >= 2 {
			base := competencias[0]
			ref := competencias[len(competencias)-1]
			for _, line := range byCode {
				prev := line.Valores[base]
				curr := line.Valores[ref]
				line.Variacao = curr - prev
				if prev != 0 {
					pct := line.Variacao / absFloat(prev)
					line.VariacaoPerc = &pct
				}
			}
		}
		for _, code := range order {
			out.Linhas = append(out.Linhas, *byCode[code])
		}
		return nil
	})
	return out, err
}

func absFloat(v float64) float64 {
	if v < 0 {
		return -v
	}
	return v
}
