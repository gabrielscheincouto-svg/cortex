package repo

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/cecopel/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Repo) CreateCortexConversa(ctx context.Context, orgID, userID uuid.UUID, dto models.CreateCortexConversaDTO) (*models.CortexConversa, error) {
	conv := &models.CortexConversa{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			INSERT INTO public.cortex_conversas (org_id, user_id, titulo, contexto_pagina)
			VALUES ($1, $2, $3, $4)
			RETURNING id, org_id, user_id, titulo, contexto_pagina, arquivada, created_at, updated_at
		`, orgID, userID, dto.Titulo, dto.ContextoPagina).Scan(
			&conv.ID, &conv.OrgID, &conv.UserID, &conv.Titulo, &conv.ContextoPagina, &conv.Arquivada, &conv.CreatedAt, &conv.UpdatedAt,
		)
	})
	return conv, err
}

func (r *Repo) ListCortexConversas(ctx context.Context) ([]models.CortexConversa, error) {
	var out []models.CortexConversa
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT id, org_id, user_id, titulo, contexto_pagina, arquivada, created_at, updated_at
			FROM public.cortex_conversas
			WHERE arquivada = false
			ORDER BY updated_at DESC
			LIMIT 50
		`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var conv models.CortexConversa
			if err := rows.Scan(&conv.ID, &conv.OrgID, &conv.UserID, &conv.Titulo, &conv.ContextoPagina, &conv.Arquivada, &conv.CreatedAt, &conv.UpdatedAt); err != nil {
				return err
			}
			out = append(out, conv)
		}
		return rows.Err()
	})
	return out, err
}

func (r *Repo) GetCortexConversa(ctx context.Context, id uuid.UUID) (*models.CortexConversaDetalhe, error) {
	det := &models.CortexConversaDetalhe{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, `
			SELECT id, org_id, user_id, titulo, contexto_pagina, arquivada, created_at, updated_at
			FROM public.cortex_conversas
			WHERE id = $1 AND arquivada = false
		`, id).Scan(
			&det.Conversa.ID, &det.Conversa.OrgID, &det.Conversa.UserID, &det.Conversa.Titulo,
			&det.Conversa.ContextoPagina, &det.Conversa.Arquivada, &det.Conversa.CreatedAt, &det.Conversa.UpdatedAt,
		); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `
			SELECT id, org_id, conversa_id, papel::text, conteudo, tool_chamadas, modelo, criada_em
			FROM public.cortex_mensagens
			WHERE conversa_id = $1
			ORDER BY criada_em
		`, id)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			msg, err := scanCortexMensagem(rows)
			if err != nil {
				return err
			}
			det.Mensagens = append(det.Mensagens, *msg)
		}
		return rows.Err()
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return det, err
}

func (r *Repo) InsertCortexMensagem(ctx context.Context, orgID, conversaID uuid.UUID, papel, conteudo string, tool map[string]any) (*models.CortexMensagem, error) {
	msg := &models.CortexMensagem{}
	var rawTool any
	if tool != nil {
		b, err := json.Marshal(tool)
		if err != nil {
			return nil, err
		}
		rawTool = b
	}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			INSERT INTO public.cortex_mensagens (org_id, conversa_id, papel, conteudo, tool_chamadas, modelo)
			VALUES ($1, $2, $3::app.ai_papel, $4, $5::jsonb, 'cortex-v1-local')
			RETURNING id, org_id, conversa_id, papel::text, conteudo, tool_chamadas, modelo, criada_em
		`, orgID, conversaID, papel, conteudo, rawTool).Scan(
			&msg.ID, &msg.OrgID, &msg.ConversaID, &msg.Papel, &msg.Conteudo, &rawTool, &msg.Modelo, &msg.CriadaEm,
		)
	})
	if err != nil {
		return nil, err
	}
	msg.ToolChamadas = decodeTool(rawTool)
	return msg, nil
}

func (r *Repo) DeleteCortexConversa(ctx context.Context, id uuid.UUID) error {
	var rows int64
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `UPDATE public.cortex_conversas SET arquivada = true, updated_at = now() WHERE id = $1`, id)
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

func (r *Repo) CortexRateCount(ctx context.Context, userID uuid.UUID) (int, string, error) {
	var count int
	var plano string
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			SELECT COUNT(*)::int, p.codigo::text
			FROM public.cortex_mensagens m
			JOIN public.cortex_conversas c ON c.id = m.conversa_id
			JOIN public.orgs o ON o.id = c.org_id
			JOIN public.planos p ON p.id = o.plano_id
			WHERE c.user_id = $1 AND m.papel = 'user' AND m.criada_em > now() - interval '1 hour'
			GROUP BY p.codigo
		`, userID).Scan(&count, &plano)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, "free", nil
	}
	return count, plano, err
}

func (r *Repo) RunCortexTool(ctx context.Context, orgID, userID, conversaID uuid.UUID, pergunta string) (models.CortexToolEvent, string, error) {
	start := time.Now()
	tool := chooseTool(pergunta)
	event := models.CortexToolEvent{Ferramenta: tool, Resultado: map[string]any{}}
	var err error

	switch tool {
	case "listar_entregas":
		err = r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
			var status = "atrasada"
			if strings.Contains(strings.ToLower(pergunta), "pendente") {
				status = "pendente"
			}
			rows, err := tx.Query(ctx, `
				SELECT e.id, COALESCE(emp.razao_social, 'Empresa sem nome'), COALESCE(oc.nome, 'Obrigação'), e.competencia, e.prazo_legal, e.status::text
				FROM public.entregas e
				LEFT JOIN public.empresas emp ON emp.id = e.empresa_id
				LEFT JOIN public.obrigacoes_catalogo oc ON oc.id = e.obrigacao_id
				WHERE e.org_id = $1 AND e.status::text = $2
				ORDER BY e.prazo_legal
				LIMIT 12
			`, orgID, status)
			if err != nil {
				return err
			}
			defer rows.Close()
			items := []map[string]any{}
			for rows.Next() {
				var id uuid.UUID
				var empresa, obrigacao, competencia, st string
				var prazo time.Time
				if err := rows.Scan(&id, &empresa, &obrigacao, &competencia, &prazo, &st); err != nil {
					return err
				}
				items = append(items, map[string]any{"id": id.String(), "empresa": empresa, "obrigacao": obrigacao, "competencia": competencia, "prazo": prazo.Format("2006-01-02"), "status": st})
			}
			event.Resultado["status"] = status
			event.Resultado["total"] = len(items)
			event.Resultado["itens"] = items
			event.Resumo = "listar_entregas -> " + pluralResultados(len(items))
			return rows.Err()
		})
	case "listar_empresas":
		err = r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
			var total int
			if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM public.empresas WHERE org_id = $1 AND status = 'ativa'`, orgID).Scan(&total); err != nil {
				return err
			}
			event.Resultado["empresas_ativas"] = total
			event.Resumo = "listar_empresas -> " + pluralResultados(total)
			return nil
		})
	case "listar_solicitacoes":
		err = r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
			var total int
			if err := tx.QueryRow(ctx, `
				SELECT COUNT(*) FROM public.solicitacoes
				WHERE org_id = $1 AND status IN ('nova','em_atendimento','aguardando_cliente')
			`, orgID).Scan(&total); err != nil {
				return err
			}
			event.Resultado["abertas"] = total
			event.Resumo = "listar_solicitacoes -> " + pluralResultados(total)
			return nil
		})
	case "listar_minhas_memorias":
		memorias, mErr := r.ListCortexMemorias(ctx, orgID, userID, "", false)
		if mErr != nil {
			err = mErr
		} else {
			itens := make([]map[string]any, 0, len(memorias))
			for _, m := range memorias {
				itens = append(itens, map[string]any{
					"id": m.ID.String(), "tipo": m.Tipo, "fato": m.Fato,
					"escopo": map[bool]string{true: "org", false: "user"}[m.UserID == nil],
					"confianca": m.Confianca,
				})
			}
			event.Resultado["memorias"] = itens
			event.Resultado["total"] = len(itens)
			event.Resumo = "listar_minhas_memorias -> " + pluralResultados(len(itens))
		}
	default:
		event.Resultado["data"] = time.Now().Format("2006-01-02")
		event.Resumo = "obter_data_hoje"
	}

	duration := int(time.Since(start).Milliseconds())
	rawResult, _ := json.Marshal(event.Resultado)
	rawArgs, _ := json.Marshal(map[string]any{"pergunta": pergunta})
	_ = r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		var erro *string
		if err != nil {
			s := err.Error()
			erro = &s
		}
		_, auditErr := tx.Exec(ctx, `
			INSERT INTO public.cortex_ferramentas_executadas
			    (org_id, user_id, conversa_id, ferramenta, args, resultado, erro, duracao_ms)
			VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
		`, orgID, userID, conversaID, tool, rawArgs, rawResult, erro, duration)
		return auditErr
	})
	return event, respostaCortex(pergunta, event), err
}

func scanCortexMensagem(rows pgx.Rows) (*models.CortexMensagem, error) {
	msg := &models.CortexMensagem{}
	var raw any
	if err := rows.Scan(&msg.ID, &msg.OrgID, &msg.ConversaID, &msg.Papel, &msg.Conteudo, &raw, &msg.Modelo, &msg.CriadaEm); err != nil {
		return nil, err
	}
	msg.ToolChamadas = decodeTool(raw)
	return msg, nil
}

func decodeTool(raw any) map[string]any {
	if raw == nil {
		return nil
	}
	var b []byte
	switch v := raw.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	default:
		return nil
	}
	var out map[string]any
	_ = json.Unmarshal(b, &out)
	return out
}

func chooseTool(pergunta string) string {
	p := strings.ToLower(pergunta)
	switch {
	case strings.Contains(p, "memóri"), strings.Contains(p, "memori"), strings.Contains(p, "lembra de mim"), strings.Contains(p, "sabe sobre mim"):
		return "listar_minhas_memorias"
	case strings.Contains(p, "entrega"), strings.Contains(p, "atrasad"), strings.Contains(p, "pendente"):
		return "listar_entregas"
	case strings.Contains(p, "empresa"), strings.Contains(p, "cliente"):
		return "listar_empresas"
	case strings.Contains(p, "solicita"), strings.Contains(p, "ticket"):
		return "listar_solicitacoes"
	default:
		return "obter_data_hoje"
	}
}

func pluralResultados(n int) string {
	if n == 1 {
		return "1 resultado"
	}
	return strconv.Itoa(n) + " resultados"
}

func respostaCortex(pergunta string, event models.CortexToolEvent) string {
	switch event.Ferramenta {
	case "listar_minhas_memorias":
		total, _ := event.Resultado["total"].(int)
		if total == 0 {
			return "Ainda não tenho memórias sobre você. Conforme conversarmos, vou anotando preferências, rotinas e termos que você usa — basta dizer \"lembre que...\""
		}
		return "Tenho " + pluralResultados(total) + " na minha memória sobre você e sua org. Para ver detalhes, abra Cortex → Memórias."
	case "listar_entregas":
		total, _ := event.Resultado["total"].(int)
		status, _ := event.Resultado["status"].(string)
		if total == 0 {
			return "Consultei sua memória de entregas e não encontrei entregas com status " + status + " agora."
		}
		return "Consultei as entregas e encontrei " + pluralResultados(total) + " com status " + status + ". Abri a lista mais urgente no card de consulta para você revisar por prazo."
	case "listar_empresas":
		return "Consultei o cadastro e encontrei " + pluralResultados(asInt(event.Resultado["empresas_ativas"])) + " de empresas ativas."
	case "listar_solicitacoes":
		return "Consultei as solicitações e encontrei " + pluralResultados(asInt(event.Resultado["abertas"])) + " abertas ou aguardando atendimento."
	default:
		return "Hoje é " + time.Now().Format("02/01/2006") + ". Posso consultar entregas, empresas, solicitações e rankings quando você pedir."
	}
}

func asInt(v any) int {
	switch n := v.(type) {
	case int:
		return n
	case int64:
		return int(n)
	case float64:
		return int(n)
	default:
		return 0
	}
}
