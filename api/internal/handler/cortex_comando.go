// Handler de comando single-shot do Cortex Quick.
// Diferente do /cortex/conversas/:id/mensagens, este NÃO cria conversa
// e NÃO faz streaming SSE: só detecta intenção e devolve a ação proposta
// (ou null se não for um comando de escrita).
package handler

import (
	"strings"

	"github.com/cecopel/api/internal/auth"
	"github.com/cecopel/api/internal/repo"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type cortexComandoDTO struct {
	Texto string `json:"texto"`
}

// POST /api/v1/cortex/comando
// Body: { texto: "cria tarefa: revisar DCTFWeb" }
// Resposta:
//   - 200 com `acao` (ação pendente criada) → frontend renderiza card
//   - 200 com `acao: null` se nada combinou → frontend mostra "abra o Cortex pra conversar"
func (h *Handler) CortexComando(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	userID := auth.MustUserID(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}
	var dto cortexComandoDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	texto := strings.TrimSpace(dto.Texto)
	if texto == "" {
		return badReq(c, "texto é obrigatório")
	}

	ferramenta, args, resumo := repo.DetectarAcao(texto)
	if ferramenta == "" {
		return c.JSON(fiber.Map{"acao": nil, "texto_original": texto})
	}
	acao, err := h.Repo.CreateCortexAcao(c.UserContext(), orgID, userID, nil, nil, ferramenta, args, resumo)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(fiber.Map{"acao": acao, "texto_original": texto})
}
