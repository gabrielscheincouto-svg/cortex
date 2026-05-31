// Handlers do módulo IRPF — declarantes, declarações, lançamentos e cálculo.
package handler

import (
	"errors"

	"github.com/cecopel/api/internal/auth"
	"github.com/cecopel/api/internal/models"
	"github.com/cecopel/api/internal/repo"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// ─── DECLARANTES ───────────────────────────────────────────────────────────

// GET /api/v1/irpf/declarantes?q=&limit=
func (h *Handler) ListIrpfDeclarantes(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	var busca *string
	if q := c.Query("q"); q != "" {
		busca = &q
	}
	page, err := h.Repo.ListIrpfDeclarantes(c.UserContext(), orgID, busca, c.QueryInt("limit", 50))
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(page)
}

// POST /api/v1/irpf/declarantes
func (h *Handler) CreateIrpfDeclarante(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	var dto models.CreateIrpfDeclaranteDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.CPF == "" || dto.NomeCompleto == "" {
		return badReq(c, "cpf e nome_completo são obrigatórios")
	}
	d, err := h.Repo.CreateIrpfDeclarante(c.UserContext(), orgID, dto)
	if err != nil {
		return internalErr(c, err)
	}
	return c.Status(201).JSON(d)
}

// PATCH /api/v1/irpf/declarantes/:id
func (h *Handler) UpdateIrpfDeclarante(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	var dto models.UpdateIrpfDeclaranteDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	d, err := h.Repo.UpdateIrpfDeclarante(c.UserContext(), id, dto)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(d)
}

// DELETE /api/v1/irpf/declarantes/:id
func (h *Handler) DeleteIrpfDeclarante(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	if err := h.Repo.DeleteIrpfDeclarante(c.UserContext(), id); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return c.Status(404).JSON(fiber.Map{"error": "not_found"})
		}
		return internalErr(c, err)
	}
	return c.SendStatus(204)
}

// ─── DECLARAÇÕES ───────────────────────────────────────────────────────────

// GET /api/v1/irpf/declaracoes?exercicio=&status=&limit=
func (h *Handler) ListIrpfDeclaracoes(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	var exercicio *int
	if v := c.QueryInt("exercicio", 0); v > 0 {
		exercicio = &v
	}
	var status *string
	if s := c.Query("status"); s != "" {
		status = &s
	}
	page, err := h.Repo.ListIrpfDeclaracoes(c.UserContext(), orgID, exercicio, status, c.QueryInt("limit", 50))
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(page)
}

// POST /api/v1/irpf/declaracoes
func (h *Handler) CreateIrpfDeclaracao(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	var dto models.CreateIrpfDeclaracaoDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.DeclaranteID == uuid.Nil || dto.Exercicio == 0 || dto.AnoCalendario == 0 {
		return badReq(c, "declarante_id, exercicio e ano_calendario são obrigatórios")
	}
	d, err := h.Repo.CreateIrpfDeclaracao(c.UserContext(), orgID, dto)
	if err != nil {
		return internalErr(c, err)
	}
	return c.Status(201).JSON(d)
}

// GET /api/v1/irpf/declaracoes/:id
func (h *Handler) GetIrpfDeclaracao(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	det, err := h.Repo.GetIrpfDeclaracao(c.UserContext(), id)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(det)
}

// PATCH /api/v1/irpf/declaracoes/:id
func (h *Handler) UpdateIrpfDeclaracao(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	var dto models.UpdateIrpfDeclaracaoDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	d, err := h.Repo.UpdateIrpfDeclaracao(c.UserContext(), id, dto)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(d)
}

// POST /api/v1/irpf/declaracoes/:id/lancamentos
func (h *Handler) AddIrpfLancamento(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	declaracaoID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	var dto models.CreateIrpfLancamentoDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.Tipo == "" {
		return badReq(c, "tipo é obrigatório")
	}
	l, err := h.Repo.AddIrpfLancamento(c.UserContext(), orgID, declaracaoID, dto)
	if err != nil {
		return internalErr(c, err)
	}
	// Recalcula automaticamente após cada lançamento
	if _, err := h.Repo.RecalcularIrpfDeclaracao(c.UserContext(), declaracaoID); err != nil {
		// não impede o sucesso do lançamento, só loga implicitamente via 500 não retornado
	}
	return c.Status(201).JSON(l)
}

// DELETE /api/v1/irpf/lancamentos/:id
func (h *Handler) DeleteIrpfLancamento(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	if err := h.Repo.DeleteIrpfLancamento(c.UserContext(), id); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return c.Status(404).JSON(fiber.Map{"error": "not_found"})
		}
		return internalErr(c, err)
	}
	return c.SendStatus(204)
}

// POST /api/v1/irpf/declaracoes/:id/calcular
// Força recálculo. Útil quando o user editou lançamentos e quer reprocessar.
func (h *Handler) RecalcularIrpfDeclaracao(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	d, err := h.Repo.RecalcularIrpfDeclaracao(c.UserContext(), id)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(d)
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────

// GET /api/v1/irpf/dashboard?exercicio=2026
func (h *Handler) IrpfDashboard(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	exercicio := c.QueryInt("exercicio", 0)
	if exercicio == 0 {
		return badReq(c, "exercicio é obrigatório (ex: 2026)")
	}
	dash, err := h.Repo.IrpfDashboard(c.UserContext(), orgID, exercicio)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(dash)
}
