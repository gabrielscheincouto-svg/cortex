// Busca global cross-entity p/ o Cortex Quick (Cmd+K).
// Faz ILIKE em paralelo nas 5 tabelas que o user mais usa no dia-a-dia.
// Top 5 por tipo, ordenado por updated_at DESC.
package repo

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type BuscaResultado struct {
	Empresas       []BuscaItem `json:"empresas"`
	Entregas       []BuscaItem `json:"entregas"`
	Solicitacoes   []BuscaItem `json:"solicitacoes"`
	Colaboradores  []BuscaItem `json:"colaboradores"`
	Tarefas        []BuscaItem `json:"tarefas"`
}

type BuscaItem struct {
	ID        uuid.UUID `json:"id"`
	Titulo    string    `json:"titulo"`
	Subtitulo string    `json:"subtitulo,omitempty"`
	Href      string    `json:"href"`
	Status    string    `json:"status,omitempty"`
	UpdatedAt time.Time `json:"updated_at"`
}

// BuscaGlobal consulta as 5 tabelas mais usadas. Limita a 5 por tipo.
// q é normalizado (trim + lower). Retorna estrutura sempre completa (não nil).
func (r *Repo) BuscaGlobal(ctx context.Context, orgID uuid.UUID, q string) (*BuscaResultado, error) {
	out := &BuscaResultado{
		Empresas:      []BuscaItem{},
		Entregas:      []BuscaItem{},
		Solicitacoes:  []BuscaItem{},
		Colaboradores: []BuscaItem{},
		Tarefas:       []BuscaItem{},
	}
	q = strings.TrimSpace(q)
	if len(q) < 2 {
		return out, nil
	}
	pattern := "%" + q + "%"

	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		// Empresas
		rows, err := tx.Query(ctx, `
			SELECT id, razao_social, nome_fantasia, cnpj, updated_at
			FROM public.empresas
			WHERE org_id = $1 AND status = 'ativa'
			  AND (razao_social ILIKE $2 OR nome_fantasia ILIKE $2 OR cnpj ILIKE $2)
			ORDER BY updated_at DESC
			LIMIT 5
		`, orgID, pattern)
		if err == nil {
			for rows.Next() {
				var id uuid.UUID
				var razao, fantasia, cnpj string
				var upd time.Time
				if err := rows.Scan(&id, &razao, &fantasia, &cnpj, &upd); err == nil {
					sub := cnpj
					if fantasia != "" && fantasia != razao {
						sub = fantasia + " · " + cnpj
					}
					out.Empresas = append(out.Empresas, BuscaItem{
						ID: id, Titulo: razao, Subtitulo: sub,
						Href: "/empresas/" + id.String(), UpdatedAt: upd,
					})
				}
			}
			rows.Close()
		}

		// Entregas — busca pelo nome da obrigação ou razão social
		rows, err = tx.Query(ctx, `
			SELECT e.id, COALESCE(oc.nome, 'Obrigação'), COALESCE(emp.razao_social, ''),
			       e.status::text, e.updated_at
			FROM public.entregas e
			LEFT JOIN public.obrigacoes_catalogo oc ON oc.id = e.obrigacao_id
			LEFT JOIN public.empresas emp ON emp.id = e.empresa_id
			WHERE e.org_id = $1
			  AND (oc.nome ILIKE $2 OR emp.razao_social ILIKE $2 OR emp.nome_fantasia ILIKE $2)
			ORDER BY e.prazo_legal DESC
			LIMIT 5
		`, orgID, pattern)
		if err == nil {
			for rows.Next() {
				var id uuid.UUID
				var nome, empresa, status string
				var upd time.Time
				if err := rows.Scan(&id, &nome, &empresa, &status, &upd); err == nil {
					out.Entregas = append(out.Entregas, BuscaItem{
						ID: id, Titulo: nome, Subtitulo: empresa,
						Status: status, Href: "/entregas/" + id.String(), UpdatedAt: upd,
					})
				}
			}
			rows.Close()
		}

		// Solicitações
		rows, err = tx.Query(ctx, `
			SELECT s.id, s.titulo, COALESCE(emp.razao_social, ''), s.status::text, s.updated_at
			FROM public.solicitacoes s
			LEFT JOIN public.empresas emp ON emp.id = s.empresa_id
			WHERE s.org_id = $1
			  AND (s.titulo ILIKE $2 OR s.descricao ILIKE $2 OR emp.razao_social ILIKE $2)
			ORDER BY s.updated_at DESC
			LIMIT 5
		`, orgID, pattern)
		if err == nil {
			for rows.Next() {
				var id uuid.UUID
				var titulo, empresa, status string
				var upd time.Time
				if err := rows.Scan(&id, &titulo, &empresa, &status, &upd); err == nil {
					out.Solicitacoes = append(out.Solicitacoes, BuscaItem{
						ID: id, Titulo: titulo, Subtitulo: empresa,
						Status: status, Href: "/solicitacoes/" + id.String(), UpdatedAt: upd,
					})
				}
			}
			rows.Close()
		}

		// Colaboradores
		rows, err = tx.Query(ctx, `
			SELECT p.id, COALESCE(p.nome, p.email), p.email, m.role::text, p.updated_at
			FROM public.profiles p
			JOIN public.org_membros m ON m.user_id = p.id
			WHERE m.org_id = $1 AND m.status = 'ativo'
			  AND (p.nome ILIKE $2 OR p.email ILIKE $2)
			ORDER BY p.updated_at DESC
			LIMIT 5
		`, orgID, pattern)
		if err == nil {
			for rows.Next() {
				var id uuid.UUID
				var nome, email, role string
				var upd time.Time
				if err := rows.Scan(&id, &nome, &email, &role, &upd); err == nil {
					out.Colaboradores = append(out.Colaboradores, BuscaItem{
						ID: id, Titulo: nome, Subtitulo: email + " · " + role,
						Href: "/equipe/" + id.String(), UpdatedAt: upd,
					})
				}
			}
			rows.Close()
		}

		// Tarefas Kanban
		rows, err = tx.Query(ctx, `
			SELECT id, titulo, COALESCE(descricao, ''), status::text, updated_at
			FROM public.kanban_tarefas
			WHERE org_id = $1
			  AND (titulo ILIKE $2 OR descricao ILIKE $2)
			ORDER BY updated_at DESC
			LIMIT 5
		`, orgID, pattern)
		if err == nil {
			for rows.Next() {
				var id uuid.UUID
				var titulo, desc, status string
				var upd time.Time
				if err := rows.Scan(&id, &titulo, &desc, &status, &upd); err == nil {
					sub := ""
					if len(desc) > 0 {
						if len(desc) > 60 {
							sub = desc[:60] + "…"
						} else {
							sub = desc
						}
					}
					out.Tarefas = append(out.Tarefas, BuscaItem{
						ID: id, Titulo: titulo, Subtitulo: sub,
						Status: status, Href: "/kanban?tarefa=" + id.String(), UpdatedAt: upd,
					})
				}
			}
			rows.Close()
		}

		return nil
	})
	return out, err
}
