// Handlers das ações pendentes do Cortex (propor, confirmar, cancelar, listar).
package handler

import (
	"strings"

	"github.com/cecopel/api/internal/auth"
	"github.com/cecopel/api/internal/repo"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GET /api/v1/cortex/acoes — lista ações pendentes do user atual
func (h *Handler) ListCortexAcoes(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	userID := auth.MustUserID(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	itens, err := h.Repo.ListCortexAcoesPendentes(c.UserContext(), orgID, userID)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(itens)
}

// POST /api/v1/cortex/acoes/:id/confirmar — executa a ação proposta
func (h *Handler) ConfirmarCortexAcao(c *fiber.Ctx) error {
	userID := auth.MustUserID(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	a, err := h.Repo.ConfirmarCortexAcao(c.UserContext(), id, userID)
	if err != nil {
		msg := err.Error()
		if strings.HasPrefix(msg, "acao_nao_pendente") || strings.HasPrefix(msg, "acao_expirada") {
			return c.Status(409).JSON(fiber.Map{"error": msg})
		}
		if strings.HasPrefix(msg, "acao_nao_permitida") {
			return c.Status(403).JSON(fiber.Map{"error": msg})
		}
		// outros erros: ação foi marcada como falhou pelo repo; devolve a ação com status="falhou"
		if a != nil && a.Status == "falhou" {
			return c.Status(422).JSON(a)
		}
		return internalErr(c, err)
	}
	return c.JSON(a)
}

// POST /api/v1/cortex/acoes/:id/cancelar — descarta a ação proposta
func (h *Handler) CancelarCortexAcao(c *fiber.Ctx) error {
	userID := auth.MustUserID(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	if err := h.Repo.CancelarCortexAcao(c.UserContext(), id, userID); err != nil {
		if err.Error() == "acao_nao_encontrada_ou_ja_processada" {
			return c.Status(404).JSON(fiber.Map{"error": err.Error()})
		}
		return internalErr(c, err)
	}
	return c.SendStatus(204)
}

// GET /api/v1/cortex/permissoes — lista permissões de tools de escrita
func (h *Handler) ListCortexPermissoes(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	itens, err := h.Repo.ListCortexPermissoes(c.UserContext(), orgID)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(itens)
}

// PATCH /api/v1/cortex/permissoes/:ferramenta
type updateCortexPermissaoDTO struct {
	Permitida        *bool    `json:"permitida"`
	RolesPermitidas  []string `json:"roles_permitidas"`
}

func (h *Handler) UpdateCortexPermissao(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	ferramenta := c.Params("ferramenta")
	if ferramenta == "" {
		return badReq(c, "ferramenta é obrigatória")
	}
	var dto updateCortexPermissaoDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	a, err := h.Repo.UpdateCortexPermissao(c.UserContext(), orgID, ferramenta, dto.Permitida, dto.RolesPermitidas)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(a)
}
