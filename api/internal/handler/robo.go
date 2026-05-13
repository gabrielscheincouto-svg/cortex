// Handlers exclusivos do robô Tauri.
//
// Endpoints:
//   GET  /api/v1/robo/catalogo  → lista de obrigações da org com regex_arquivo
//   POST /api/v1/robo/heartbeat → registra/atualiza robo_hosts
//   POST /api/v1/robo/upload    → descontinuado; usar /uploads/preparar + confirmar
package handler

import (
	"github.com/cecopel/api/internal/auth"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ─── GET /api/v1/robo/catalogo ────────────────────────────────
// Retorna o catálogo de obrigações DA ORG do user (current_org_id) que têm regex_arquivo.
// O robô usa para construir o matcher local.
func (h *Handler) RoboCatalogo(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}

	type Item struct {
		ID            uuid.UUID `json:"id"`
		Codigo        string    `json:"codigo"`
		Nome          string    `json:"nome"`
		Departamento  string    `json:"departamento"`
		RegexArquivo  *string   `json:"regex_arquivo"`
		ParserTipo    *string   `json:"parser_tipo"`
	}

	out := []Item{}
	err := h.Repo.DB.WithTenant(c.UserContext(), func(tx pgx.Tx) error {
		const q = `
			SELECT id, codigo, nome, departamento::text, regex_arquivo, parser_tipo
			FROM public.obrigacoes_catalogo
			WHERE (org_id = $1 OR org_id IS NULL)
			  AND ativa = TRUE
			  AND robo_processa = TRUE
			  AND regex_arquivo IS NOT NULL
			ORDER BY codigo
		`
		rows, err := tx.Query(c.UserContext(), q, orgID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var it Item
			if err := rows.Scan(&it.ID, &it.Codigo, &it.Nome, &it.Departamento, &it.RegexArquivo, &it.ParserTipo); err != nil {
				return err
			}
			out = append(out, it)
		}
		return rows.Err()
	})
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(out)
}

// ─── POST /api/v1/robo/heartbeat ──────────────────────────────
type heartbeatDTO struct {
	Hostname            string  `json:"hostname"`
	VersaoRobo          string  `json:"versao_robo"`
	SistemaOperacional  string  `json:"sistema_operacional"`
	PastaMonitorada     *string `json:"pasta_monitorada"`
}

func (h *Handler) RoboHeartbeat(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	userID := auth.MustUserID(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org")
	}

	var dto heartbeatDTO
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.Hostname == "" {
		return badReq(c, "hostname é obrigatório")
	}

	err := h.Repo.DB.WithTenant(c.UserContext(), func(tx pgx.Tx) error {
		const q = `
			INSERT INTO public.robo_hosts
			    (org_id, user_id, hostname, sistema_operacional, versao_app, pasta_monitorada, ultimo_heartbeat_at, ativo)
			VALUES ($1, $2, $3, $4, $5, $6, now(), TRUE)
			ON CONFLICT (org_id, hostname) DO UPDATE SET
			    user_id = EXCLUDED.user_id,
			    sistema_operacional = EXCLUDED.sistema_operacional,
			    versao_app = EXCLUDED.versao_app,
			    pasta_monitorada = COALESCE(EXCLUDED.pasta_monitorada, public.robo_hosts.pasta_monitorada),
			    ultimo_heartbeat_at = now(),
			    ativo = TRUE
		`
		_, err := tx.Exec(c.UserContext(), q,
			orgID, userID, dto.Hostname, dto.SistemaOperacional, dto.VersaoRobo, dto.PastaMonitorada,
		)
		return err
	})
	if err != nil {
		return internalErr(c, err)
	}
	return c.SendStatus(204)
}

// ─── POST /api/v1/robo/upload ─────────────────────────────────
type uploadMetadata struct {
	ObrigacaoCodigo string  `json:"obrigacao_codigo"`
	ObrigacaoID     string  `json:"obrigacao_id"`
	CnpjExtraido    *string `json:"cnpj_extraido"`
	Competencia     *string `json:"competencia"`
	ParserTipo      *string `json:"parser_tipo"`
	Hostname        string  `json:"hostname"`
	SHA256          string  `json:"sha256"`
	TamanhoBytes    int64   `json:"tamanho_bytes"`
	VersaoRobo      string  `json:"versao_robo"`
}

type uploadResponse struct {
	EntregaID string `json:"entrega_id"`
	ArquivoID string `json:"arquivo_id"`
	Status    string `json:"status"`
}

func (h *Handler) RoboUpload(c *fiber.Ctx) error {
	return c.Status(fiber.StatusGone).JSON(fiber.Map{
		"error":   "endpoint_descontinuado",
		"message": "endpoint descontinuado, use /uploads/preparar + /uploads/:id/confirmar",
	})
}
