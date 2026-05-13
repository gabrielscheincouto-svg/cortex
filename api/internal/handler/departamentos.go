package handler

import (
	"errors"

	"github.com/cecopel/api/internal/auth"
	"github.com/cecopel/api/internal/models"
	"github.com/cecopel/api/internal/repo"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func (h *Handler) ListOrgDepartamentos(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	items, err := h.Repo.ListOrgDepartamentos(c.UserContext(), orgID)
	if err != nil {
		return internalErr(c, err)
	}
	if items == nil {
		items = []models.OrgDepartamento{}
	}
	return c.JSON(items)
}

func (h *Handler) UpdateOrgDepartamento(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	codigo := c.Params("codigo")
	var dto models.UpdateOrgDepartamentoDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.PremiacaoModo != nil && *dto.PremiacaoModo != "automatico" && *dto.PremiacaoModo != "manual" {
		return badReq(c, "premiacao_modo inválido")
	}
	dept, err := h.Repo.UpdateOrgDepartamento(c.UserContext(), orgID, codigo, dto)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(dept)
}

func (h *Handler) CreateLancamentoManualPontos(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	criadoPor := auth.MustUserID(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	var dto models.LancamentoManualPontosDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.UserID == uuid.Nil || dto.Pontos == 0 || dto.Justificativa == "" {
		return badReq(c, "user_id, pontos e justificativa são obrigatórios")
	}
	if dto.Evento == "" {
		dto.Evento = "ajuste_manual"
	}
	ev, err := h.Repo.CreateLancamentoManualPontos(c.UserContext(), orgID, criadoPor, dto)
	if err != nil {
		return internalErr(c, err)
	}
	return c.Status(201).JSON(ev)
}
