package handler

import (
	"bufio"
	"encoding/json"
	"strings"
	"time"

	"github.com/cecopel/api/internal/auth"
	"github.com/cecopel/api/internal/models"
	"github.com/cecopel/api/internal/repo"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func (h *Handler) CreateCortexConversa(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	userID := auth.MustUserID(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	var dto models.CreateCortexConversaDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	conv, err := h.Repo.CreateCortexConversa(c.UserContext(), orgID, userID, dto)
	if err != nil {
		return internalErr(c, err)
	}
	return c.Status(201).JSON(conv)
}

func (h *Handler) ListCortexConversas(c *fiber.Ctx) error {
	items, err := h.Repo.ListCortexConversas(c.UserContext())
	if err != nil {
		return internalErr(c, err)
	}
	if items == nil {
		items = []models.CortexConversa{}
	}
	return c.JSON(items)
}

func (h *Handler) GetCortexConversa(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	det, err := h.Repo.GetCortexConversa(c.UserContext(), id)
	if err == repo.ErrNotFound {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(det)
}

func (h *Handler) DeleteCortexConversa(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	if err := h.Repo.DeleteCortexConversa(c.UserContext(), id); err == repo.ErrNotFound {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	} else if err != nil {
		return internalErr(c, err)
	}
	return c.SendStatus(204)
}

func (h *Handler) CreateCortexMensagem(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	userID := auth.MustUserID(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	conversaID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	var dto models.CreateCortexMensagemDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	dto.Conteudo = strings.TrimSpace(dto.Conteudo)
	if dto.Conteudo == "" {
		return badReq(c, "conteudo é obrigatório")
	}
	count, plano, err := h.Repo.CortexRateCount(c.UserContext(), userID)
	if err != nil {
		return internalErr(c, err)
	}
	limit := 50
	if plano == "enterprise" {
		limit = 500
	}
	if count >= limit {
		return c.Status(429).JSON(fiber.Map{"error": "rate_limit", "limit": limit})
	}

	userMsg, err := h.Repo.InsertCortexMensagem(c.UserContext(), orgID, conversaID, "user", dto.Conteudo, nil)
	if err != nil {
		return internalErr(c, err)
	}

	// ── Cortex v4 — carrega contexto de memória ──
	// Buscamos as top memórias do user + org. Quando a integração com o
	// LLM real (TASK-061) entrar, esse bloco vai dentro de
	// <contexto_memoria>...</contexto_memoria> no system prompt.
	// Por enquanto fica como metadado na resposta para auditabilidade.
	contextoMemoria, _ := h.Repo.BuildContextoMemoria(c.UserContext(), orgID, userID)

	// ── Cortex v3 — detector de intenção de ação ──
	// Se a mensagem do user é um comando de escrita (ex.: "cria tarefa", "posta no mural"),
	// criamos uma ação pendente em vez de executar. O frontend renderiza um card
	// "Cortex quer fazer X — Confirmar/Cancelar".
	if ferramenta, args, resumo := repo.DetectarAcao(dto.Conteudo); ferramenta != "" {
		acao, err := h.Repo.CreateCortexAcao(c.UserContext(), orgID, userID, &conversaID, &userMsg.ID, ferramenta, args, resumo)
		if err != nil {
			return internalErr(c, err)
		}
		respostaProposta := "Para confirmar, clique no botão abaixo. Posso aguardar."
		assistantMsg, err := h.Repo.InsertCortexMensagem(c.UserContext(), orgID, conversaID, "assistant", respostaProposta, map[string]any{
			"acao_pendente_id": acao.ID.String(),
			"ferramenta":       ferramenta,
			"resumo":           resumo,
		})
		if err != nil {
			return internalErr(c, err)
		}
		c.Set("Content-Type", "text/event-stream")
		c.Set("Cache-Control", "no-cache")
		c.Set("Connection", "keep-alive")
		c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
			writeSSE(w, "acao_proposta", acao)
			for _, chunk := range chunkText(respostaProposta, 28) {
				writeSSE(w, "delta", fiber.Map{"texto": chunk})
				time.Sleep(45 * time.Millisecond)
			}
			writeSSE(w, "done", fiber.Map{"mensagem_id": assistantMsg.ID, "conversa_id": conversaID, "acao_id": acao.ID})
		})
		return nil
	}

	// Fluxo padrão (leitura): roda tool read-only e devolve resposta
	tool, resposta, err := h.Repo.RunCortexTool(c.UserContext(), orgID, userID, conversaID, dto.Conteudo)
	if err != nil {
		return internalErr(c, err)
	}
	toolMetadata := map[string]any{
		"ferramenta": tool.Ferramenta,
		"resumo":     tool.Resumo,
		"resultado":  tool.Resultado,
	}
	if contextoMemoria != "" {
		toolMetadata["contexto_memoria_usado"] = true
	}
	assistantMsg, err := h.Repo.InsertCortexMensagem(c.UserContext(), orgID, conversaID, "assistant", resposta, toolMetadata)
	if err != nil {
		return internalErr(c, err)
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		writeSSE(w, "tool", tool)
		for _, chunk := range chunkText(resposta, 28) {
			writeSSE(w, "delta", fiber.Map{"texto": chunk})
			time.Sleep(45 * time.Millisecond)
		}
		writeSSE(w, "done", fiber.Map{"mensagem_id": assistantMsg.ID, "conversa_id": conversaID})
	})
	return nil
}

func writeSSE(w *bufio.Writer, event string, data any) {
	raw, _ := json.Marshal(data)
	_, _ = w.WriteString("event: " + event + "\n")
	_, _ = w.WriteString("data: " + string(raw) + "\n\n")
	_ = w.Flush()
}

func chunkText(text string, size int) []string {
	if len(text) <= size {
		return []string{text}
	}
	var chunks []string
	words := strings.Fields(text)
	current := ""
	for _, word := range words {
		if len(current)+len(word)+1 > size && current != "" {
			chunks = append(chunks, current+" ")
			current = word
			continue
		}
		if current == "" {
			current = word
		} else {
			current += " " + word
		}
	}
	if current != "" {
		chunks = append(chunks, current)
	}
	return chunks
}
