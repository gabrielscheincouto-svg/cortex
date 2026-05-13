package repo

import (
	"context"
	"errors"

	"github.com/cecopel/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Repo) ListOrgDepartamentos(ctx context.Context, orgID uuid.UUID) ([]models.OrgDepartamento, error) {
	var out []models.OrgDepartamento
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT d.id, d.org_id, d.codigo::text, d.nome, d.gerente_id, p.nome,
			       d.meta_perc_no_prazo::float8, d.meta_dias_antecedencia,
			       d.premiacao_modo::text, d.descricao
			FROM public.org_departamentos d
			LEFT JOIN public.profiles p ON p.id = d.gerente_id
			WHERE d.org_id = $1
			ORDER BY array_position(ARRAY['contabil','fiscal','pessoal','societario','comercial'], d.codigo::text)
		`, orgID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var d models.OrgDepartamento
			if err := rows.Scan(
				&d.ID, &d.OrgID, &d.Codigo, &d.Nome, &d.GerenteID, &d.GerenteNome,
				&d.MetaPercNoPrazo, &d.MetaDiasAntecedencia, &d.PremiacaoModo, &d.Descricao,
			); err != nil {
				return err
			}
			out = append(out, d)
		}
		return rows.Err()
	})
	return out, err
}

func (r *Repo) UpdateOrgDepartamento(ctx context.Context, orgID uuid.UUID, codigo string, dto models.UpdateOrgDepartamentoDTO) (*models.OrgDepartamento, error) {
	dept := &models.OrgDepartamento{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			UPDATE public.org_departamentos
			SET premiacao_modo = COALESCE($3::app.premiacao_modo, premiacao_modo),
			    meta_perc_no_prazo = COALESCE($4, meta_perc_no_prazo),
			    meta_dias_antecedencia = COALESCE($5, meta_dias_antecedencia),
			    gerente_id = COALESCE($6, gerente_id),
			    updated_at = now()
			WHERE org_id = $1 AND codigo = $2::app.departamento
			RETURNING id, org_id, codigo::text, nome, gerente_id, NULL::text,
			          meta_perc_no_prazo::float8, meta_dias_antecedencia, premiacao_modo::text, descricao
		`, orgID, codigo, dto.PremiacaoModo, dto.MetaPercNoPrazo, dto.MetaDiasAntecedencia, dto.GerenteID).Scan(
			&dept.ID, &dept.OrgID, &dept.Codigo, &dept.Nome, &dept.GerenteID, &dept.GerenteNome,
			&dept.MetaPercNoPrazo, &dept.MetaDiasAntecedencia, &dept.PremiacaoModo, &dept.Descricao,
		)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return dept, err
}

func (r *Repo) CreateLancamentoManualPontos(ctx context.Context, orgID, criadoPor uuid.UUID, dto models.LancamentoManualPontosDTO) (*models.PontosEvento, error) {
	ev := &models.PontosEvento{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			INSERT INTO public.pontos_eventos
			    (org_id, user_id, evento, pontos, referencia_tipo, referencia_id, justificativa, criado_por_id)
			VALUES ($1, $2, COALESCE(NULLIF($3, ''), 'ajuste_manual')::app.evento_pontos,
			        $4, COALESCE($5, 'manual'), $6, $7, $8)
			RETURNING id, org_id, user_id, evento::text, pontos, referencia_tipo, referencia_id,
			          justificativa, criado_por_id, created_at
		`, orgID, dto.UserID, dto.Evento, dto.Pontos, dto.ReferenciaTipo, dto.ReferenciaID, dto.Justificativa, criadoPor).Scan(
			&ev.ID, &ev.OrgID, &ev.UserID, &ev.Evento, &ev.Pontos, &ev.ReferenciaTipo, &ev.ReferenciaID,
			&ev.Justificativa, &ev.CriadoPorID, &ev.CreatedAt,
		)
	})
	return ev, err
}
