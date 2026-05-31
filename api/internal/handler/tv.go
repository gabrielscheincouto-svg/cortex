package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func (h *Handler) TVData(c *fiber.Ctx) error {
	token := c.Query("token")
	if token == "" {
		return c.Status(401).JSON(fiber.Map{"error": "missing_token"})
	}
	var orgID uuid.UUID
	var orgNome string
	if err := h.Repo.DB.Pool.QueryRow(c.UserContext(), `
		SELECT id, nome FROM public.orgs WHERE tv_token = $1 AND status IN ('trial','ativo')
	`, token).Scan(&orgID, &orgNome); err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}

	data := fiber.Map{"org": fiber.Map{"id": orgID, "nome": orgNome}}
	data["mural"] = queryRows(c, h, `
		SELECT COALESCE(titulo, categoria::text), conteudo
		FROM public.mural_posts
		WHERE org_id = $1 AND deleted_at IS NULL
		ORDER BY fixado DESC, created_at DESC
		LIMIT 3
	`, orgID, "titulo", "conteudo")
	data["kanban"] = queryRows(c, h, `
		SELECT status::text, COUNT(*)::int
		FROM public.kanban_tarefas
		WHERE org_id = $1
		GROUP BY status
	`, orgID, "status", "total")
	data["entregas"] = queryRows(c, h, `
		SELECT emp.razao_social, oc.nome, e.prazo_legal, e.status::text
		FROM public.entregas e
		LEFT JOIN public.empresas emp ON emp.id = e.empresa_id
		LEFT JOIN public.obrigacoes_catalogo oc ON oc.id = e.obrigacao_id
		WHERE e.org_id = $1 AND (e.prazo_legal <= CURRENT_DATE + INTERVAL '7 days' OR e.status = 'atrasada')
		ORDER BY e.prazo_legal
		LIMIT 10
	`, orgID, "empresa", "obrigacao", "prazo", "status")
	data["ranking"] = queryRows(c, h, `
		SELECT COALESCE(p.nome, p.email, 'Colaborador'), rp.pontos, rp.posicao
		FROM public.ranking_periodos rp
		LEFT JOIN public.profiles p ON p.id = rp.user_id
		WHERE rp.org_id = $1 AND rp.tipo = 'semanal'
		ORDER BY rp.calculado_em DESC, rp.posicao
		LIMIT 5
	`, orgID, "nome", "pontos", "posicao")
	data["solicitacoes"] = queryRows(c, h, `
		SELECT prioridade::text, COUNT(*)::int
		FROM public.solicitacoes
		WHERE org_id = $1 AND status IN ('nova','em_atendimento','aguardando_cliente')
		GROUP BY prioridade
	`, orgID, "prioridade", "total")
	data["kpis"] = queryRows(c, h, `
		SELECT
			COUNT(*)::int AS entregas_total,
			COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'entregue') / NULLIF(COUNT(*),0)),0)::int AS perc_no_prazo,
			COALESCE(AVG(avaliacao_estrelas),0)::numeric(4,2) AS nps_medio
		FROM public.entregas e
		LEFT JOIN public.solicitacoes s ON s.org_id = e.org_id AND s.avaliacao_em >= date_trunc('month', now())
		WHERE e.org_id = $1 AND e.created_at >= date_trunc('month', now())
	`, orgID, "entregas_total", "perc_no_prazo", "nps_medio")
	return c.JSON(data)
}

func queryRows(c *fiber.Ctx, h *Handler, sql string, orgID uuid.UUID, keys ...string) []fiber.Map {
	rows, err := h.Repo.DB.Pool.Query(c.UserContext(), sql, orgID)
	if err != nil {
		return []fiber.Map{}
	}
	defer rows.Close()
	out := []fiber.Map{}
	for rows.Next() {
		values := make([]any, len(keys))
		ptrs := make([]any, len(keys))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}
		item := fiber.Map{}
		for i, key := range keys {
			item[key] = values[i]
		}
		out = append(out, item)
	}
	return out
}
