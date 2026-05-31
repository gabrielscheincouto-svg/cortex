package handler

import (
	"errors"
	"strings"

	"github.com/cecopel/api/internal/auth"
	"github.com/cecopel/api/internal/models"
	"github.com/cecopel/api/internal/repo"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func (h *Handler) ListBalancetes(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	var empresaID *uuid.UUID
	if raw := c.Query("empresa_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			return badReq(c, "empresa_id inválido")
		}
		empresaID = &id
	}
	var competencia *string
	if raw := c.Query("competencia"); raw != "" {
		competencia = &raw
	}
	page, err := h.Repo.ListBalancetes(c.UserContext(), orgID, empresaID, competencia, c.QueryInt("limit", 50))
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(page)
}

func (h *Handler) CreateBalancete(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	var dto models.CreateBalanceteDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.EmpresaID == uuid.Nil || dto.Competencia == "" {
		return badReq(c, "empresa_id e competencia são obrigatórios")
	}
	balancete, err := h.Repo.CreateBalancete(c.UserContext(), orgID, dto)
	if err != nil {
		return internalErr(c, err)
	}
	return c.Status(201).JSON(balancete)
}

func (h *Handler) GetBalancete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	detalhe, err := h.Repo.GetBalancete(c.UserContext(), id)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(detalhe)
}

// POST /api/v1/balancetes/:id/contas
// Body esperado: { "contas": [{ "codigo", "descricao", "grupo?", "saldo_anterior", "debito", "credito", "saldo_atual", "natureza?", "ordem?" }] }
func (h *Handler) ReplaceBalanceteContas(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	var dto models.ReplaceBalanceteContasDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	for _, conta := range dto.Contas {
		if conta.Codigo == "" || conta.Descricao == "" {
			return badReq(c, "codigo e descricao são obrigatórios em todas as contas")
		}
	}
	if err := h.Repo.ReplaceBalanceteContas(c.UserContext(), id, orgID, dto); err != nil {
		if strings.Contains(err.Error(), "balancete_fechado") {
			return c.Status(409).JSON(fiber.Map{"error": "balancete_fechado", "message": "balancete fechado não pode ser alterado"})
		}
		return internalErr(c, err)
	}
	return c.SendStatus(204)
}

func (h *Handler) FecharBalancete(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	userID := auth.MustUserID(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	balancete, err := h.Repo.FecharBalancete(c.UserContext(), id, orgID, userID)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(balancete)
}

func (h *Handler) GetBalanceteComparativo(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	empresaID, err := uuid.Parse(c.Query("empresa_id"))
	if err != nil {
		return badReq(c, "empresa_id inválido")
	}
	competencias := splitCsv(c.Query("competencias"))
	if len(competencias) == 0 {
		return badReq(c, "competencias é obrigatório")
	}
	out, err := h.Repo.GetBalanceteComparativo(c.UserContext(), orgID, empresaID, competencias)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(out)
}
