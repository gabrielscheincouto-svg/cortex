// Handler — endpoints da auditoria contábil.
//
//   POST   /api/v1/balancetes/:id/auditoria/rodar    — executa as 5 regras + bate-DRE
//   GET    /api/v1/balancetes/:id/findings           — lista findings (filtros: severity, status)
//   GET    /api/v1/balancetes/:id/findings/resumo    — contagens agregadas
//   PATCH  /api/v1/findings/:id                      — justificar / corrigir / arquivar
//   POST   /api/v1/balancetes/:id/liquidar           — fecha o mês (só se podeLiquidar)
//
// Todos os endpoints exigem auth.Middleware (JWT Supabase) — RLS faz o isolamento por org.

package handler

import (
	"errors"

	"github.com/cecopel/api/internal/auth"
	"github.com/cecopel/api/internal/models"
	"github.com/cecopel/api/internal/repo"
	"github.com/cecopel/api/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// auditoriaService — service lazy stateless. Igual ao padrão de storageClient.
func (h *Handler) auditoriaService() *services.AuditoriaBalancete {
	return services.NewAuditoriaBalancete(h.Repo.DB)
}

// POST /api/v1/balancetes/:id/auditoria/rodar
// Executa as 5 regras de auditoria + bate-DRE sobre o balancete.
// Idempotente: descarta findings abertos anteriores antes de inserir.
// Preserva findings já justificados/corrigidos.
func (h *Handler) RodarAuditoriaBalancete(c *fiber.Ctx) error {
	balanceteID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	result, err := h.auditoriaService().Rodar(c.UserContext(), balanceteID)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(result)
}

// GET /api/v1/balancetes/:id/findings
// Query params: severity=warning|danger, status=aberto|justificado|corrigido|arquivado
func (h *Handler) ListBalanceteFindings(c *fiber.Ctx) error {
	balanceteID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}

	var severityFilter *models.FindingSeverity
	if raw := c.Query("severity"); raw != "" {
		s := models.FindingSeverity(raw)
		if s != models.FindingSeverityWarning && s != models.FindingSeverityDanger {
			return badReq(c, "severity deve ser warning ou danger")
		}
		severityFilter = &s
	}

	var statusFilter *models.FindingStatus
	if raw := c.Query("status"); raw != "" {
		s := models.FindingStatus(raw)
		if s != models.FindingStatusAberto &&
			s != models.FindingStatusJustificado &&
			s != models.FindingStatusCorrigido &&
			s != models.FindingStatusArquivado {
			return badReq(c, "status inválido")
		}
		statusFilter = &s
	}

	findings, err := h.Repo.ListBalanceteFindings(c.UserContext(), balanceteID, severityFilter, statusFilter)
	if err != nil {
		return internalErr(c, err)
	}
	if findings == nil {
		findings = []models.BalanceteFinding{}
	}
	return c.JSON(fiber.Map{"data": findings})
}

// GET /api/v1/balancetes/:id/findings/resumo
func (h *Handler) GetBalanceteFindingsResumo(c *fiber.Ctx) error {
	balanceteID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	resumo, err := h.Repo.BalanceteResumoFindings(c.UserContext(), balanceteID)
	if err != nil {
		return internalErr(c, err)
	}
	podeLiquidar, err := h.Repo.BalancetePodeLiquidar(c.UserContext(), balanceteID)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(fiber.Map{
		"resumo":        resumo,
		"pode_liquidar": podeLiquidar,
	})
}

// PATCH /api/v1/findings/:id
// Body: { "status": "justificado|corrigido|arquivado", "justificativa": "..." }
// Justificativa obrigatória para 'justificado' e 'arquivado'.
func (h *Handler) ResolverBalanceteFinding(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	userID := auth.MustUserID(c)

	var dto models.ResolverFindingDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}

	finding, err := h.Repo.ResolverBalanceteFinding(c.UserContext(), id, userID, dto)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if errors.Is(err, repo.ErrConflict) {
		return c.Status(409).JSON(fiber.Map{
			"error":   "already_resolved",
			"message": "finding já estava resolvido",
		})
	}
	if err != nil {
		// Erros de validação vêm como erros simples; quem chama vê 400
		return badReq(c, err.Error())
	}
	return c.JSON(finding)
}

// POST /api/v1/balancetes/:id/liquidar
// Fecha o balancete somente se app.balancete_pode_liquidar() retorna TRUE.
// Reusa o handler de FecharBalancete que já existe — apenas adiciona a guarda.
func (h *Handler) LiquidarBalancete(c *fiber.Ctx) error {
	balanceteID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	pode, err := h.Repo.BalancetePodeLiquidar(c.UserContext(), balanceteID)
	if err != nil {
		return internalErr(c, err)
	}
	if !pode {
		return c.Status(409).JSON(fiber.Map{
			"error":   "findings_pendentes",
			"message": "existem findings de auditoria em aberto — resolva ou justifique antes de liquidar",
		})
	}
	// Reaproveita o handler de fechar — segue o mesmo fluxo de auditoria do FecharBalancete
	return h.FecharBalancete(c)
}
