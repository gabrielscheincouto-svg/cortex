package repo

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/cecopel/api/internal/models"
	"github.com/cecopel/api/internal/services"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ─── DECLARANTES ────────────────────────────────────────────────────────────

func (r *Repo) ListIrpfDeclarantes(ctx context.Context, orgID uuid.UUID, busca *string, limit int) (*models.Page[models.IrpfDeclarante], error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	where := []string{"d.org_id = $1"}
	args := []any{orgID}
	if busca != nil && *busca != "" {
		args = append(args, "%"+*busca+"%")
		where = append(where, fmt.Sprintf("(d.nome_completo ILIKE $%d OR d.cpf ILIKE $%d OR d.email ILIKE $%d)", len(args), len(args), len(args)))
	}
	args = append(args, limit)
	limitPos := len(args)
	whereSQL := strings.Join(where, " AND ")

	page := &models.Page[models.IrpfDeclarante]{Limit: limit, Offset: 0}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		countQ := fmt.Sprintf(`SELECT COUNT(*) FROM public.irpf_declarantes d WHERE %s`, whereSQL)
		if err := tx.QueryRow(ctx, countQ, args[:len(args)-1]...).Scan(&page.Total); err != nil {
			return err
		}
		listQ := fmt.Sprintf(`
			SELECT d.id, d.org_id, d.empresa_id, d.cpf, d.nome_completo,
			       d.data_nascimento, d.email, d.telefone, d.observacoes,
			       d.created_at, d.updated_at,
			       (SELECT COUNT(*) FROM public.irpf_declaracoes WHERE declarante_id = d.id)::int
			FROM public.irpf_declarantes d
			WHERE %s
			ORDER BY d.nome_completo
			LIMIT $%d
		`, whereSQL, limitPos)
		rows, err := tx.Query(ctx, listQ, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var d models.IrpfDeclarante
			if err := rows.Scan(&d.ID, &d.OrgID, &d.EmpresaID, &d.CPF, &d.NomeCompleto,
				&d.DataNascimento, &d.Email, &d.Telefone, &d.Observacoes,
				&d.CreatedAt, &d.UpdatedAt, &d.DeclaracoesCount); err != nil {
				return err
			}
			page.Data = append(page.Data, d)
		}
		return rows.Err()
	})
	return page, err
}

func (r *Repo) CreateIrpfDeclarante(ctx context.Context, orgID uuid.UUID, dto models.CreateIrpfDeclaranteDTO) (*models.IrpfDeclarante, error) {
	cpf := digitsOnly(dto.CPF)
	if len(cpf) != 11 {
		return nil, fmt.Errorf("cpf inválido")
	}
	var d models.IrpfDeclarante
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			INSERT INTO public.irpf_declarantes
			    (org_id, empresa_id, cpf, nome_completo, data_nascimento, email, telefone, observacoes)
			VALUES ($1, $2, $3, $4, NULLIF($5,'')::date, $6, $7, $8)
			RETURNING id, org_id, empresa_id, cpf, nome_completo,
			          data_nascimento, email, telefone, observacoes, created_at, updated_at
		`, orgID, dto.EmpresaID, cpf, dto.NomeCompleto,
			derefString(dto.DataNascimento), dto.Email, dto.Telefone, dto.Observacoes,
		).Scan(&d.ID, &d.OrgID, &d.EmpresaID, &d.CPF, &d.NomeCompleto,
			&d.DataNascimento, &d.Email, &d.Telefone, &d.Observacoes,
			&d.CreatedAt, &d.UpdatedAt)
	})
	return &d, err
}

func (r *Repo) UpdateIrpfDeclarante(ctx context.Context, id uuid.UUID, dto models.UpdateIrpfDeclaranteDTO) (*models.IrpfDeclarante, error) {
	var d models.IrpfDeclarante
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			UPDATE public.irpf_declarantes
			SET empresa_id     = COALESCE($2, empresa_id),
			    nome_completo  = COALESCE($3, nome_completo),
			    data_nascimento = COALESCE(NULLIF($4,'')::date, data_nascimento),
			    email          = COALESCE($5, email),
			    telefone       = COALESCE($6, telefone),
			    observacoes    = COALESCE($7, observacoes),
			    updated_at     = now()
			WHERE id = $1
			RETURNING id, org_id, empresa_id, cpf, nome_completo,
			          data_nascimento, email, telefone, observacoes, created_at, updated_at
		`, id, dto.EmpresaID, dto.NomeCompleto, derefString(dto.DataNascimento),
			dto.Email, dto.Telefone, dto.Observacoes,
		).Scan(&d.ID, &d.OrgID, &d.EmpresaID, &d.CPF, &d.NomeCompleto,
			&d.DataNascimento, &d.Email, &d.Telefone, &d.Observacoes,
			&d.CreatedAt, &d.UpdatedAt)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &d, err
}

func (r *Repo) DeleteIrpfDeclarante(ctx context.Context, id uuid.UUID) error {
	return r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		ct, err := tx.Exec(ctx, `DELETE FROM public.irpf_declarantes WHERE id = $1`, id)
		if err != nil {
			return err
		}
		if ct.RowsAffected() == 0 {
			return ErrNotFound
		}
		return nil
	})
}

// ─── DECLARAÇÕES ────────────────────────────────────────────────────────────

func (r *Repo) ListIrpfDeclaracoes(ctx context.Context, orgID uuid.UUID, exercicio *int, status *string, limit int) (*models.Page[models.IrpfDeclaracao], error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	where := []string{"d.org_id = $1"}
	args := []any{orgID}
	if exercicio != nil && *exercicio > 0 {
		args = append(args, *exercicio)
		where = append(where, fmt.Sprintf("d.exercicio = $%d", len(args)))
	}
	if status != nil && *status != "" {
		args = append(args, *status)
		where = append(where, fmt.Sprintf("d.status::text = $%d", len(args)))
	}
	args = append(args, limit)
	limitPos := len(args)
	whereSQL := strings.Join(where, " AND ")

	page := &models.Page[models.IrpfDeclaracao]{Limit: limit, Offset: 0}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx,
			fmt.Sprintf(`SELECT COUNT(*) FROM public.irpf_declaracoes d WHERE %s`, whereSQL),
			args[:len(args)-1]...,
		).Scan(&page.Total); err != nil {
			return err
		}
		listQ := fmt.Sprintf(`
			SELECT d.id, d.org_id, d.declarante_id,
			       de.nome_completo, de.cpf,
			       d.exercicio, d.ano_calendario, d.status::text,
			       d.responsavel_id, p.nome,
			       d.rendimentos_total_cents, d.deducoes_total_cents,
			       d.imposto_devido_cents, d.imposto_retido_cents, d.saldo_cents,
			       d.situacao_final::text, d.recibo_url, d.transmitida_em,
			       d.observacoes, d.created_at, d.updated_at
			FROM public.irpf_declaracoes d
			JOIN public.irpf_declarantes de ON de.id = d.declarante_id
			LEFT JOIN public.profiles p ON p.id = d.responsavel_id
			WHERE %s
			ORDER BY d.exercicio DESC, de.nome_completo
			LIMIT $%d
		`, whereSQL, limitPos)
		rows, err := tx.Query(ctx, listQ, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var d models.IrpfDeclaracao
			if err := rows.Scan(&d.ID, &d.OrgID, &d.DeclaranteID,
				&d.DeclaranteNome, &d.DeclaranteCPF,
				&d.Exercicio, &d.AnoCalendario, &d.Status,
				&d.ResponsavelID, &d.ResponsavelNome,
				&d.RendimentosTotalCents, &d.DeducoesTotalCents,
				&d.ImpostoDevidoCents, &d.ImpostoRetidoCents, &d.SaldoCents,
				&d.SituacaoFinal, &d.ReciboURL, &d.TransmitidaEm,
				&d.Observacoes, &d.CreatedAt, &d.UpdatedAt); err != nil {
				return err
			}
			page.Data = append(page.Data, d)
		}
		return rows.Err()
	})
	return page, err
}

func (r *Repo) CreateIrpfDeclaracao(ctx context.Context, orgID uuid.UUID, dto models.CreateIrpfDeclaracaoDTO) (*models.IrpfDeclaracao, error) {
	var d models.IrpfDeclaracao
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			INSERT INTO public.irpf_declaracoes
			    (org_id, declarante_id, exercicio, ano_calendario, responsavel_id, observacoes)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (declarante_id, exercicio) DO UPDATE SET
			    ano_calendario = EXCLUDED.ano_calendario,
			    responsavel_id = COALESCE(EXCLUDED.responsavel_id, public.irpf_declaracoes.responsavel_id),
			    observacoes    = COALESCE(EXCLUDED.observacoes, public.irpf_declaracoes.observacoes),
			    updated_at = now()
			RETURNING id, org_id, declarante_id,
			          (SELECT nome_completo FROM public.irpf_declarantes WHERE id = declarante_id),
			          (SELECT cpf FROM public.irpf_declarantes WHERE id = declarante_id),
			          exercicio, ano_calendario, status::text, responsavel_id,
			          (SELECT nome FROM public.profiles WHERE id = responsavel_id),
			          rendimentos_total_cents, deducoes_total_cents,
			          imposto_devido_cents, imposto_retido_cents, saldo_cents,
			          situacao_final::text, recibo_url, transmitida_em,
			          observacoes, created_at, updated_at
		`, orgID, dto.DeclaranteID, dto.Exercicio, dto.AnoCalendario,
			dto.ResponsavelID, dto.Observacoes,
		).Scan(&d.ID, &d.OrgID, &d.DeclaranteID, &d.DeclaranteNome, &d.DeclaranteCPF,
			&d.Exercicio, &d.AnoCalendario, &d.Status, &d.ResponsavelID, &d.ResponsavelNome,
			&d.RendimentosTotalCents, &d.DeducoesTotalCents,
			&d.ImpostoDevidoCents, &d.ImpostoRetidoCents, &d.SaldoCents,
			&d.SituacaoFinal, &d.ReciboURL, &d.TransmitidaEm,
			&d.Observacoes, &d.CreatedAt, &d.UpdatedAt)
	})
	return &d, err
}

func (r *Repo) GetIrpfDeclaracao(ctx context.Context, id uuid.UUID) (*models.IrpfDeclaracaoDetalhe, error) {
	det := &models.IrpfDeclaracaoDetalhe{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `
			SELECT d.id, d.org_id, d.declarante_id,
			       de.nome_completo, de.cpf,
			       d.exercicio, d.ano_calendario, d.status::text,
			       d.responsavel_id, p.nome,
			       d.rendimentos_total_cents, d.deducoes_total_cents,
			       d.imposto_devido_cents, d.imposto_retido_cents, d.saldo_cents,
			       d.situacao_final::text, d.recibo_url, d.transmitida_em,
			       d.observacoes, d.created_at, d.updated_at
			FROM public.irpf_declaracoes d
			JOIN public.irpf_declarantes de ON de.id = d.declarante_id
			LEFT JOIN public.profiles p ON p.id = d.responsavel_id
			WHERE d.id = $1
		`, id).Scan(&det.Declaracao.ID, &det.Declaracao.OrgID, &det.Declaracao.DeclaranteID,
			&det.Declaracao.DeclaranteNome, &det.Declaracao.DeclaranteCPF,
			&det.Declaracao.Exercicio, &det.Declaracao.AnoCalendario, &det.Declaracao.Status,
			&det.Declaracao.ResponsavelID, &det.Declaracao.ResponsavelNome,
			&det.Declaracao.RendimentosTotalCents, &det.Declaracao.DeducoesTotalCents,
			&det.Declaracao.ImpostoDevidoCents, &det.Declaracao.ImpostoRetidoCents, &det.Declaracao.SaldoCents,
			&det.Declaracao.SituacaoFinal, &det.Declaracao.ReciboURL, &det.Declaracao.TransmitidaEm,
			&det.Declaracao.Observacoes, &det.Declaracao.CreatedAt, &det.Declaracao.UpdatedAt)
		if err != nil {
			return err
		}

		// declarante
		if err := tx.QueryRow(ctx, `
			SELECT id, org_id, empresa_id, cpf, nome_completo,
			       data_nascimento, email, telefone, observacoes, created_at, updated_at
			FROM public.irpf_declarantes WHERE id = $1
		`, det.Declaracao.DeclaranteID).Scan(&det.Declarante.ID, &det.Declarante.OrgID, &det.Declarante.EmpresaID,
			&det.Declarante.CPF, &det.Declarante.NomeCompleto, &det.Declarante.DataNascimento,
			&det.Declarante.Email, &det.Declarante.Telefone, &det.Declarante.Observacoes,
			&det.Declarante.CreatedAt, &det.Declarante.UpdatedAt); err != nil {
			return err
		}

		// lançamentos
		rows, err := tx.Query(ctx, `
			SELECT id, org_id, declaracao_id, tipo::text, fonte_pagadora, fonte_cnpj,
			       descricao, valor_cents, imposto_retido_cents, documento_url, payload, created_at
			FROM public.irpf_lancamentos
			WHERE declaracao_id = $1
			ORDER BY created_at
		`, id)
		if err != nil {
			return err
		}
		defer rows.Close()
		det.Lancamentos = []models.IrpfLancamento{}
		for rows.Next() {
			var l models.IrpfLancamento
			if err := rows.Scan(&l.ID, &l.OrgID, &l.DeclaracaoID, &l.Tipo, &l.FontePagadora, &l.FonteCNPJ,
				&l.Descricao, &l.ValorCents, &l.ImpostoRetidoCents, &l.DocumentoURL,
				&l.Payload, &l.CreatedAt); err != nil {
				return err
			}
			det.Lancamentos = append(det.Lancamentos, l)
		}
		return rows.Err()
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return det, err
}

func (r *Repo) UpdateIrpfDeclaracao(ctx context.Context, id uuid.UUID, dto models.UpdateIrpfDeclaracaoDTO) (*models.IrpfDeclaracao, error) {
	var d models.IrpfDeclaracao
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			UPDATE public.irpf_declaracoes
			SET status         = COALESCE($2::app.irpf_status, status),
			    responsavel_id = COALESCE($3, responsavel_id),
			    observacoes    = COALESCE($4, observacoes),
			    recibo_url     = COALESCE($5, recibo_url),
			    transmitida_em = CASE WHEN $2 = 'entregue' AND transmitida_em IS NULL THEN now() ELSE transmitida_em END,
			    updated_at     = now()
			WHERE id = $1
			RETURNING id, org_id, declarante_id,
			          (SELECT nome_completo FROM public.irpf_declarantes WHERE id = declarante_id),
			          (SELECT cpf FROM public.irpf_declarantes WHERE id = declarante_id),
			          exercicio, ano_calendario, status::text, responsavel_id,
			          (SELECT nome FROM public.profiles WHERE id = responsavel_id),
			          rendimentos_total_cents, deducoes_total_cents,
			          imposto_devido_cents, imposto_retido_cents, saldo_cents,
			          situacao_final::text, recibo_url, transmitida_em,
			          observacoes, created_at, updated_at
		`, id, dto.Status, dto.ResponsavelID, dto.Observacoes, dto.ReciboURL,
		).Scan(&d.ID, &d.OrgID, &d.DeclaranteID, &d.DeclaranteNome, &d.DeclaranteCPF,
			&d.Exercicio, &d.AnoCalendario, &d.Status, &d.ResponsavelID, &d.ResponsavelNome,
			&d.RendimentosTotalCents, &d.DeducoesTotalCents,
			&d.ImpostoDevidoCents, &d.ImpostoRetidoCents, &d.SaldoCents,
			&d.SituacaoFinal, &d.ReciboURL, &d.TransmitidaEm,
			&d.Observacoes, &d.CreatedAt, &d.UpdatedAt)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &d, err
}

// ─── LANÇAMENTOS ────────────────────────────────────────────────────────────

func (r *Repo) AddIrpfLancamento(ctx context.Context, orgID, declaracaoID uuid.UUID, dto models.CreateIrpfLancamentoDTO) (*models.IrpfLancamento, error) {
	if dto.Payload == nil {
		dto.Payload = map[string]any{}
	}
	var l models.IrpfLancamento
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			INSERT INTO public.irpf_lancamentos
			    (org_id, declaracao_id, tipo, fonte_pagadora, fonte_cnpj, descricao,
			     valor_cents, imposto_retido_cents, documento_url, payload)
			VALUES ($1, $2, $3::app.irpf_lancamento_tipo, $4, $5, $6, $7, $8, $9, $10)
			RETURNING id, org_id, declaracao_id, tipo::text, fonte_pagadora, fonte_cnpj,
			          descricao, valor_cents, imposto_retido_cents, documento_url, payload, created_at
		`, orgID, declaracaoID, dto.Tipo, dto.FontePagadora, dto.FonteCNPJ, dto.Descricao,
			dto.ValorCents, dto.ImpostoRetidoCents, dto.DocumentoURL, dto.Payload,
		).Scan(&l.ID, &l.OrgID, &l.DeclaracaoID, &l.Tipo, &l.FontePagadora, &l.FonteCNPJ,
			&l.Descricao, &l.ValorCents, &l.ImpostoRetidoCents, &l.DocumentoURL,
			&l.Payload, &l.CreatedAt)
	})
	return &l, err
}

func (r *Repo) DeleteIrpfLancamento(ctx context.Context, id uuid.UUID) error {
	return r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		ct, err := tx.Exec(ctx, `DELETE FROM public.irpf_lancamentos WHERE id = $1`, id)
		if err != nil {
			return err
		}
		if ct.RowsAffected() == 0 {
			return ErrNotFound
		}
		return nil
	})
}

// ─── CÁLCULO ───────────────────────────────────────────────────────────────

// RecalcularIrpfDeclaracao soma os lançamentos da declaração, classifica em rendimentos
// vs deduções, conta dependentes (que aplicam dedução padrão pela tabela do ano-calendário),
// invoca services.CalcularImpostoIRPF e persiste o resultado na declaração.
func (r *Repo) RecalcularIrpfDeclaracao(ctx context.Context, id uuid.UUID) (*models.IrpfDeclaracao, error) {
	var d models.IrpfDeclaracao
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		// Lê ano_calendario para escolher tabela correta
		var anoCalendario int
		if err := tx.QueryRow(ctx, `SELECT ano_calendario FROM public.irpf_declaracoes WHERE id = $1`, id).Scan(&anoCalendario); err != nil {
			return err
		}

		// Agrega lançamentos
		var (
			rendimentos      int64
			deducoes         int64
			impostoRetido    int64
			qtdDependentes   int64
		)
		rows, err := tx.Query(ctx, `
			SELECT tipo::text, COALESCE(SUM(valor_cents),0)::bigint,
			       COALESCE(SUM(imposto_retido_cents),0)::bigint,
			       COUNT(*)::bigint
			FROM public.irpf_lancamentos
			WHERE declaracao_id = $1
			GROUP BY tipo
		`, id)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var tipo string
			var soma, retido, qtd int64
			if err := rows.Scan(&tipo, &soma, &retido, &qtd); err != nil {
				return err
			}
			impostoRetido += retido
			switch tipo {
			case "rendimento_tributavel":
				rendimentos += soma
			case "deducao_medica", "deducao_educacao", "deducao_previdencia", "deducao_pensao":
				deducoes += soma
			case "dependente":
				qtdDependentes += qtd
			}
		}
		// Dependentes: cada dependente tem dedução padrão por ano-calendário
		deducoes += qtdDependentes * services.DeducaoDependenteCents(anoCalendario)

		res := services.CalcularImpostoIRPF(rendimentos, deducoes, impostoRetido, anoCalendario)

		return tx.QueryRow(ctx, `
			UPDATE public.irpf_declaracoes
			SET rendimentos_total_cents = $2,
			    deducoes_total_cents    = $3,
			    imposto_devido_cents    = $4,
			    imposto_retido_cents    = $5,
			    saldo_cents             = $6,
			    situacao_final          = $7::app.irpf_situacao_final,
			    updated_at              = now()
			WHERE id = $1
			RETURNING id, org_id, declarante_id,
			          (SELECT nome_completo FROM public.irpf_declarantes WHERE id = declarante_id),
			          (SELECT cpf FROM public.irpf_declarantes WHERE id = declarante_id),
			          exercicio, ano_calendario, status::text, responsavel_id,
			          (SELECT nome FROM public.profiles WHERE id = responsavel_id),
			          rendimentos_total_cents, deducoes_total_cents,
			          imposto_devido_cents, imposto_retido_cents, saldo_cents,
			          situacao_final::text, recibo_url, transmitida_em,
			          observacoes, created_at, updated_at
		`, id, res.RendimentosTotalCents, res.DeducoesTotalCents,
			res.ImpostoDevidoCents, res.ImpostoRetidoCents, res.SaldoCents, res.SituacaoFinal,
		).Scan(&d.ID, &d.OrgID, &d.DeclaranteID, &d.DeclaranteNome, &d.DeclaranteCPF,
			&d.Exercicio, &d.AnoCalendario, &d.Status, &d.ResponsavelID, &d.ResponsavelNome,
			&d.RendimentosTotalCents, &d.DeducoesTotalCents,
			&d.ImpostoDevidoCents, &d.ImpostoRetidoCents, &d.SaldoCents,
			&d.SituacaoFinal, &d.ReciboURL, &d.TransmitidaEm,
			&d.Observacoes, &d.CreatedAt, &d.UpdatedAt)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &d, err
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────

func (r *Repo) IrpfDashboard(ctx context.Context, orgID uuid.UUID, exercicio int) (*models.IrpfDashboard, error) {
	dash := &models.IrpfDashboard{Exercicio: exercicio}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			SELECT
			    COUNT(*)::int                                                                  AS total,
			    COUNT(*) FILTER (WHERE status = 'a_iniciar')::int                              AS a_iniciar,
			    COUNT(*) FILTER (WHERE status = 'coletando')::int                              AS coletando,
			    COUNT(*) FILTER (WHERE status = 'em_processamento')::int                       AS em_processamento,
			    COUNT(*) FILTER (WHERE status = 'aguardando_cliente')::int                     AS aguardando_cliente,
			    COUNT(*) FILTER (WHERE status = 'entregue')::int                               AS entregues,
			    COUNT(*) FILTER (WHERE status = 'em_malha')::int                               AS em_malha,
			    COUNT(*) FILTER (WHERE status = 'retificada')::int                             AS retificadas,
			    COUNT(*) FILTER (WHERE status = 'cancelada')::int                              AS canceladas,
			    COALESCE(SUM(CASE WHEN saldo_cents < 0 THEN -saldo_cents ELSE 0 END),0)::bigint AS total_a_restituir,
			    COALESCE(SUM(CASE WHEN saldo_cents > 0 THEN saldo_cents ELSE 0 END),0)::bigint  AS total_a_pagar,
			    COALESCE(SUM(imposto_retido_cents),0)::bigint                                  AS total_retido
			FROM public.irpf_declaracoes
			WHERE org_id = $1 AND exercicio = $2
		`, orgID, exercicio).Scan(&dash.Total, &dash.AIniciar, &dash.Coletando,
			&dash.EmProcessamento, &dash.AguardandoCliente, &dash.Entregues,
			&dash.EmMalha, &dash.Retificadas, &dash.Canceladas,
			&dash.TotalARestituirCents, &dash.TotalAPagarCents, &dash.TotalImpostoRetidoCents)
	})
	return dash, err
}

// ─── helpers ───────────────────────────────────────────────────────────────

func digitsOnly(s string) string {
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			out = append(out, s[i])
		}
	}
	return string(out)
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
