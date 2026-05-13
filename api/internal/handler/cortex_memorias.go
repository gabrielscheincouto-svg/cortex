// Handlers do CRUD de memórias persistentes do Cortex.
package handler

import (
	"github.com/cecopel/api/internal/auth"
	"github.com/cecopel/api/internal/repo"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GET /api/v1/cortex/memorias?tipo=&incluir_arquivadas=
func (h *Handler) ListCortexMemorias(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	userID := auth.MustUserID(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	tipo := c.Query("tipo")
	incluirArquivadas := c.Query("incluir_arquivadas") == "true"
	itens, err := h.Repo.ListCortexMemorias(c.UserContext(), orgID, userID, tipo, incluirArquivadas)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(itens)
}

// POST /api/v1/cortex/memorias
func (h *Handler) CreateCortexMemoria(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	userID := auth.MustUserID(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	var dto repo.CreateCortexMemoriaInput
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	m, err := h.Repo.CreateCortexMemoria(c.UserContext(), orgID, userID, dto)
	if err != nil {
		if err.Error() == "fato_obrigatorio" {
			return badReq(c, err.Error())
		}
		return internalErr(c, err)
	}
	return c.Status(201).JSON(m)
}

// PATCH /api/v1/cortex/memorias/:id
func (h *Handler) UpdateCortexMemoria(c *fiber.Ctx) error {
	userID := auth.MustUserID(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	var dto repo.UpdateCortexMemoriaInput
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	m, err := h.Repo.UpdateCortexMemoria(c.UserContext(), id, userID, dto)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(m)
}

// DELETE /api/v1/cortex/memorias/:id  (soft delete = arquiva)
func (h *Handler) DeleteCortexMemoria(c *fiber.Ctx) error {
	userID := auth.MustUserID(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	if err := h.Repo.ArquivarCortexMemoria(c.UserContext(), id, userID); err != nil {
		if err.Error() == "memoria_nao_encontrada" {
			return c.Status(404).JSON(fiber.Map{"error": err.Error()})
		}
		return internalErr(c, err)
	}
	return c.SendStatus(204)
}

// POST /api/v1/cortex/memorias/esquecer-tudo
func (h *Handler) EsquecerTudoCortexMemorias(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	userID := auth.MustUserID(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	n, err := h.Repo.EsquecerTudoDoUser(c.UserContext(), orgID, userID)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(fiber.Map{"arquivadas": n})
}
