package handler

import (
	"github.com/cecopel/api/internal/auth"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type kanbanTarefaDTO struct {
	Titulo           string     `json:"titulo"`
	Descricao        *string    `json:"descricao"`
	Departamento     *string    `json:"departamento"`
	Prioridade       *string    `json:"prioridade"`
	Status           *string    `json:"status"`
	ResponsavelID    *uuid.UUID `json:"responsavel_id"`
	CoResponsavelID  *uuid.UUID `json:"co_responsavel_id"`
	Prazo            *string    `json:"prazo"`
}

func (h *Handler) ListKanbanTarefas(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	out := []fiber.Map{}
	err := h.Repo.DB.WithTenant(c.UserContext(), func(tx pgx.Tx) error {
		rows, err := tx.Query(c.UserContext(), `
			SELECT id, titulo, descricao, departamento::text, prioridade::text, status::text,
			       responsavel_id, co_responsavel_id, prazo, created_at
			FROM public.kanban_tarefas
			WHERE org_id = $1
			ORDER BY prazo NULLS LAST, created_at DESC
		`, orgID)
		if err != nil { return err }
		defer rows.Close()
		for rows.Next() {
			var id uuid.UUID; var titulo string; var desc, dept, prio, status *string; var resp, co *uuid.UUID; var prazo any; var created any
			if err := rows.Scan(&id, &titulo, &desc, &dept, &prio, &status, &resp, &co, &prazo, &created); err != nil { return err }
			out = append(out, fiber.Map{"id": id, "titulo": titulo, "descricao": desc, "departamento": dept, "prioridade": prio, "status": status, "responsavel_id": resp, "co_responsavel_id": co, "prazo": prazo, "created_at": created})
		}
		return rows.Err()
	})
	if err != nil { return internalErr(c, err) }
	return c.JSON(out)
}

func (h *Handler) CreateKanbanTarefa(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c); userID := auth.MustUserID(c)
	var dto kanbanTarefaDTO
	if err := c.BodyParser(&dto); err != nil { return badReq(c, "invalid_body") }
	if dto.Titulo == "" { return badReq(c, "titulo é obrigatório") }
	var id uuid.UUID
	err := h.Repo.DB.WithTenant(c.UserContext(), func(tx pgx.Tx) error {
		return tx.QueryRow(c.UserContext(), `
			INSERT INTO public.kanban_tarefas
			    (org_id, titulo, descricao, departamento, prioridade, responsavel_id, co_responsavel_id, prazo, criada_por_id)
			VALUES ($1,$2,$3,$4::app.departamento,COALESCE($5,'media')::app.kanban_prioridade,$6,$7,$8::date,$9)
			RETURNING id
		`, orgID, dto.Titulo, dto.Descricao, dto.Departamento, dto.Prioridade, dto.ResponsavelID, dto.CoResponsavelID, dto.Prazo, userID).Scan(&id)
	})
	if err != nil { return internalErr(c, err) }
	return c.Status(201).JSON(fiber.Map{"id": id})
}

func (h *Handler) UpdateKanbanTarefa(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id")); if err != nil { return badReq(c, "id inválido") }
	var dto kanbanTarefaDTO
	if err := c.BodyParser(&dto); err != nil { return badReq(c, "invalid_body") }
	err = h.Repo.DB.WithTenant(c.UserContext(), func(tx pgx.Tx) error {
		_, err := tx.Exec(c.UserContext(), `
			UPDATE public.kanban_tarefas
			SET titulo = COALESCE(NULLIF($2,''), titulo),
			    descricao = COALESCE($3, descricao),
			    status = COALESCE($4::app.kanban_status, status),
			    prioridade = COALESCE($5::app.kanban_prioridade, prioridade),
			    responsavel_id = COALESCE($6, responsavel_id),
			    co_responsavel_id = COALESCE($7, co_responsavel_id),
			    prazo = COALESCE($8::date, prazo),
			    concluido_em = CASE WHEN $4 = 'concluido' THEN now() ELSE concluido_em END,
			    updated_at = now()
			WHERE id = $1
		`, id, dto.Titulo, dto.Descricao, dto.Status, dto.Prioridade, dto.ResponsavelID, dto.CoResponsavelID, dto.Prazo)
		return err
	})
	if err != nil { return internalErr(c, err) }
	return c.SendStatus(204)
}

func (h *Handler) DeleteKanbanTarefa(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id")); if err != nil { return badReq(c, "id inválido") }
	err = h.Repo.DB.WithTenant(c.UserContext(), func(tx pgx.Tx) error { _, err := tx.Exec(c.UserContext(), `DELETE FROM public.kanban_tarefas WHERE id=$1`, id); return err })
	if err != nil { return internalErr(c, err) }
	return c.SendStatus(204)
}
