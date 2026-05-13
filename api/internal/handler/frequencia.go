package handler

import (
	"github.com/cecopel/api/internal/auth"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type frequenciaDTO struct {
	Status          string  `json:"status"`
	HorarioChegada *string `json:"horario_chegada"`
	Justificativa   *string `json:"justificativa"`
}

func (h *Handler) ListFrequencia(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	competencia := c.Query("competencia")
	if competencia == "" { return badReq(c, "competencia é obrigatória") }
	out := []fiber.Map{}
	err := h.Repo.DB.WithTenant(c.UserContext(), func(tx pgx.Tx) error {
		rows, err := tx.Query(c.UserContext(), `
			SELECT m.user_id, COALESCE(p.nome, p.email, 'Colaborador') AS nome,
			       f.data, f.status::text, f.horario_chegada::text, f.minutos_atraso, f.justificativa
			FROM public.org_membros m
			LEFT JOIN public.profiles p ON p.id = m.user_id
			LEFT JOIN public.frequencia_diaria f ON f.org_id = m.org_id AND f.user_id = m.user_id AND to_char(f.data, 'YYYY-MM') = $2
			WHERE m.org_id = $1 AND m.status = 'ativo'
			ORDER BY nome, f.data
		`, orgID, competencia)
		if err != nil { return err }
		defer rows.Close()
		for rows.Next() {
			var userID uuid.UUID; var nome string; var data, status, hora, just *string; var atraso *int
			if err := rows.Scan(&userID, &nome, &data, &status, &hora, &atraso, &just); err != nil { return err }
			out = append(out, fiber.Map{"user_id": userID, "nome": nome, "data": data, "status": status, "horario_chegada": hora, "minutos_atraso": atraso, "justificativa": just})
		}
		return rows.Err()
	})
	if err != nil { return internalErr(c, err) }
	return c.JSON(out)
}

func (h *Handler) PatchFrequencia(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c); registradoPor := auth.MustUserID(c)
	userID, err := uuid.Parse(c.Params("user_id")); if err != nil { return badReq(c, "user_id inválido") }
	data := c.Params("data")
	var dto frequenciaDTO
	if err := c.BodyParser(&dto); err != nil { return badReq(c, "invalid_body") }
	if dto.Status == "" { dto.Status = "presente" }
	err = h.Repo.DB.WithTenant(c.UserContext(), func(tx pgx.Tx) error {
		_, err := tx.Exec(c.UserContext(), `
			INSERT INTO public.frequencia_diaria
			    (org_id, user_id, data, status, horario_chegada, minutos_atraso, justificativa, registrado_por_id)
			VALUES ($1,$2,$3::date,$4::app.frequencia_status,$5::time,
			        CASE WHEN $5::time > TIME '08:15' THEN EXTRACT(EPOCH FROM ($5::time - TIME '08:15'))::int / 60 ELSE 0 END,
			        $6,$7)
			ON CONFLICT (org_id, user_id, data) DO UPDATE SET
			    status = EXCLUDED.status,
			    horario_chegada = EXCLUDED.horario_chegada,
			    minutos_atraso = EXCLUDED.minutos_atraso,
			    justificativa = EXCLUDED.justificativa,
			    registrado_por_id = EXCLUDED.registrado_por_id,
			    updated_at = now()
		`, orgID, userID, data, dto.Status, dto.HorarioChegada, dto.Justificativa, registradoPor)
		return err
	})
	if err != nil { return c.Status(403).JSON(fiber.Map{"error": "frequencia_bloqueada", "detail": err.Error()}) }
	return c.SendStatus(204)
}

func (h *Handler) FecharMesFrequencia(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c); userID := auth.MustUserID(c)
	var dto struct{ Competencia string `json:"competencia"` }
	if err := c.BodyParser(&dto); err != nil { return badReq(c, "invalid_body") }
	err := h.Repo.DB.WithTenant(c.UserContext(), func(tx pgx.Tx) error {
		_, err := tx.Exec(c.UserContext(), `
			INSERT INTO public.frequencia_meses_fechados (org_id, competencia, fechado_por_id)
			VALUES ($1,$2,$3) ON CONFLICT (org_id, competencia) DO NOTHING
		`, orgID, dto.Competencia, userID)
		return err
	})
	if err != nil { return internalErr(c, err) }
	return c.SendStatus(204)
}
