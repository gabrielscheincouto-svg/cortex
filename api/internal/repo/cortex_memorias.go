// Cortex v4 — memória persistente. O agente lembra de fatos sobre o user e
// sobre a org ao longo do tempo. Antes de cada resposta, BuildContextoMemoria
// monta um trecho `<contexto_memoria>...</contexto_memoria>` que é injetado
// no system prompt do LLM (TASK-061 vai usar isso de fato).
package repo

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ─── Tipos ─────────────────────────────────────────────────────────────────

type CortexMemoria struct {
	ID                uuid.UUID  `json:"id"`
	OrgID             uuid.UUID  `json:"org_id"`
	UserID            *uuid.UUID `json:"user_id,omitempty"`
	Tipo              string     `json:"tipo"`
	Fato              string     `json:"fato"`
	Confianca         float64    `json:"confianca"`
	OrigemConversaID  *uuid.UUID `json:"origem_conversa_id,omitempty"`
	OrigemMensagemID  *uuid.UUID `json:"origem_mensagem_id,omitempty"`
	ExpiraEm          *time.Time `json:"expira_em,omitempty"`
	RevisadaEm        *time.Time `json:"revisada_em,omitempty"`
	Arquivada         bool       `json:"arquivada"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type CreateCortexMemoriaInput struct {
	Tipo              string     `json:"tipo"`
	Fato              string     `json:"fato"`
	Confianca         *float64   `json:"confianca,omitempty"`
	EscopoOrg         bool       `json:"escopo_org,omitempty"` // true = memória da org inteira (user_id NULL)
	OrigemConversaID  *uuid.UUID `json:"origem_conversa_id,omitempty"`
	OrigemMensagemID  *uuid.UUID `json:"origem_mensagem_id,omitempty"`
	ExpiraEm          *time.Time `json:"expira_em,omitempty"`
}

type UpdateCortexMemoriaInput struct {
	Fato       *string  `json:"fato,omitempty"`
	Tipo       *string  `json:"tipo,omitempty"`
	Confianca  *float64 `json:"confianca,omitempty"`
	Arquivada  *bool    `json:"arquivada,omitempty"`
	Revisada   *bool    `json:"revisada,omitempty"`
	ExpiraEm   *time.Time `json:"expira_em,omitempty"`
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

func (r *Repo) CreateCortexMemoria(ctx context.Context, orgID, userID uuid.UUID, in CreateCortexMemoriaInput) (*CortexMemoria, error) {
	m := &CortexMemoria{}
	conf := 0.80
	if in.Confianca != nil {
		conf = *in.Confianca
	}
	if conf < 0 {
		conf = 0
	} else if conf > 1 {
		conf = 1
	}
	tipo := strings.TrimSpace(in.Tipo)
	if tipo == "" {
		tipo = "fato_user"
	}
	fato := strings.TrimSpace(in.Fato)
	if fato == "" {
		return nil, fmt.Errorf("fato_obrigatorio")
	}

	var ownerID *uuid.UUID
	if !in.EscopoOrg {
		ownerID = &userID
	}

	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			INSERT INTO public.cortex_memorias
				(org_id, user_id, tipo, fato, confianca,
				 origem_conversa_id, origem_mensagem_id, expira_em)
			VALUES ($1, $2, $3::app.cortex_memoria_tipo, $4, $5, $6, $7, $8)
			RETURNING id, org_id, user_id, tipo::text, fato, confianca,
			          origem_conversa_id, origem_mensagem_id, expira_em,
			          revisada_em, arquivada, created_at, updated_at
		`, orgID, ownerID, tipo, fato, conf, in.OrigemConversaID, in.OrigemMensagemID, in.ExpiraEm).Scan(
			&m.ID, &m.OrgID, &m.UserID, &m.Tipo, &m.Fato, &m.Confianca,
			&m.OrigemConversaID, &m.OrigemMensagemID, &m.ExpiraEm,
			&m.RevisadaEm, &m.Arquivada, &m.CreatedAt, &m.UpdatedAt,
		)
	})
	return m, err
}

// ListCortexMemorias retorna memórias do user + memórias da org.
// Filtros: tipo (vazio = todos), incluirArquivadas (default false).
func (r *Repo) ListCortexMemorias(ctx context.Context, orgID, userID uuid.UUID, tipo string, incluirArquivadas bool) ([]CortexMemoria, error) {
	out := []CortexMemoria{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		query := `
			SELECT id, org_id, user_id, tipo::text, fato, confianca,
			       origem_conversa_id, origem_mensagem_id, expira_em,
			       revisada_em, arquivada, created_at, updated_at
			FROM public.cortex_memorias
			WHERE org_id = $1
			  AND (user_id = $2 OR user_id IS NULL)
		`
		args := []any{orgID, userID}
		i := 3
		if tipo != "" {
			query += fmt.Sprintf(" AND tipo = $%d::app.cortex_memoria_tipo", i)
			args = append(args, tipo)
			i++
		}
		if !incluirArquivadas {
			query += " AND arquivada = FALSE"
		}
		query += " AND (expira_em IS NULL OR expira_em > now())"
		query += " ORDER BY confianca DESC, created_at DESC LIMIT 200"

		rows, err := tx.Query(ctx, query, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			m := CortexMemoria{}
			if err := rows.Scan(&m.ID, &m.OrgID, &m.UserID, &m.Tipo, &m.Fato, &m.Confianca,
				&m.OrigemConversaID, &m.OrigemMensagemID, &m.ExpiraEm,
				&m.RevisadaEm, &m.Arquivada, &m.CreatedAt, &m.UpdatedAt); err != nil {
				return err
			}
			out = append(out, m)
		}
		return rows.Err()
	})
	return out, err
}

func (r *Repo) UpdateCortexMemoria(ctx context.Context, memoriaID, userID uuid.UUID, in UpdateCortexMemoriaInput) (*CortexMemoria, error) {
	m := &CortexMemoria{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		// Update parcial — só altera o que vier no input
		_, err := tx.Exec(ctx, `
			UPDATE public.cortex_memorias SET
			    fato        = COALESCE($3, fato),
			    tipo        = COALESCE($4::app.cortex_memoria_tipo, tipo),
			    confianca   = COALESCE($5, confianca),
			    arquivada   = COALESCE($6, arquivada),
			    revisada_em = CASE WHEN $7 IS TRUE THEN now() ELSE revisada_em END,
			    expira_em   = COALESCE($8, expira_em)
			WHERE id = $1
			  AND (user_id = $2 OR user_id IS NULL)
		`, memoriaID, userID, in.Fato, in.Tipo, in.Confianca, in.Arquivada, in.Revisada, in.ExpiraEm)
		if err != nil {
			return err
		}
		return tx.QueryRow(ctx, `
			SELECT id, org_id, user_id, tipo::text, fato, confianca,
			       origem_conversa_id, origem_mensagem_id, expira_em,
			       revisada_em, arquivada, created_at, updated_at
			FROM public.cortex_memorias WHERE id = $1
		`, memoriaID).Scan(&m.ID, &m.OrgID, &m.UserID, &m.Tipo, &m.Fato, &m.Confianca,
			&m.OrigemConversaID, &m.OrigemMensagemID, &m.ExpiraEm,
			&m.RevisadaEm, &m.Arquivada, &m.CreatedAt, &m.UpdatedAt)
	})
	return m, err
}

// ArquivarCortexMemoria é a versão soft-delete (preserva histórico).
func (r *Repo) ArquivarCortexMemoria(ctx context.Context, memoriaID, userID uuid.UUID) error {
	return r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		ct, err := tx.Exec(ctx, `
			UPDATE public.cortex_memorias
			SET arquivada = TRUE
			WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
		`, memoriaID, userID)
		if err != nil {
			return err
		}
		if ct.RowsAffected() == 0 {
			return fmt.Errorf("memoria_nao_encontrada")
		}
		return nil
	})
}

// EsquecerTudoDoUser arquiva todas as memórias do user (não da org).
// Útil se a pessoa muda de função / quer começar do zero.
func (r *Repo) EsquecerTudoDoUser(ctx context.Context, orgID, userID uuid.UUID) (int64, error) {
	var affected int64
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		ct, err := tx.Exec(ctx, `
			UPDATE public.cortex_memorias
			SET arquivada = TRUE
			WHERE org_id = $1 AND user_id = $2 AND arquivada = FALSE
		`, orgID, userID)
		if err != nil {
			return err
		}
		affected = ct.RowsAffected()
		return nil
	})
	return affected, err
}

// ─── Contexto p/ system prompt ─────────────────────────────────────────────

// BuildContextoMemoria devolve um bloco textual com top-N memórias do user
// + top-N memórias da org, pronto para colar no system prompt.
//
// Quando a integração com Claude API entrar (TASK-061), esta string vai
// dentro de `<contexto_memoria>...</contexto_memoria>`.
func (r *Repo) BuildContextoMemoria(ctx context.Context, orgID, userID uuid.UUID) (string, error) {
	memorias := []CortexMemoria{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		// Top 30 do user
		rowsU, err := tx.Query(ctx, `
			SELECT id, org_id, user_id, tipo::text, fato, confianca,
			       origem_conversa_id, origem_mensagem_id, expira_em,
			       revisada_em, arquivada, created_at, updated_at
			FROM public.cortex_memorias
			WHERE org_id = $1 AND user_id = $2 AND arquivada = FALSE
			  AND (expira_em IS NULL OR expira_em > now())
			ORDER BY confianca DESC, updated_at DESC LIMIT 30
		`, orgID, userID)
		if err != nil {
			return err
		}
		defer rowsU.Close()
		for rowsU.Next() {
			m := CortexMemoria{}
			if err := rowsU.Scan(&m.ID, &m.OrgID, &m.UserID, &m.Tipo, &m.Fato, &m.Confianca,
				&m.OrigemConversaID, &m.OrigemMensagemID, &m.ExpiraEm,
				&m.RevisadaEm, &m.Arquivada, &m.CreatedAt, &m.UpdatedAt); err != nil {
				return err
			}
			memorias = append(memorias, m)
		}
		// Top 20 da org
		rowsO, err := tx.Query(ctx, `
			SELECT id, org_id, user_id, tipo::text, fato, confianca,
			       origem_conversa_id, origem_mensagem_id, expira_em,
			       revisada_em, arquivada, created_at, updated_at
			FROM public.cortex_memorias
			WHERE org_id = $1 AND user_id IS NULL AND arquivada = FALSE
			  AND (expira_em IS NULL OR expira_em > now())
			ORDER BY confianca DESC, updated_at DESC LIMIT 20
		`, orgID)
		if err != nil {
			return err
		}
		defer rowsO.Close()
		for rowsO.Next() {
			m := CortexMemoria{}
			if err := rowsO.Scan(&m.ID, &m.OrgID, &m.UserID, &m.Tipo, &m.Fato, &m.Confianca,
				&m.OrigemConversaID, &m.OrigemMensagemID, &m.ExpiraEm,
				&m.RevisadaEm, &m.Arquivada, &m.CreatedAt, &m.UpdatedAt); err != nil {
				return err
			}
			memorias = append(memorias, m)
		}
		return nil
	})
	if err != nil {
		return "", err
	}

	if len(memorias) == 0 {
		return "", nil
	}

	// Agrupa por escopo p/ leitura
	var bUser, bOrg strings.Builder
	for _, m := range memorias {
		linha := fmt.Sprintf("  - [%s] %s\n", m.Tipo, m.Fato)
		if m.UserID == nil {
			bOrg.WriteString(linha)
		} else {
			bUser.WriteString(linha)
		}
	}

	var out strings.Builder
	out.WriteString("Memórias relevantes (use para personalizar a resposta sem citar diretamente):\n")
	if bUser.Len() > 0 {
		out.WriteString("Sobre este usuário:\n")
		out.WriteString(bUser.String())
	}
	if bOrg.Len() > 0 {
		out.WriteString("Sobre este escritório:\n")
		out.WriteString(bOrg.String())
	}
	return out.String(), nil
}
