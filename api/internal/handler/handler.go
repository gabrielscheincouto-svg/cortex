// Package handler contém os handlers HTTP REST.
package handler

import (
	"encoding/json"
	"errors"

	"github.com/cecopel/api/internal/auth"
	"github.com/cecopel/api/internal/config"
	"github.com/cecopel/api/internal/models"
	"github.com/cecopel/api/internal/realtime"
	"github.com/cecopel/api/internal/repo"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Handler struct {
	Repo *repo.Repo
	Hub  *realtime.Hub
	Cfg  *config.Config
}

func New(r *repo.Repo, hub *realtime.Hub, cfg *config.Config) *Handler {
	return &Handler{Repo: r, Hub: hub, Cfg: cfg}
}

// ─── Health ───────────────────────────────────────────────────
func (h *Handler) Health(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"status": "ok", "service": "cecopel-api"})
}

// ─── /me ──────────────────────────────────────────────────────
// GET /api/v1/me
func (h *Handler) Me(c *fiber.Ctx) error {
	userID := auth.MustUserID(c)
	profile, err := h.Repo.GetProfile(c.UserContext(), userID)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "profile_not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	orgs, err := h.Repo.ListMyOrgs(c.UserContext(), userID)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(fiber.Map{
		"profile": profile,
		"orgs":    orgs,
	})
}

// PATCH /api/v1/me/current-org
type setCurrentOrgDTO struct {
	OrgID uuid.UUID `json:"org_id"`
}

func (h *Handler) SetCurrentOrg(c *fiber.Ctx) error {
	userID := auth.MustUserID(c)
	var dto setCurrentOrgDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.OrgID == uuid.Nil {
		return badReq(c, "org_id required")
	}
	if err := h.Repo.SetCurrentOrg(c.UserContext(), userID, dto.OrgID); err != nil {
		return internalErr(c, err)
	}
	return c.SendStatus(204)
}

// ─── Orgs ─────────────────────────────────────────────────────
// GET /api/v1/orgs
func (h *Handler) ListOrgs(c *fiber.Ctx) error {
	userID := auth.MustUserID(c)
	orgs, err := h.Repo.ListMyOrgs(c.UserContext(), userID)
	if err != nil {
		return internalErr(c, err)
	}
	if orgs == nil {
		orgs = []models.OrgComMembro{}
	}
	return c.JSON(orgs)
}

// POST /api/v1/orgs
func (h *Handler) CreateOrg(c *fiber.Ctx) error {
	userID := auth.MustUserID(c)
	var dto models.CreateOrgDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.Slug == "" || dto.Nome == "" || dto.PlanoCodigo == "" {
		return badReq(c, "slug, nome e plano_codigo são obrigatórios")
	}
	org, err := h.Repo.CreateOrg(c.UserContext(), userID, dto)
	if err != nil {
		return internalErr(c, err)
	}
	return c.Status(201).JSON(org)
}

// ─── Empresas ─────────────────────────────────────────────────
// GET /api/v1/empresas?q=&limit=&offset=
func (h *Handler) ListEmpresas(c *fiber.Ctx) error {
	q := c.Query("q")
	limit := c.QueryInt("limit", 50)
	offset := c.QueryInt("offset", 0)
	var busca *string
	if q != "" {
		busca = &q
	}
	page, err := h.Repo.ListEmpresas(c.UserContext(), busca, limit, offset)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(page)
}

// POST /api/v1/empresas
func (h *Handler) CreateEmpresa(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro (PATCH /me/current-org)")
	}
	var dto models.CreateEmpresaDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.RazaoSocial == "" {
		return badReq(c, "razao_social é obrigatória")
	}
	emp, err := h.Repo.CreateEmpresa(c.UserContext(), orgID, dto)
	if err != nil {
		return internalErr(c, err)
	}
	return c.Status(201).JSON(emp)
}

// ─── Entregas ─────────────────────────────────────────────────
// GET /api/v1/entregas
func (h *Handler) ListEntregas(c *fiber.Ctx) error {
	var f models.EntregaListFilter
	if err := c.QueryParser(&f); err != nil {
		return badReq(c, "filtros inválidos")
	}
	// status pode vir como CSV: ?status=pendente,atrasada
	if raw := c.Query("status"); raw != "" {
		f.Status = splitCsv(raw)
	}
	page, err := h.Repo.ListEntregas(c.UserContext(), f)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(page)
}

// PATCH /api/v1/entregas/:id/status
func (h *Handler) UpdateEntregaStatus(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	userID := auth.MustUserID(c)
	var dto models.UpdateEntregaStatusDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	allowed := map[string]bool{
		"pendente": true, "em_andamento": true, "aguardando_cliente": true,
		"entregue": true, "justificada": true, "dispensada": true, "atrasada": true,
	}
	if !allowed[dto.Status] {
		return badReq(c, "status inválido")
	}
	e, err := h.Repo.UpdateEntregaStatus(c.UserContext(), id, userID, dto)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(e)
}

// ─── Chat ────────────────────────────────────────────────────

// POST /api/v1/chat/canais/:id/lido — marca o canal como lido pelo user atual.
func (h *Handler) MarcarChatLido(c *fiber.Ctx) error {
	canalID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	userID := auth.MustUserID(c)
	if err := h.Repo.MarcarChatLido(c.UserContext(), orgID, canalID, userID); err != nil {
		return internalErr(c, err)
	}
	return c.SendStatus(204)
}

// POST /api/v1/chat/canais/:id/mensagens
func (h *Handler) CreateChatMensagem(c *fiber.Ctx) error {
	canalID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro (PATCH /me/current-org)")
	}
	userID := auth.MustUserID(c)

	var dto models.CreateChatMensagemDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.Conteudo == "" {
		return badReq(c, "conteudo é obrigatório")
	}

	msg, err := h.Repo.CreateChatMensagem(c.UserContext(), orgID, canalID, userID, dto)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}

	if h.Hub != nil {
		payload, _ := json.Marshal(msg)
		h.Hub.Publish(realtime.Event{
			Type:    "chat.message",
			Room:    "chat:" + canalID.String(),
			OrgID:   orgID,
			Payload: payload,
		})
	}

	return c.Status(201).JSON(msg)
}

// ─── Solicitações ─────────────────────────────────────────────
func (h *Handler) UpdateSolicitacao(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	var dto models.UpdateSolicitacaoDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.Status != nil {
		allowed := map[string]bool{
			"nova": true, "em_atendimento": true, "aguardando_cliente": true,
			"resolvida": true, "fechada": true, "cancelada": true,
		}
		if !allowed[*dto.Status] {
			return badReq(c, "status inválido")
		}
	}
	if dto.Prioridade != nil {
		allowed := map[string]bool{"baixa": true, "media": true, "alta": true, "muito_alta": true}
		if !allowed[*dto.Prioridade] {
			return badReq(c, "prioridade inválida")
		}
	}

	s, err := h.Repo.UpdateSolicitacao(c.UserContext(), id, dto)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(s)
}

func (h *Handler) CreateSolicitacaoMensagem(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro (PATCH /me/current-org)")
	}
	userID := auth.MustUserID(c)

	var dto models.CreateSolicitacaoMensagemDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.Conteudo == "" {
		return badReq(c, "conteudo é obrigatório")
	}

	msg, err := h.Repo.CreateSolicitacaoMensagem(c.UserContext(), orgID, id, userID, dto)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.Status(201).JSON(msg)
}

// ─── Obrigações ───────────────────────────────────────────────
func (h *Handler) HerdarObrigacao(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro (PATCH /me/current-org)")
	}
	var dto models.HerdarObrigacaoDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.ObrigacaoID == uuid.Nil {
		return badReq(c, "obrigacao_id é obrigatório")
	}
	obr, err := h.Repo.HerdarObrigacao(c.UserContext(), orgID, dto.ObrigacaoID)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.Status(201).JSON(obr)
}

func (h *Handler) CreateObrigacaoEmpresa(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro (PATCH /me/current-org)")
	}
	var dto models.CreateObrigacaoEmpresaDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.ObrigacaoID == uuid.Nil || dto.EmpresaID == uuid.Nil {
		return badReq(c, "obrigacao_id e empresa_id são obrigatórios")
	}
	vinculo, err := h.Repo.CreateObrigacaoEmpresa(c.UserContext(), orgID, dto)
	if errors.Is(err, repo.ErrConflict) {
		return c.Status(409).JSON(fiber.Map{"error": "conflict", "message": "empresa já vinculada a esta obrigação"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.Status(201).JSON(vinculo)
}

func (h *Handler) DeleteObrigacaoEmpresa(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	if err := h.Repo.DeleteObrigacaoEmpresa(c.UserContext(), id); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return c.Status(404).JSON(fiber.Map{"error": "not_found"})
		}
		return internalErr(c, err)
	}
	return c.SendStatus(204)
}

// ─── Configurações da org ─────────────────────────────────────
func (h *Handler) ConvidarOrgMembro(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro (PATCH /me/current-org)")
	}
	userID := auth.MustUserID(c)
	var dto models.ConvidarMembroDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.Email == "" || dto.Role == "" {
		return badReq(c, "email e role são obrigatórios")
	}
	m, err := h.Repo.ConvidarOrgMembro(c.UserContext(), orgID, userID, dto)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "profile_not_found", "message": "usuário ainda não existe no Auth"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.Status(201).JSON(m)
}

func (h *Handler) UpdateOrgMembro(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	var dto models.UpdateMembroDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	m, err := h.Repo.UpdateOrgMembro(c.UserContext(), id, dto)
	if errors.Is(err, repo.ErrNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(m)
}

func (h *Handler) DeleteOrgMembro(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	if err := h.Repo.DeleteOrgMembro(c.UserContext(), id); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return c.Status(404).JSON(fiber.Map{"error": "not_found"})
		}
		return internalErr(c, err)
	}
	return c.SendStatus(204)
}

func (h *Handler) UpdateOrgConfiguracoes(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro (PATCH /me/current-org)")
	}
	var dto models.UpdateOrgConfiguracoesDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	cfg, err := h.Repo.UpdateOrgConfiguracoes(c.UserContext(), orgID, dto)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(cfg)
}

// ─── helpers ──────────────────────────────────────────────────
func badReq(c *fiber.Ctx, msg string) error {
	return c.Status(400).JSON(fiber.Map{"error": "bad_request", "message": msg})
}
func internalErr(c *fiber.Ctx, err error) error {
	return c.Status(500).JSON(fiber.Map{"error": "internal", "detail": err.Error()})
}
func splitCsv(s string) []string {
	out := []string{}
	cur := ""
	for _, r := range s {
		if r == ',' {
			if cur != "" {
				out = append(out, cur)
			}
			cur = ""
			continue
		}
		cur += string(r)
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}
