// Handler de busca cross-entity p/ o Cortex Quick (Cmd+K).
package handler

import (
	"strings"

	"github.com/cecopel/api/internal/auth"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GET /api/v1/busca?q=...
func (h *Handler) BuscaGlobal(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	q := strings.TrimSpace(c.Query("q"))
	if len(q) < 2 {
		return c.JSON(fiber.Map{
			"empresas": []any{}, "entregas": []any{}, "solicitacoes": []any{},
			"colaboradores": []any{}, "tarefas": []any{},
		})
	}
	res, err := h.Repo.BuscaGlobal(c.UserContext(), orgID, q)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(res)
}
