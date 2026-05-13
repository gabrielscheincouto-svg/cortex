// Package repo encapsula acesso a dados via pgx.
//
// Todos os métodos recebem context.Context (que carrega o TenantCtx).
// As queries SQL são puras — o isolamento por org_id vem das policies RLS do banco,
// que leem app.current_user_id / app.current_org_id setadas pelo middleware.
package repo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/cecopel/api/internal/db"
	"github.com/cecopel/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Errors públicos.
var (
	ErrNotFound = errors.New("not_found")
	ErrConflict = errors.New("conflict")
)

type Repo struct {
	DB *db.DB
}

func New(database *db.DB) *Repo {
	return &Repo{DB: database}
}

// ─── PROFILES ───────────────────────────────────────────────────────────────

func (r *Repo) GetProfile(ctx context.Context, userID uuid.UUID) (*models.Profile, error) {
	const q = `
		SELECT id, nome, email, avatar_url, telefone, is_super_admin, current_org_id, created_at
		FROM public.profiles
		WHERE id = $1
	`
	p := &models.Profile{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, q, userID).Scan(
			&p.ID, &p.Nome, &p.Email, &p.AvatarURL, &p.Telefone,
			&p.IsSuperAdmin, &p.CurrentOrgID, &p.CreatedAt,
		)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return p, err
}

func (r *Repo) SetCurrentOrg(ctx context.Context, userID, orgID uuid.UUID) error {
	const q = `UPDATE public.profiles SET current_org_id = $2, updated_at = now() WHERE id = $1`
	return r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, q, userID, orgID)
		return err
	})
}

// ─── ORGS ───────────────────────────────────────────────────────────────────

// ListMyOrgs retorna todas as orgs em que o user logado é membro ativo.
func (r *Repo) ListMyOrgs(ctx context.Context, userID uuid.UUID) ([]models.OrgComMembro, error) {
	const q = `
		SELECT o.id, o.slug, o.nome, o.cnpj, o.razao_social, o.cidade, o.estado, o.telefone,
		       o.email_contato, o.logo_url, o.cor_primaria, o.plano_id, o.status::text,
		       o.trial_ends_at, o.onboarding_completo, o.created_at,
		       m.role::text
		FROM public.orgs o
		JOIN public.org_membros m ON m.org_id = o.id
		WHERE m.user_id = $1 AND m.status = 'ativo'
		ORDER BY o.nome
	`
	var out []models.OrgComMembro
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, q, userID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var o models.OrgComMembro
			if err := rows.Scan(
				&o.ID, &o.Slug, &o.Nome, &o.CNPJ, &o.RazaoSocial, &o.Cidade, &o.Estado, &o.Telefone,
				&o.EmailContato, &o.LogoURL, &o.CorPrimaria, &o.PlanoID, &o.Status,
				&o.TrialEndsAt, &o.OnboardingCompleto, &o.CreatedAt, &o.MyRole,
			); err != nil {
				return err
			}
			out = append(out, o)
		}
		return rows.Err()
	})
	return out, err
}

// CreateOrg cria uma nova org (escritório) e adiciona o user logado como admin.
func (r *Repo) CreateOrg(ctx context.Context, userID uuid.UUID, dto models.CreateOrgDTO) (*models.Org, error) {
	o := &models.Org{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		// busca o plano pelo código
		var planoID uuid.UUID
		if err := tx.QueryRow(ctx, `SELECT id FROM public.planos WHERE codigo = $1`, dto.PlanoCodigo).Scan(&planoID); err != nil {
			return fmt.Errorf("plano não encontrado: %w", err)
		}

		// cria a org
		err := tx.QueryRow(ctx, `
			INSERT INTO public.orgs (slug, nome, cnpj, razao_social, plano_id, criada_por, status)
			VALUES ($1, $2, $3, $4, $5, $6, 'trial')
			RETURNING id, slug, nome, cnpj, razao_social, cidade, estado, telefone, email_contato,
			          logo_url, cor_primaria, plano_id, status::text, trial_ends_at, onboarding_completo, created_at
		`, dto.Slug, dto.Nome, dto.CNPJ, dto.RazaoSocial, planoID, userID).Scan(
			&o.ID, &o.Slug, &o.Nome, &o.CNPJ, &o.RazaoSocial, &o.Cidade, &o.Estado, &o.Telefone,
			&o.EmailContato, &o.LogoURL, &o.CorPrimaria, &o.PlanoID, &o.Status, &o.TrialEndsAt,
			&o.OnboardingCompleto, &o.CreatedAt,
		)
		if err != nil {
			return err
		}

		// adiciona como admin
		_, err = tx.Exec(ctx, `
			INSERT INTO public.org_membros (org_id, user_id, role, status, aceito_em)
			VALUES ($1, $2, 'admin', 'ativo', now())
		`, o.ID, userID)
		if err != nil {
			return err
		}

		// define como org atual do user
		_, err = tx.Exec(ctx, `UPDATE public.profiles SET current_org_id = $2 WHERE id = $1`, userID, o.ID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return o, nil
}

// ─── EMPRESAS ───────────────────────────────────────────────────────────────

func (r *Repo) ListEmpresas(ctx context.Context, busca *string, limit, offset int) (*models.Page[models.Empresa], error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	whereBusca := ""
	args := []any{limit, offset}
	if busca != nil && *busca != "" {
		whereBusca = "AND (razao_social ILIKE '%' || $3 || '%' OR nome_fantasia ILIKE '%' || $3 || '%' OR cnpj LIKE '%' || $3 || '%')"
		args = append(args, *busca)
	}

	listQ := fmt.Sprintf(`
		SELECT id, org_id, codigo_interno, razao_social, nome_fantasia, cnpj, cpf,
		       regime_tributario::text, cidade, estado, email, telefone,
		       honorario_mensal_cents, status::text, tags, created_at
		FROM public.empresas
		WHERE status != 'baixada' %s
		ORDER BY razao_social
		LIMIT $1 OFFSET $2
	`, whereBusca)
	countQ := fmt.Sprintf(`SELECT COUNT(*) FROM public.empresas WHERE status != 'baixada' %s`, whereBusca)

	page := &models.Page[models.Empresa]{Limit: limit, Offset: offset}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		// total
		countArgs := []any{}
		if busca != nil && *busca != "" {
			countArgs = append(countArgs, *busca)
			countQ = fmt.Sprintf(`SELECT COUNT(*) FROM public.empresas WHERE status != 'baixada' AND (razao_social ILIKE '%%' || $1 || '%%' OR nome_fantasia ILIKE '%%' || $1 || '%%' OR cnpj LIKE '%%' || $1 || '%%')`)
		}
		if err := tx.QueryRow(ctx, countQ, countArgs...).Scan(&page.Total); err != nil {
			return err
		}
		// data
		rows, err := tx.Query(ctx, listQ, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var e models.Empresa
			if err := rows.Scan(
				&e.ID, &e.OrgID, &e.CodigoInterno, &e.RazaoSocial, &e.NomeFantasia, &e.CNPJ, &e.CPF,
				&e.RegimeTributario, &e.Cidade, &e.Estado, &e.Email, &e.Telefone,
				&e.HonorarioMensalCents, &e.Status, &e.Tags, &e.CreatedAt,
			); err != nil {
				return err
			}
			page.Data = append(page.Data, e)
		}
		return rows.Err()
	})
	return page, err
}

func (r *Repo) CreateEmpresa(ctx context.Context, orgID uuid.UUID, dto models.CreateEmpresaDTO) (*models.Empresa, error) {
	if dto.Tags == nil {
		dto.Tags = []string{}
	}
	e := &models.Empresa{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			INSERT INTO public.empresas
			    (org_id, razao_social, nome_fantasia, cnpj, cpf, codigo_interno,
			     regime_tributario, cidade, estado, email, telefone, honorario_mensal_cents, tags)
			VALUES ($1,$2,$3,$4,$5,$6,$7::app.regime_tributario,$8,$9,$10,$11,$12,$13)
			RETURNING id, org_id, codigo_interno, razao_social, nome_fantasia, cnpj, cpf,
			          regime_tributario::text, cidade, estado, email, telefone,
			          honorario_mensal_cents, status::text, tags, created_at
		`,
			orgID, dto.RazaoSocial, dto.NomeFantasia, dto.CNPJ, dto.CPF, dto.CodigoInterno,
			dto.RegimeTributario, dto.Cidade, dto.Estado, dto.Email, dto.Telefone,
			dto.HonorarioMensalCents, dto.Tags,
		).Scan(
			&e.ID, &e.OrgID, &e.CodigoInterno, &e.RazaoSocial, &e.NomeFantasia, &e.CNPJ, &e.CPF,
			&e.RegimeTributario, &e.Cidade, &e.Estado, &e.Email, &e.Telefone,
			&e.HonorarioMensalCents, &e.Status, &e.Tags, &e.CreatedAt,
		)
	})
	return e, err
}

// ─── ENTREGAS ───────────────────────────────────────────────────────────────

// ListEntregas com filtros úteis para o dashboard de prazos e a lista do dia.
func (r *Repo) ListEntregas(ctx context.Context, f models.EntregaListFilter) (*models.Page[models.Entrega], error) {
	if f.Limit <= 0 || f.Limit > 500 {
		f.Limit = 100
	}

	where := []string{"1=1"}
	args := []any{f.Limit, f.Offset}
	add := func(sql string, val any) {
		args = append(args, val)
		where = append(where, fmt.Sprintf("%s $%d", sql, len(args)))
	}

	if len(f.Status) > 0 {
		add("status::text = ANY(", f.Status)
		where[len(where)-1] += ")"
	}
	if f.Departamento != nil {
		add("departamento::text =", *f.Departamento)
	}
	if f.ResponsavelID != nil {
		add("responsavel_id =", *f.ResponsavelID)
	}
	if f.CoResponsavelID != nil {
		add("co_responsavel_id =", *f.CoResponsavelID)
	}
	if f.EmpresaID != nil {
		add("empresa_id =", *f.EmpresaID)
	}
	if f.Competencia != nil {
		add("competencia =", *f.Competencia)
	}
	if f.PrazoDe != nil {
		add("prazo_legal >=", *f.PrazoDe)
	}
	if f.PrazoAte != nil {
		add("prazo_legal <=", *f.PrazoAte)
	}

	listQ := fmt.Sprintf(`
		SELECT e.id, e.org_id, e.obrigacao_empresa_id, e.empresa_id, e.obrigacao_id,
		       e.departamento::text, e.competencia, e.prazo_legal, e.prazo_tecnico,
		       e.status::text, e.responsavel_id, e.co_responsavel_id, e.entregue_em, e.protocolo,
		       e.multa_aplicada, e.multa_valor_cents, e.observacoes, e.created_at,
		       emp.razao_social, oc.nome, p.nome, cp.nome
		FROM public.entregas e
		LEFT JOIN public.empresas emp           ON emp.id = e.empresa_id
		LEFT JOIN public.obrigacoes_catalogo oc ON oc.id  = e.obrigacao_id
		LEFT JOIN public.profiles p             ON p.id   = e.responsavel_id
		LEFT JOIN public.profiles cp            ON cp.id  = e.co_responsavel_id
		WHERE %s
		ORDER BY e.prazo_legal, e.created_at
		LIMIT $1 OFFSET $2
	`, joinAnd(where))

	page := &models.Page[models.Entrega]{Limit: f.Limit, Offset: f.Offset}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, listQ, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var e models.Entrega
			if err := rows.Scan(
				&e.ID, &e.OrgID, &e.ObrigacaoEmpresaID, &e.EmpresaID, &e.ObrigacaoID,
				&e.Departamento, &e.Competencia, &e.PrazoLegal, &e.PrazoTecnico,
				&e.Status, &e.ResponsavelID, &e.CoResponsavelID, &e.EntregueEm, &e.Protocolo,
				&e.MultaAplicada, &e.MultaValorCents, &e.Observacoes, &e.CreatedAt,
				&e.EmpresaRazaoSocial, &e.ObrigacaoNome, &e.ResponsavelNome, &e.CoResponsavelNome,
			); err != nil {
				return err
			}
			page.Data = append(page.Data, e)
		}
		return rows.Err()
	})
	return page, err
}

func (r *Repo) UpdateEntregaStatus(ctx context.Context, entregaID uuid.UUID, userID uuid.UUID, dto models.UpdateEntregaStatusDTO) (*models.Entrega, error) {
	e := &models.Entrega{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		const q = `
			UPDATE public.entregas
			SET status = $2::app.entrega_status,
			    protocolo = COALESCE($3, protocolo),
			    observacoes = COALESCE($4, observacoes),
			    justificativa = COALESCE($5, justificativa),
			    co_responsavel_id = COALESCE($7, co_responsavel_id),
			    entregue_em = CASE WHEN $2 = 'entregue' THEN now() ELSE entregue_em END,
			    entregue_por_id = CASE WHEN $2 = 'entregue' THEN $6 ELSE entregue_por_id END,
			    updated_at = now()
			WHERE id = $1
			RETURNING id, org_id, obrigacao_empresa_id, empresa_id, obrigacao_id,
			          departamento::text, competencia, prazo_legal, prazo_tecnico,
			          status::text, responsavel_id, co_responsavel_id, entregue_em, protocolo,
			          multa_aplicada, multa_valor_cents, observacoes, created_at
		`
		return tx.QueryRow(ctx, q,
			entregaID, dto.Status, dto.Protocolo, dto.Observacoes, dto.Justificativa, userID, dto.CoResponsavelID,
		).Scan(
			&e.ID, &e.OrgID, &e.ObrigacaoEmpresaID, &e.EmpresaID, &e.ObrigacaoID,
			&e.Departamento, &e.Competencia, &e.PrazoLegal, &e.PrazoTecnico,
			&e.Status, &e.ResponsavelID, &e.CoResponsavelID, &e.EntregueEm, &e.Protocolo,
			&e.MultaAplicada, &e.MultaValorCents, &e.Observacoes, &e.CreatedAt,
		)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return e, err
}

// ─── CHAT ──────────────────────────────────────────────────────────────────

// MarcarChatLido seta `ultima_leitura_at` = now() para o user atual no canal.
// Se o user não é membro, faz nada — silenciosamente.
func (r *Repo) MarcarChatLido(ctx context.Context, orgID, canalID, userID uuid.UUID) error {
	return r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			UPDATE public.chat_membros
			SET ultima_leitura_at = now()
			WHERE org_id = $1 AND canal_id = $2 AND user_id = $3
		`, orgID, canalID, userID)
		return err
	})
}

func (r *Repo) CreateChatMensagem(ctx context.Context, orgID, canalID, userID uuid.UUID, dto models.CreateChatMensagemDTO) (*models.ChatMensagem, error) {
	if dto.Mencoes == nil {
		dto.Mencoes = []uuid.UUID{}
	}

	msg := &models.ChatMensagem{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		var autorNome *string
		if err := tx.QueryRow(ctx, `SELECT NULLIF(nome, '') FROM public.profiles WHERE id = $1`, userID).Scan(&autorNome); err != nil {
			return err
		}

		const insertQ = `
			INSERT INTO public.chat_mensagens (org_id, canal_id, autor_id, autor_nome, conteudo, mencoes, replied_to_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING id, org_id, canal_id, autor_id, autor_nome, conteudo, mencoes, replied_to_id, criada_em
		`
		if err := tx.QueryRow(ctx, insertQ,
			orgID, canalID, userID, autorNome, dto.Conteudo, dto.Mencoes, dto.RepliedToID,
		).Scan(
			&msg.ID, &msg.OrgID, &msg.CanalID, &msg.AutorID, &msg.AutorNome,
			&msg.Conteudo, &msg.Mencoes, &msg.RepliedToID, &msg.CriadaEm,
		); err != nil {
			return err
		}

		return nil
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return msg, nil
}

// ─── SOLICITAÇÕES ──────────────────────────────────────────────────────────

func (r *Repo) UpdateSolicitacao(ctx context.Context, solicitacaoID uuid.UUID, dto models.UpdateSolicitacaoDTO) (*models.Solicitacao, error) {
	s := &models.Solicitacao{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		const q = `
			UPDATE public.solicitacoes
			SET status = COALESCE($2::app.solicitacao_status, status),
			    responsavel_id = COALESCE($3, responsavel_id),
			    prioridade = COALESCE($4::app.solicitacao_prioridade, prioridade),
			    atribuida_em = CASE WHEN $3 IS NOT NULL THEN now() ELSE atribuida_em END,
			    resolvida_em = CASE WHEN $2::text = 'resolvida' AND resolvida_em IS NULL THEN now() ELSE resolvida_em END,
			    fechada_em = CASE WHEN $2::text = 'fechada' AND fechada_em IS NULL THEN now() ELSE fechada_em END,
			    updated_at = now()
			WHERE id = $1
			RETURNING id, org_id, empresa_id, entrega_id, assunto, descricao,
			          prioridade::text, status::text, responsavel_id, resolvida_em, fechada_em, updated_at
		`
		return tx.QueryRow(ctx, q, solicitacaoID, dto.Status, dto.ResponsavelID, dto.Prioridade).Scan(
			&s.ID, &s.OrgID, &s.EmpresaID, &s.EntregaID, &s.Assunto, &s.Descricao,
			&s.Prioridade, &s.Status, &s.ResponsavelID, &s.ResolvidaEm, &s.FechadaEm, &s.UpdatedAt,
		)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return s, err
}

func (r *Repo) CreateSolicitacaoMensagem(ctx context.Context, orgID, solicitacaoID, userID uuid.UUID, dto models.CreateSolicitacaoMensagemDTO) (*models.SolicitacaoMensagem, error) {
	msg := &models.SolicitacaoMensagem{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		var exists bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM public.solicitacoes WHERE id = $1 AND org_id = $2
			)
		`, solicitacaoID, orgID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return pgx.ErrNoRows
		}

		var autorNome *string
		if err := tx.QueryRow(ctx, `SELECT NULLIF(nome, '') FROM public.profiles WHERE id = $1`, userID).Scan(&autorNome); err != nil {
			return err
		}

		const q = `
			INSERT INTO public.solicitacao_mensagens
			    (org_id, solicitacao_id, autor_id, autor_tipo, autor_nome, conteudo, interna)
			VALUES ($1, $2, $3, 'escritorio', $4, $5, $6)
			RETURNING id, org_id, solicitacao_id, autor_id, autor_tipo, autor_nome, conteudo, interna, criado_em
		`
		if err := tx.QueryRow(ctx, q, orgID, solicitacaoID, userID, autorNome, dto.Conteudo, dto.Interna).Scan(
			&msg.ID, &msg.OrgID, &msg.SolicitacaoID, &msg.AutorID, &msg.AutorTipo,
			&msg.AutorNome, &msg.Conteudo, &msg.Interna, &msg.CriadoEm,
		); err != nil {
			return err
		}

		_, err := tx.Exec(ctx, `
			UPDATE public.solicitacoes
			SET primeira_resposta_em = CASE WHEN primeira_resposta_em IS NULL AND $3 = false THEN now() ELSE primeira_resposta_em END,
			    updated_at = now()
			WHERE id = $1 AND org_id = $2
		`, solicitacaoID, orgID, dto.Interna)
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return msg, nil
}

// ─── OBRIGAÇÕES ────────────────────────────────────────────────────────────

func (r *Repo) HerdarObrigacao(ctx context.Context, orgID, obrigacaoID uuid.UUID) (*models.ObrigacaoCatalogo, error) {
	obr := &models.ObrigacaoCatalogo{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		const q = `
			INSERT INTO public.obrigacoes_catalogo (
				org_id, codigo, nome, departamento, periodicidade, referencia_dia, dia_legal,
				dias_antes_lembrete, competencia_offset, multa_estimada_cents, tempo_estimado_minutos,
				robo_processa, regex_arquivo, parser_tipo, descricao, base_legal, icone, ativa, publicada
			)
			SELECT $1, codigo, nome, departamento, periodicidade, referencia_dia, dia_legal,
			       dias_antes_lembrete, competencia_offset, multa_estimada_cents, tempo_estimado_minutos,
			       robo_processa, regex_arquivo, parser_tipo, descricao, base_legal, icone, true, true
			FROM public.obrigacoes_catalogo
			WHERE id = $2 AND org_id IS NULL AND publicada = true
			ON CONFLICT (org_id, codigo) DO UPDATE SET ativa = true, publicada = true, updated_at = now()
			RETURNING id, org_id, codigo::text, nome, departamento::text, periodicidade::text, referencia_dia::text,
			          dia_legal, ativa, publicada
		`
		return tx.QueryRow(ctx, q, orgID, obrigacaoID).Scan(
			&obr.ID, &obr.OrgID, &obr.Codigo, &obr.Nome, &obr.Departamento, &obr.Periodicidade,
			&obr.ReferenciaDia, &obr.DiaLegal, &obr.Ativa, &obr.Publicada,
		)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return obr, err
}

func (r *Repo) CreateObrigacaoEmpresa(ctx context.Context, orgID uuid.UUID, dto models.CreateObrigacaoEmpresaDTO) (*models.ObrigacaoEmpresa, error) {
	v := &models.ObrigacaoEmpresa{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		const q = `
			INSERT INTO public.obrigacao_empresa (org_id, obrigacao_id, empresa_id, responsavel_id)
			VALUES ($1, $2, $3, $4)
			RETURNING id, org_id, obrigacao_id, empresa_id, responsavel_id, ativa
		`
		return tx.QueryRow(ctx, q, orgID, dto.ObrigacaoID, dto.EmpresaID, dto.ResponsavelID).Scan(
			&v.ID, &v.OrgID, &v.ObrigacaoID, &v.EmpresaID, &v.ResponsavelID, &v.Ativa,
		)
	})
	if err != nil && (errors.Is(err, pgx.ErrNoRows) || pgErrCode(err) == "23503") {
		return nil, ErrNotFound
	}
	if pgErrCode(err) == "23505" {
		return nil, ErrConflict
	}
	return v, err
}

func (r *Repo) DeleteObrigacaoEmpresa(ctx context.Context, id uuid.UUID) error {
	var rows int64
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `DELETE FROM public.obrigacao_empresa WHERE id = $1`, id)
		rows = tag.RowsAffected()
		return err
	})
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// ─── CONFIGURAÇÕES DA ORG ─────────────────────────────────────────────────

func (r *Repo) ConvidarOrgMembro(ctx context.Context, orgID, convidadoPor uuid.UUID, dto models.ConvidarMembroDTO) (*models.OrgMembro, error) {
	m := &models.OrgMembro{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		var targetID uuid.UUID
		if err := tx.QueryRow(ctx, `SELECT id FROM public.profiles WHERE email = $1`, dto.Email).Scan(&targetID); err != nil {
			return err
		}
		const q = `
			INSERT INTO public.org_membros (org_id, user_id, role, convidado_por, convite_token, convite_expira_at, status)
			VALUES ($1, $2, $3::app.org_membro_role, $4, $5, now() + interval '7 days', 'ativo')
			ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'ativo', updated_at = now()
			RETURNING id, org_id, user_id, role::text, status::text
		`
		return tx.QueryRow(ctx, q, orgID, targetID, dto.Role, convidadoPor, uuid.NewString()).Scan(&m.ID, &m.OrgID, &m.UserID, &m.Role, &m.Status)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return m, err
}

func (r *Repo) UpdateOrgMembro(ctx context.Context, membroID uuid.UUID, dto models.UpdateMembroDTO) (*models.OrgMembro, error) {
	m := &models.OrgMembro{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		const q = `
			UPDATE public.org_membros
			SET role = COALESCE($2::app.org_membro_role, role), updated_at = now()
			WHERE id = $1
			RETURNING id, org_id, user_id, role::text, status::text
		`
		return tx.QueryRow(ctx, q, membroID, dto.Role).Scan(&m.ID, &m.OrgID, &m.UserID, &m.Role, &m.Status)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return m, err
}

func (r *Repo) DeleteOrgMembro(ctx context.Context, membroID uuid.UUID) error {
	var rows int64
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `UPDATE public.org_membros SET status = 'inativo', updated_at = now() WHERE id = $1`, membroID)
		rows = tag.RowsAffected()
		return err
	})
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) UpdateOrgConfiguracoes(ctx context.Context, orgID uuid.UUID, dto models.UpdateOrgConfiguracoesDTO) (*models.OrgConfiguracoes, error) {
	cfg := &models.OrgConfiguracoes{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		const q = `
			UPDATE public.orgs
			SET cor_primaria = COALESCE($2, cor_primaria),
			    logo_url = COALESCE($3, logo_url),
			    updated_at = now()
			WHERE id = $1
			RETURNING id, cor_primaria, logo_url
		`
		return tx.QueryRow(ctx, q, orgID, dto.CorPrimaria, dto.LogoURL).Scan(&cfg.ID, &cfg.CorPrimaria, &cfg.LogoURL)
	})
	return cfg, err
}

// ─── UPLOADS ASSINADOS ────────────────────────────────────────────────────

func (r *Repo) GetPlanoCodigoEUsoStorage(ctx context.Context, orgID uuid.UUID) (string, int64, error) {
	var planoCodigo string
	var usado int64
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			SELECT p.codigo::text,
			       COALESCE((SELECT SUM(tamanho_bytes) FROM public.entrega_arquivos WHERE org_id = $1), 0)
			     + COALESCE((SELECT SUM(tamanho_bytes) FROM public.solicitacao_anexos WHERE org_id = $1), 0)
			     + COALESCE((SELECT SUM(tamanho_bytes) FROM public.chat_anexos WHERE org_id = $1), 0)
			FROM public.orgs o
			JOIN public.planos p ON p.id = o.plano_id
			WHERE o.id = $1
		`, orgID).Scan(&planoCodigo, &usado)
	})
	return planoCodigo, usado, err
}

func (r *Repo) CreateUploadPendente(ctx context.Context, up *models.UploadPendente) error {
	payload, err := json.Marshal(up.ContextoPayload)
	if err != nil {
		return err
	}
	err = r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		const q = `
			INSERT INTO public.uploads_pendentes
			    (id, org_id, user_id, bucket, storage_path, nome_original, mime_type, tamanho_esperado,
			     hash_sha256_esperado, contexto, contexto_id, contexto_payload, expira_em)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::app.upload_contexto, $11, $12::jsonb, $13)
			RETURNING created_at
		`
		return tx.QueryRow(ctx, q,
			up.ID, up.OrgID, up.UserID, up.Bucket, up.StoragePath, up.NomeOriginal, up.MimeType,
			up.TamanhoEsperado, up.HashSHA256Esperado, up.Contexto, up.ContextoID, payload, up.ExpiraEm,
		).Scan(&up.CreatedAt)
	})
	return err
}

func (r *Repo) GetUploadPendente(ctx context.Context, id uuid.UUID) (*models.UploadPendente, error) {
	up := &models.UploadPendente{}
	var payload []byte
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		const q = `
			SELECT id, org_id, user_id, bucket, storage_path, nome_original, mime_type,
			       tamanho_esperado, hash_sha256_esperado, contexto::text, contexto_id,
			       contexto_payload, expira_em, confirmado_em, cancelado_em, erro, created_at
			FROM public.uploads_pendentes
			WHERE id = $1
		`
		return tx.QueryRow(ctx, q, id).Scan(
			&up.ID, &up.OrgID, &up.UserID, &up.Bucket, &up.StoragePath, &up.NomeOriginal, &up.MimeType,
			&up.TamanhoEsperado, &up.HashSHA256Esperado, &up.Contexto, &up.ContextoID, &payload,
			&up.ExpiraEm, &up.ConfirmadoEm, &up.CanceladoEm, &up.Erro, &up.CreatedAt,
		)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if len(payload) > 0 {
		_ = json.Unmarshal(payload, &up.ContextoPayload)
	}
	if up.ContextoPayload == nil {
		up.ContextoPayload = map[string]any{}
	}
	return up, nil
}

func (r *Repo) CancelUploadPendente(ctx context.Context, id uuid.UUID, motivo string) error {
	var rows int64
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			UPDATE public.uploads_pendentes
			SET cancelado_em = COALESCE(cancelado_em, now()), erro = COALESCE($2, erro)
			WHERE id = $1 AND confirmado_em IS NULL
		`, id, motivo)
		rows = tag.RowsAffected()
		return err
	})
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) ConfirmUploadPendente(ctx context.Context, uploadID, userID uuid.UUID, payloadOverride map[string]any) (*models.ConfirmarUploadResponse, error) {
	resp := &models.ConfirmarUploadResponse{Status: "sucesso"}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		up, err := getUploadForUpdate(ctx, tx, uploadID)
		if err != nil {
			return err
		}
		if up.ConfirmadoEm != nil {
			resp.Status = "duplicado"
			return nil
		}
		if up.CanceladoEm != nil || time.Now().After(up.ExpiraEm) {
			return fmt.Errorf("upload expirado ou cancelado")
		}
		for k, v := range payloadOverride {
			up.ContextoPayload[k] = v
		}

		switch up.Contexto {
		case "robo_entrega":
			if err := r.confirmRoboEntrega(ctx, tx, up, userID, resp); err != nil {
				return err
			}
		case "manual_entrega", "cliente_arquivo":
			if err := r.confirmManualEntrega(ctx, tx, up, userID, resp); err != nil {
				return err
			}
		case "solicitacao":
			if err := r.confirmSolicitacao(ctx, tx, up, userID, resp); err != nil {
				return err
			}
		case "mural":
			if err := r.confirmMural(ctx, tx, up, userID, resp); err != nil {
				return err
			}
		case "chat":
			if err := r.confirmChat(ctx, tx, up, resp); err != nil {
				return err
			}
		case "avatar":
			if err := r.confirmAvatar(ctx, tx, up); err != nil {
				return err
			}
		case "logo_org":
			if err := r.confirmLogoOrg(ctx, tx, up); err != nil {
				return err
			}
		default:
			return fmt.Errorf("contexto não suportado para confirmação: %s", up.Contexto)
		}

		_, err = tx.Exec(ctx, `UPDATE public.uploads_pendentes SET confirmado_em = now() WHERE id = $1`, uploadID)
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return resp, err
}

func (r *Repo) GetArquivoStorage(ctx context.Context, arquivoID uuid.UUID) (string, string, error) {
	var bucket, path string
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			SELECT bucket, storage_path
			FROM public.entrega_arquivos
			WHERE id = $1
		`, arquivoID).Scan(&bucket, &path)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrNotFound
	}
	return bucket, path, err
}

func (r *Repo) ListUploadsExpirados(ctx context.Context, limit int) ([]models.UploadPendente, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := r.DB.Pool.Query(ctx, `
		SELECT id, bucket, storage_path
		FROM public.uploads_pendentes
		WHERE confirmado_em IS NULL
		  AND cancelado_em IS NULL
		  AND expira_em < now() - INTERVAL '1 hour'
		ORDER BY expira_em
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.UploadPendente
	for rows.Next() {
		var up models.UploadPendente
		if err := rows.Scan(&up.ID, &up.Bucket, &up.StoragePath); err != nil {
			return nil, err
		}
		out = append(out, up)
	}
	return out, rows.Err()
}

func (r *Repo) MarcarUploadOrfao(ctx context.Context, id uuid.UUID) error {
	_, err := r.DB.Pool.Exec(ctx, `
		UPDATE public.uploads_pendentes
		SET cancelado_em = now(), erro = 'orfão expirado'
		WHERE id = $1 AND confirmado_em IS NULL AND cancelado_em IS NULL
	`, id)
	return err
}

func getUploadForUpdate(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*models.UploadPendente, error) {
	up := &models.UploadPendente{}
	var payload []byte
	const q = `
		SELECT id, org_id, user_id, bucket, storage_path, nome_original, mime_type,
		       tamanho_esperado, hash_sha256_esperado, contexto::text, contexto_id,
		       contexto_payload, expira_em, confirmado_em, cancelado_em, erro, created_at
		FROM public.uploads_pendentes
		WHERE id = $1
		FOR UPDATE
	`
	if err := tx.QueryRow(ctx, q, id).Scan(
		&up.ID, &up.OrgID, &up.UserID, &up.Bucket, &up.StoragePath, &up.NomeOriginal, &up.MimeType,
		&up.TamanhoEsperado, &up.HashSHA256Esperado, &up.Contexto, &up.ContextoID, &payload,
		&up.ExpiraEm, &up.ConfirmadoEm, &up.CanceladoEm, &up.Erro, &up.CreatedAt,
	); err != nil {
		return nil, err
	}
	_ = json.Unmarshal(payload, &up.ContextoPayload)
	if up.ContextoPayload == nil {
		up.ContextoPayload = map[string]any{}
	}
	return up, nil
}

func (r *Repo) confirmRoboEntrega(ctx context.Context, tx pgx.Tx, up *models.UploadPendente, userID uuid.UUID, resp *models.ConfirmarUploadResponse) error {
	cnpj, ok := payloadString(up.ContextoPayload, "cnpj_extraido")
	if !ok {
		cnpj, ok = payloadString(up.ContextoPayload, "cnpj")
	}
	competencia, compOK := payloadString(up.ContextoPayload, "competencia")
	obrigacaoRaw, obrigOK := payloadString(up.ContextoPayload, "obrigacao_id")
	if !ok || !compOK || !obrigOK {
		return fmt.Errorf("cnpj_extraido, competencia e obrigacao_id são obrigatórios")
	}
	obrigacaoID, err := uuid.Parse(obrigacaoRaw)
	if err != nil {
		return fmt.Errorf("obrigacao_id inválido: %w", err)
	}

	var empresaID uuid.UUID
	if err := tx.QueryRow(ctx, `
		SELECT id FROM public.empresas WHERE org_id = $1 AND cnpj = $2 LIMIT 1
	`, up.OrgID, cnpj).Scan(&empresaID); err != nil {
		return fmt.Errorf("empresa não encontrada para CNPJ %s: %w", cnpj, err)
	}

	var obEmpID uuid.UUID
	if err := tx.QueryRow(ctx, `
		SELECT id FROM public.obrigacao_empresa
		WHERE org_id = $1 AND obrigacao_id = $2 AND empresa_id = $3 AND ativa = TRUE
		LIMIT 1
	`, up.OrgID, obrigacaoID, empresaID).Scan(&obEmpID); err != nil {
		return fmt.Errorf("vínculo obrigação×empresa não encontrado: %w", err)
	}

	entregaID, statusAtual, err := ensureEntrega(ctx, tx, up.OrgID, obEmpID, competencia)
	if err != nil {
		return err
	}
	arquivoID, err := insertEntregaArquivo(ctx, tx, up, entregaID, userID, "sped", "robo_tauri")
	if err != nil {
		return err
	}

	hostname, _ := payloadString(up.ContextoPayload, "hostname")
	_, err = tx.Exec(ctx, `
		INSERT INTO public.entrega_eventos (org_id, entrega_id, tipo, ator_id, ator_descricao, payload)
		VALUES ($1, $2, 'arquivo_anexado'::app.entrega_evento_tipo, $3, 'robo_tauri',
		        jsonb_build_object('hostname', $4::text, 'arquivo_id', $5::text, 'tamanho_bytes', $6::bigint))
	`, up.OrgID, entregaID, userID, hostname, arquivoID, up.TamanhoEsperado)
	if err != nil {
		return err
	}
	_, _ = tx.Exec(ctx, `
		UPDATE public.robo_hosts
		SET arquivos_enviados = arquivos_enviados + 1, ultimo_heartbeat_at = now()
		WHERE org_id = $1 AND hostname = $2
	`, up.OrgID, hostname)

	resp.EntregaID = &entregaID
	resp.ArquivoID = &arquivoID
	resp.Status = statusAtual
	return nil
}

func (r *Repo) confirmManualEntrega(ctx context.Context, tx pgx.Tx, up *models.UploadPendente, userID uuid.UUID, resp *models.ConfirmarUploadResponse) error {
	if up.ContextoID == nil {
		return fmt.Errorf("contexto_id entrega_id é obrigatório")
	}
	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM public.entregas WHERE id = $1 AND org_id = $2)
	`, *up.ContextoID, up.OrgID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return pgx.ErrNoRows
	}
	arquivoID, err := insertEntregaArquivo(ctx, tx, up, *up.ContextoID, userID, "documento", "manual")
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO public.entrega_eventos (org_id, entrega_id, tipo, ator_id, ator_descricao, payload)
		VALUES ($1, $2, 'arquivo_anexado'::app.entrega_evento_tipo, $3, 'manual',
		        jsonb_build_object('arquivo_id', $4::text, 'tamanho_bytes', $5::bigint))
	`, up.OrgID, *up.ContextoID, userID, arquivoID, up.TamanhoEsperado)
	resp.EntregaID = up.ContextoID
	resp.ArquivoID = &arquivoID
	return err
}

func (r *Repo) confirmSolicitacao(ctx context.Context, tx pgx.Tx, up *models.UploadPendente, userID uuid.UUID, resp *models.ConfirmarUploadResponse) error {
	if up.ContextoID == nil {
		return fmt.Errorf("contexto_id solicitacao_id é obrigatório")
	}
	var id uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO public.solicitacao_anexos
		    (org_id, solicitacao_id, storage_path, nome_original, mime_type, tamanho_bytes, enviado_por_id)
		SELECT $1, id, $3, $4, $5, $6, $7
		FROM public.solicitacoes
		WHERE id = $2 AND org_id = $1
		RETURNING id
	`, up.OrgID, *up.ContextoID, up.StoragePath, up.NomeOriginal, up.MimeType, up.TamanhoEsperado, userID).Scan(&id)
	if err != nil {
		return err
	}
	resp.SolicitacaoAnexoID = &id
	return nil
}

func (r *Repo) confirmMural(ctx context.Context, tx pgx.Tx, up *models.UploadPendente, userID uuid.UUID, resp *models.ConfirmarUploadResponse) error {
	var postID any
	if up.ContextoID != nil {
		var exists bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (SELECT 1 FROM public.mural_posts WHERE id = $1 AND org_id = $2)
		`, *up.ContextoID, up.OrgID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return pgx.ErrNoRows
		}
		postID = *up.ContextoID
	}
	var id uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO public.mural_anexos
		    (org_id, post_id, storage_path, nome_original, mime_type, tamanho_bytes, enviado_por_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, up.OrgID, postID, up.StoragePath, up.NomeOriginal, up.MimeType, up.TamanhoEsperado, userID).Scan(&id)
	if err != nil {
		return err
	}
	resp.MuralAnexoID = &id
	return nil
}

func (r *Repo) confirmChat(ctx context.Context, tx pgx.Tx, up *models.UploadPendente, resp *models.ConfirmarUploadResponse) error {
	if up.ContextoID == nil {
		return fmt.Errorf("contexto_id mensagem_id é obrigatório")
	}
	var id uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO public.chat_anexos
		    (org_id, mensagem_id, storage_path, nome_original, mime_type, tamanho_bytes)
		SELECT $1, id, $3, $4, $5, $6
		FROM public.chat_mensagens
		WHERE id = $2 AND org_id = $1
		RETURNING id
	`, up.OrgID, *up.ContextoID, up.StoragePath, up.NomeOriginal, up.MimeType, up.TamanhoEsperado).Scan(&id)
	if err != nil {
		return err
	}
	resp.ChatAnexoID = &id
	return nil
}

func (r *Repo) confirmAvatar(ctx context.Context, tx pgx.Tx, up *models.UploadPendente) error {
	if up.UserID == nil {
		return fmt.Errorf("user_id ausente")
	}
	publicURL, _ := payloadString(up.ContextoPayload, "public_url")
	_, err := tx.Exec(ctx, `UPDATE public.profiles SET avatar_url = $2, updated_at = now() WHERE id = $1`, *up.UserID, publicURL)
	return err
}

func (r *Repo) confirmLogoOrg(ctx context.Context, tx pgx.Tx, up *models.UploadPendente) error {
	publicURL, _ := payloadString(up.ContextoPayload, "public_url")
	_, err := tx.Exec(ctx, `UPDATE public.orgs SET logo_url = $2, updated_at = now() WHERE id = $1`, up.OrgID, publicURL)
	return err
}

func ensureEntrega(ctx context.Context, tx pgx.Tx, orgID, obEmpID uuid.UUID, competencia string) (uuid.UUID, string, error) {
	var entregaID uuid.UUID
	var statusAtual string
	err := tx.QueryRow(ctx, `
		SELECT id, status::text FROM public.entregas WHERE obrigacao_empresa_id = $1 AND competencia = $2
	`, obEmpID, competencia).Scan(&entregaID, &statusAtual)
	if err == nil {
		return entregaID, statusAtual, nil
	}
	if err != pgx.ErrNoRows {
		return uuid.Nil, "", err
	}
	err = tx.QueryRow(ctx, `
		INSERT INTO public.entregas
		    (org_id, obrigacao_empresa_id, empresa_id, obrigacao_id, departamento, competencia,
		     prazo_legal, prazo_tecnico, status)
		SELECT
		    $1, oe.id, oe.empresa_id, oe.obrigacao_id, oc.departamento, $2,
		    make_date(substring($2,1,4)::int, substring($2,6,2)::int, LEAST(COALESCE(oc.dia_legal, 15), 28)),
		    make_date(substring($2,1,4)::int, substring($2,6,2)::int, GREATEST(LEAST(COALESCE(oc.dia_legal, 15), 28) - 2, 1)),
		    'aguardando_cliente'::app.entrega_status
		FROM public.obrigacao_empresa oe
		JOIN public.obrigacoes_catalogo oc ON oc.id = oe.obrigacao_id
		WHERE oe.id = $3 AND oe.org_id = $1
		RETURNING id
	`, orgID, competencia, obEmpID).Scan(&entregaID)
	return entregaID, "aguardando_cliente", err
}

func insertEntregaArquivo(ctx context.Context, tx pgx.Tx, up *models.UploadPendente, entregaID, userID uuid.UUID, tipo, origem string) (uuid.UUID, error) {
	var arquivoID uuid.UUID
	hostname, _ := payloadString(up.ContextoPayload, "hostname")
	versao, _ := payloadString(up.ContextoPayload, "versao_robo")
	err := tx.QueryRow(ctx, `
		INSERT INTO public.entrega_arquivos
		    (org_id, entrega_id, storage_path, bucket, nome_original, tipo, mime_type, tamanho_bytes,
		     hash_sha256, origem, enviado_por_id, robo_versao, robo_hostname)
		VALUES ($1, $2, $3, $4, $5, $6::app.arquivo_tipo, $7, $8, $9,
		        $10::app.arquivo_origem, $11, NULLIF($12, ''), NULLIF($13, ''))
		RETURNING id
	`, up.OrgID, entregaID, up.StoragePath, up.Bucket, up.NomeOriginal, tipo, up.MimeType,
		up.TamanhoEsperado, up.HashSHA256Esperado, origem, userID, versao, hostname,
	).Scan(&arquivoID)
	return arquivoID, err
}

func payloadString(payload map[string]any, key string) (string, bool) {
	v, ok := payload[key]
	if !ok || v == nil {
		return "", false
	}
	switch x := v.(type) {
	case string:
		return x, x != ""
	default:
		return fmt.Sprint(x), true
	}
}

// helper
func joinAnd(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += " AND "
		}
		out += p
	}
	return out
}

func pgErrCode(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}
