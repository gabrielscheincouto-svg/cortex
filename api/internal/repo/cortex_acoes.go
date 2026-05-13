// Cortex v3 — agente que age. Propõe ações de escrita (criar tarefa, mudar status,
// postar mural, lançar pontos) e só executa quando o usuário confirma via UI.
package repo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ─── Tipos ─────────────────────────────────────────────────────────────────

type CortexAcaoPendente struct {
	ID             uuid.UUID              `json:"id"`
	OrgID          uuid.UUID              `json:"org_id"`
	UserID         uuid.UUID              `json:"user_id"`
	ConversaID     *uuid.UUID             `json:"conversa_id,omitempty"`
	MensagemID     *uuid.UUID             `json:"mensagem_id,omitempty"`
	Ferramenta     string                 `json:"ferramenta"`
	Args           map[string]any         `json:"args"`
	Resumo         string                 `json:"resumo"`
	Status         string                 `json:"status"`
	Resultado      map[string]any         `json:"resultado,omitempty"`
	Erro           *string                `json:"erro,omitempty"`
	ExpiraEm       time.Time              `json:"expira_em"`
	ConfirmadaEm   *time.Time             `json:"confirmada_em,omitempty"`
	CanceladaEm    *time.Time             `json:"cancelada_em,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
}

// ─── Detector de intenção de ação ──────────────────────────────────────────

// DetectarAcao analisa o texto do user e retorna (ferramenta, args, resumo)
// SE for um comando de ação. Caso contrário, retorna ferramenta vazio.
//
// Não é IA real ainda — é matching por padrão. TASK-061 vai trocar isso por
// classificação via Claude com tool-calling estruturado.
func DetectarAcao(pergunta string) (ferramenta string, args map[string]any, resumo string) {
	p := strings.ToLower(strings.TrimSpace(pergunta))

	// criar tarefa
	if rx := regexp.MustCompile(`(?i)(cria(?:r)?|cri[ae]|adiciona(?:r)?|nova) (?:uma )?tarefa[:\s]*(.+)`).FindStringSubmatch(pergunta); len(rx) > 0 {
		titulo := strings.TrimSpace(rx[2])
		return "criar_tarefa_kanban",
			map[string]any{"titulo": titulo, "prioridade": "media"},
			fmt.Sprintf("Criar tarefa no Kanban: %q", titulo)
	}
	// poste no mural / postar mural
	if rx := regexp.MustCompile(`(?i)(post(?:e|ar|a)?|publi(?:que|car|ca)?)\s+(?:um aviso )?no mural[:\s]*(.+)`).FindStringSubmatch(pergunta); len(rx) > 0 {
		conteudo := strings.TrimSpace(rx[2])
		return "postar_mural",
			map[string]any{"conteudo": conteudo, "categoria": "aviso", "fixado": false},
			fmt.Sprintf("Publicar no mural: %q", truncate(conteudo, 80))
	}
	// marcar entrega como entregue
	if strings.Contains(p, "marca") && strings.Contains(p, "entreg") && strings.Contains(p, "entrega") {
		// caso "marca como entregue a entrega <id>" ou "marca a entrega <id> como entregue"
		if id := uuidNoTexto(pergunta); id != uuid.Nil {
			return "mudar_status_entrega",
				map[string]any{"entrega_id": id.String(), "novo_status": "entregue"},
				fmt.Sprintf("Marcar entrega %s como ENTREGUE", id.String()[:8])
		}
	}
	// lançar X pontos para Y
	if rx := regexp.MustCompile(`(?i)(?:lan[çc]a(?:r)?|adicion(?:e|ar|a)) ([+-]?\d+) pontos? (?:para|pra|ao|à|a) (.+)`).FindStringSubmatch(pergunta); len(rx) > 0 {
		return "lancar_pontos_manual",
			map[string]any{"pontos": rx[1], "destinatario_busca": strings.TrimSpace(rx[2])},
			fmt.Sprintf("Lançar %s pontos para %s", rx[1], strings.TrimSpace(rx[2]))
	}
	// lembrar fato: ancorado no início. "lembre que ...", "anote ...", "guarde que ..."
	if rx := regexp.MustCompile(`(?i)^(?:lembre|lembra|lembre-se|anote|guarde|guarda)\s+(?:que\s+)?(.+)`).FindStringSubmatch(strings.TrimSpace(pergunta)); len(rx) > 0 {
		fato := strings.TrimSpace(rx[1])
		tipo := inferirTipoMemoria(fato)
		escopoOrg := false
		// Se a frase começa com "para o escritório", "para a equipe", "a org..." marca como org
		lc := strings.ToLower(fato)
		if strings.HasPrefix(lc, "para o escritório") || strings.HasPrefix(lc, "para a equipe") ||
			strings.HasPrefix(lc, "para o time") || strings.Contains(lc, "no escritório inteiro") {
			escopoOrg = true
		}
		args := map[string]any{"fato": fato, "tipo": tipo, "escopo_org": escopoOrg}
		alvo := "para você"
		if escopoOrg {
			alvo = "para o escritório"
		}
		return "lembrar_fato", args,
			fmt.Sprintf("Lembrar %s: %q", alvo, truncate(fato, 90))
	}
	// esquecer fato: ancorado. "esqueça que ...", "esquece ..."
	if rx := regexp.MustCompile(`(?i)^(?:esque[çc]a|esquece)\s+(?:que\s+)?(.+)`).FindStringSubmatch(strings.TrimSpace(pergunta)); len(rx) > 0 {
		fato := strings.TrimSpace(rx[1])
		return "esquecer_fato",
			map[string]any{"busca": fato},
			fmt.Sprintf("Esquecer memória que combine com: %q", truncate(fato, 80))
	}
	_ = p
	return "", nil, ""
}

// inferirTipoMemoria escolhe o tipo da memória a partir do texto.
// Heurística simples baseada em palavras-chave; serve como default —
// o user pode reclassificar depois no painel de memórias.
func inferirTipoMemoria(fato string) string {
	lc := strings.ToLower(fato)
	switch {
	case strings.Contains(lc, "prefiro") || strings.Contains(lc, "prefere") ||
		strings.Contains(lc, "gosto") || strings.Contains(lc, "padrão"):
		return "preferencia"
	case strings.Contains(lc, "sempre") || strings.Contains(lc, "toda ") ||
		strings.Contains(lc, "todo ") || strings.Contains(lc, "rotina") ||
		strings.Contains(lc, "regularmente"):
		return "rotina"
	case strings.Contains(lc, "chama") || strings.Contains(lc, "uso ") ||
		strings.Contains(lc, "usamos") || strings.Contains(lc, "termo"):
		return "terminologia"
	case strings.Contains(lc, "férias") || strings.Contains(lc, "ausência") ||
		strings.Contains(lc, "até ") || strings.Contains(lc, "essa semana") ||
		strings.Contains(lc, "este mês"):
		return "contexto_temporario"
	case strings.Contains(lc, "cliente"):
		return "cliente_chave"
	case strings.Contains(lc, "escritório") || strings.Contains(lc, "equipe") || strings.Contains(lc, "time"):
		return "fato_org"
	default:
		return "fato_user"
	}
}

func uuidNoTexto(s string) uuid.UUID {
	rx := regexp.MustCompile(`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`)
	if m := rx.FindString(s); m != "" {
		if id, err := uuid.Parse(m); err == nil {
			return id
		}
	}
	return uuid.Nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

// CreateCortexAcao cria uma ação pendente (proposta). Não executa nada ainda.
func (r *Repo) CreateCortexAcao(ctx context.Context, orgID, userID uuid.UUID, conversaID, mensagemID *uuid.UUID, ferramenta string, args map[string]any, resumo string) (*CortexAcaoPendente, error) {
	if args == nil {
		args = map[string]any{}
	}
	rawArgs, _ := json.Marshal(args)
	a := &CortexAcaoPendente{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		var rawArgsOut, rawResultadoOut any
		return tx.QueryRow(ctx, `
			INSERT INTO public.cortex_acoes_pendentes
			    (org_id, user_id, conversa_id, mensagem_id, ferramenta, args, resumo)
			VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
			RETURNING id, org_id, user_id, conversa_id, mensagem_id, ferramenta,
			          args, resumo, status::text, resultado, erro,
			          expira_em, confirmada_em, cancelada_em, created_at
		`, orgID, userID, conversaID, mensagemID, ferramenta, rawArgs, resumo).Scan(
			&a.ID, &a.OrgID, &a.UserID, &a.ConversaID, &a.MensagemID, &a.Ferramenta,
			&rawArgsOut, &a.Resumo, &a.Status, &rawResultadoOut, &a.Erro,
			&a.ExpiraEm, &a.ConfirmadaEm, &a.CanceladaEm, &a.CreatedAt,
		)
		a.Args = decodeJSONB(rawArgsOut)
		a.Resultado = decodeJSONB(rawResultadoOut)
		return nil
	})
	return a, err
}

func (r *Repo) ListCortexAcoesPendentes(ctx context.Context, orgID, userID uuid.UUID) ([]CortexAcaoPendente, error) {
	out := []CortexAcaoPendente{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT id, org_id, user_id, conversa_id, mensagem_id, ferramenta,
			       args, resumo, status::text, resultado, erro,
			       expira_em, confirmada_em, cancelada_em, created_at
			FROM public.cortex_acoes_pendentes
			WHERE org_id = $1 AND user_id = $2 AND status = 'pendente'
			  AND expira_em > now()
			ORDER BY created_at DESC
			LIMIT 50
		`, orgID, userID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			a := CortexAcaoPendente{}
			var rawArgs, rawResultado any
			if err := rows.Scan(&a.ID, &a.OrgID, &a.UserID, &a.ConversaID, &a.MensagemID, &a.Ferramenta,
				&rawArgs, &a.Resumo, &a.Status, &rawResultado, &a.Erro,
				&a.ExpiraEm, &a.ConfirmadaEm, &a.CanceladaEm, &a.CreatedAt); err != nil {
				return err
			}
			a.Args = decodeJSONB(rawArgs)
			a.Resultado = decodeJSONB(rawResultado)
			out = append(out, a)
		}
		return rows.Err()
	})
	return out, err
}

// ConfirmarCortexAcao executa a ação proposta.
func (r *Repo) ConfirmarCortexAcao(ctx context.Context, acaoID, userID uuid.UUID) (*CortexAcaoPendente, error) {
	// Busca a ação pendente
	a := &CortexAcaoPendente{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		var rawArgs, rawResultado any
		err := tx.QueryRow(ctx, `
			SELECT id, org_id, user_id, conversa_id, mensagem_id, ferramenta,
			       args, resumo, status::text, resultado, erro,
			       expira_em, confirmada_em, cancelada_em, created_at
			FROM public.cortex_acoes_pendentes WHERE id = $1
		`, acaoID).Scan(&a.ID, &a.OrgID, &a.UserID, &a.ConversaID, &a.MensagemID, &a.Ferramenta,
			&rawArgs, &a.Resumo, &a.Status, &rawResultado, &a.Erro,
			&a.ExpiraEm, &a.ConfirmadaEm, &a.CanceladaEm, &a.CreatedAt)
		if err != nil {
			return err
		}
		a.Args = decodeJSONB(rawArgs)
		if a.Status != "pendente" {
			return fmt.Errorf("acao_nao_pendente: status atual é %s", a.Status)
		}
		if a.UserID != userID {
			return fmt.Errorf("acao_de_outro_user")
		}
		if a.ExpiraEm.Before(time.Now()) {
			return fmt.Errorf("acao_expirada")
		}

		// Valida permissão da ferramenta para esse user
		permitida, err := r.cortexFerramentaPermitida(ctx, tx, a.OrgID, userID, a.Ferramenta)
		if err != nil {
			return err
		}
		if !permitida {
			return fmt.Errorf("acao_nao_permitida: ferramenta %s bloqueada para esse usuário", a.Ferramenta)
		}

		// Executa a ação
		resultado, execErr := r.executarFerramenta(ctx, tx, a.OrgID, userID, a.Ferramenta, a.Args)
		rawResult, _ := json.Marshal(resultado)

		if execErr != nil {
			erroMsg := execErr.Error()
			_, _ = tx.Exec(ctx, `
				UPDATE public.cortex_acoes_pendentes
				SET status = 'falhou', erro = $2, resultado = $3::jsonb
				WHERE id = $1
			`, acaoID, erroMsg, rawResult)
			a.Status = "falhou"
			a.Erro = &erroMsg
			a.Resultado = resultado
			return execErr
		}

		_, err = tx.Exec(ctx, `
			UPDATE public.cortex_acoes_pendentes
			SET status = 'confirmada', confirmada_em = now(), resultado = $2::jsonb
			WHERE id = $1
		`, acaoID, rawResult)
		if err != nil {
			return err
		}
		a.Status = "confirmada"
		now := time.Now()
		a.ConfirmadaEm = &now
		a.Resultado = resultado
		return nil
	})
	return a, err
}

func (r *Repo) CancelarCortexAcao(ctx context.Context, acaoID, userID uuid.UUID) error {
	return r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		ct, err := tx.Exec(ctx, `
			UPDATE public.cortex_acoes_pendentes
			SET status = 'cancelada', cancelada_em = now()
			WHERE id = $1 AND user_id = $2 AND status = 'pendente'
		`, acaoID, userID)
		if err != nil {
			return err
		}
		if ct.RowsAffected() == 0 {
			return errors.New("acao_nao_encontrada_ou_ja_processada")
		}
		return nil
	})
}

// ─── Execução das ferramentas de escrita ───────────────────────────────────

func (r *Repo) executarFerramenta(ctx context.Context, tx pgx.Tx, orgID, userID uuid.UUID, ferramenta string, args map[string]any) (map[string]any, error) {
	switch ferramenta {
	case "criar_tarefa_kanban":
		return r.execCriarTarefa(ctx, tx, orgID, userID, args)
	case "mudar_status_entrega":
		return r.execMudarStatusEntrega(ctx, tx, orgID, userID, args)
	case "postar_mural":
		return r.execPostarMural(ctx, tx, orgID, userID, args)
	case "lancar_pontos_manual":
		return r.execLancarPontosManual(ctx, tx, orgID, userID, args)
	case "responder_solicitacao":
		return r.execResponderSolicitacao(ctx, tx, orgID, userID, args)
	case "lembrar_fato":
		return r.execLembrarFato(ctx, tx, orgID, userID, args)
	case "esquecer_fato":
		return r.execEsquecerFato(ctx, tx, orgID, userID, args)
	default:
		return nil, fmt.Errorf("ferramenta_desconhecida: %s", ferramenta)
	}
}

// execLembrarFato grava uma memória do user (ou da org se escopo_org=true).
// Roda dentro da mesma tx da confirmação — RLS aplica.
func (r *Repo) execLembrarFato(ctx context.Context, tx pgx.Tx, orgID, userID uuid.UUID, args map[string]any) (map[string]any, error) {
	fato, _ := args["fato"].(string)
	if strings.TrimSpace(fato) == "" {
		return nil, errors.New("fato_obrigatorio")
	}
	tipo, _ := args["tipo"].(string)
	if tipo == "" {
		tipo = "fato_user"
	}
	escopoOrg, _ := args["escopo_org"].(bool)
	var ownerID *uuid.UUID
	if !escopoOrg {
		ownerID = &userID
	}
	var id uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO public.cortex_memorias (org_id, user_id, tipo, fato, confianca)
		VALUES ($1, $2, $3::app.cortex_memoria_tipo, $4, 0.80)
		RETURNING id
	`, orgID, ownerID, tipo, strings.TrimSpace(fato)).Scan(&id)
	if err != nil {
		return nil, err
	}
	return map[string]any{"memoria_id": id.String(), "tipo": tipo, "escopo_org": escopoOrg}, nil
}

// execEsquecerFato arquiva memórias do user que combinem com a busca.
// Usa ILIKE no campo fato. Se nada combinar, retorna erro.
func (r *Repo) execEsquecerFato(ctx context.Context, tx pgx.Tx, orgID, userID uuid.UUID, args map[string]any) (map[string]any, error) {
	busca, _ := args["busca"].(string)
	if strings.TrimSpace(busca) == "" {
		return nil, errors.New("busca_obrigatoria")
	}
	ct, err := tx.Exec(ctx, `
		UPDATE public.cortex_memorias
		SET arquivada = TRUE
		WHERE org_id = $1
		  AND (user_id = $2 OR user_id IS NULL)
		  AND arquivada = FALSE
		  AND fato ILIKE '%' || $3 || '%'
	`, orgID, userID, strings.TrimSpace(busca))
	if err != nil {
		return nil, err
	}
	affected := ct.RowsAffected()
	if affected == 0 {
		return nil, fmt.Errorf("nenhuma_memoria_combina: %q", busca)
	}
	return map[string]any{"arquivadas": affected}, nil
}

func (r *Repo) execCriarTarefa(ctx context.Context, tx pgx.Tx, orgID, userID uuid.UUID, args map[string]any) (map[string]any, error) {
	titulo, _ := args["titulo"].(string)
	if titulo == "" {
		return nil, errors.New("titulo_obrigatorio")
	}
	descricao, _ := args["descricao"].(string)
	prioridade := stringDefault(args, "prioridade", "media")
	var id uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO public.kanban_tarefas
		    (org_id, titulo, descricao, prioridade, criada_por_id, responsavel_id)
		VALUES ($1, $2, $3, $4::app.kanban_prioridade, $5, $5)
		RETURNING id
	`, orgID, titulo, nullIfEmpty(descricao), prioridade, userID).Scan(&id)
	if err != nil {
		return nil, err
	}
	return map[string]any{"tarefa_id": id.String(), "titulo": titulo}, nil
}

func (r *Repo) execMudarStatusEntrega(ctx context.Context, tx pgx.Tx, orgID, userID uuid.UUID, args map[string]any) (map[string]any, error) {
	entregaIDStr, _ := args["entrega_id"].(string)
	novoStatus, _ := args["novo_status"].(string)
	if entregaIDStr == "" || novoStatus == "" {
		return nil, errors.New("entrega_id_e_status_obrigatorios")
	}
	entregaID, err := uuid.Parse(entregaIDStr)
	if err != nil {
		return nil, errors.New("entrega_id_invalido")
	}
	_, err = tx.Exec(ctx, `
		UPDATE public.entregas
		SET status = $2::app.entrega_status,
		    entregue_em = CASE WHEN $2 = 'entregue' THEN now() ELSE entregue_em END,
		    entregue_por_id = CASE WHEN $2 = 'entregue' THEN $3 ELSE entregue_por_id END,
		    updated_at = now()
		WHERE id = $1 AND org_id = $4
	`, entregaID, novoStatus, userID, orgID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"entrega_id": entregaIDStr, "novo_status": novoStatus}, nil
}

func (r *Repo) execPostarMural(ctx context.Context, tx pgx.Tx, orgID, userID uuid.UUID, args map[string]any) (map[string]any, error) {
	conteudo, _ := args["conteudo"].(string)
	if conteudo == "" {
		return nil, errors.New("conteudo_obrigatorio")
	}
	categoria := stringDefault(args, "categoria", "aviso")
	fixado, _ := args["fixado"].(bool)
	var id uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO public.mural_posts (org_id, autor_tipo, autor_id, categoria, conteudo, fixado)
		VALUES ($1, 'humano', $2, $3::app.mural_categoria, $4, $5)
		RETURNING id
	`, orgID, userID, categoria, conteudo, fixado).Scan(&id)
	if err != nil {
		return nil, err
	}
	return map[string]any{"post_id": id.String()}, nil
}

func (r *Repo) execLancarPontosManual(ctx context.Context, tx pgx.Tx, orgID, userID uuid.UUID, args map[string]any) (map[string]any, error) {
	pontosStr := fmt.Sprintf("%v", args["pontos"])
	var pontos int
	if _, err := fmt.Sscanf(pontosStr, "%d", &pontos); err != nil {
		return nil, errors.New("pontos_invalidos")
	}
	if pontos == 0 {
		return nil, errors.New("pontos_zero")
	}

	// Resolver destinatário: user_id direto OU busca por nome
	var destinatarioID uuid.UUID
	if did, ok := args["user_id"].(string); ok && did != "" {
		if parsed, err := uuid.Parse(did); err == nil {
			destinatarioID = parsed
		}
	}
	if destinatarioID == uuid.Nil {
		busca, _ := args["destinatario_busca"].(string)
		if busca == "" {
			return nil, errors.New("destinatario_obrigatorio")
		}
		err := tx.QueryRow(ctx, `
			SELECT m.user_id FROM public.org_membros m
			JOIN public.profiles p ON p.id = m.user_id
			WHERE m.org_id = $1 AND m.status = 'ativo'
			  AND (p.nome ILIKE '%' || $2 || '%' OR p.email ILIKE '%' || $2 || '%')
			LIMIT 1
		`, orgID, busca).Scan(&destinatarioID)
		if err != nil {
			return nil, fmt.Errorf("destinatario_nao_encontrado: %s", busca)
		}
	}

	justificativa := stringDefault(args, "justificativa", "Lançado via Cortex IA")
	_, err := tx.Exec(ctx, `
		INSERT INTO public.pontos_eventos (org_id, user_id, evento, pontos, justificativa, criado_por_id)
		VALUES ($1, $2, 'ajuste_manual', $3, $4, $5)
	`, orgID, destinatarioID, pontos, justificativa, userID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"destinatario_id": destinatarioID.String(), "pontos": pontos}, nil
}

func (r *Repo) execResponderSolicitacao(ctx context.Context, tx pgx.Tx, orgID, userID uuid.UUID, args map[string]any) (map[string]any, error) {
	solIDStr, _ := args["solicitacao_id"].(string)
	mensagem, _ := args["mensagem"].(string)
	if solIDStr == "" || mensagem == "" {
		return nil, errors.New("solicitacao_id_e_mensagem_obrigatorios")
	}
	solID, err := uuid.Parse(solIDStr)
	if err != nil {
		return nil, errors.New("solicitacao_id_invalido")
	}
	interna, _ := args["interna"].(bool)
	var msgID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO public.solicitacao_mensagens (org_id, solicitacao_id, autor_id, autor_tipo, conteudo, interna)
		VALUES ($1, $2, $3, 'escritorio', $4, $5)
		RETURNING id
	`, orgID, solID, userID, mensagem, interna).Scan(&msgID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"mensagem_id": msgID.String()}, nil
}

// ─── Helper: verifica permissão da ferramenta ──────────────────────────────

func (r *Repo) cortexFerramentaPermitida(ctx context.Context, tx pgx.Tx, orgID, userID uuid.UUID, ferramenta string) (bool, error) {
	var permitida bool
	var rolesPermitidas []string
	err := tx.QueryRow(ctx, `
		SELECT permitida, roles_permitidas
		FROM public.cortex_permissoes_org
		WHERE org_id = $1 AND ferramenta = $2
	`, orgID, ferramenta).Scan(&permitida, &rolesPermitidas)
	if errors.Is(err, pgx.ErrNoRows) {
		return true, nil // default: permitido se não há config explícita
	}
	if err != nil {
		return false, err
	}
	if !permitida {
		return false, nil
	}
	if len(rolesPermitidas) == 0 {
		return true, nil
	}
	// Checa o role do user
	var userRole string
	err = tx.QueryRow(ctx, `
		SELECT role::text FROM public.org_membros
		WHERE org_id = $1 AND user_id = $2 AND status = 'ativo' LIMIT 1
	`, orgID, userID).Scan(&userRole)
	if err != nil {
		return false, err
	}
	for _, r := range rolesPermitidas {
		if r == userRole {
			return true, nil
		}
	}
	return false, nil
}

// ─── helpers locais ────────────────────────────────────────────────────────

func decodeJSONB(raw any) map[string]any {
	if raw == nil {
		return nil
	}
	var b []byte
	switch v := raw.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	default:
		return nil
	}
	var out map[string]any
	_ = json.Unmarshal(b, &out)
	return out
}

func stringDefault(args map[string]any, key, def string) string {
	if v, ok := args[key].(string); ok && v != "" {
		return v
	}
	return def
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// ─── Permissões por org ────────────────────────────────────────────────────

type CortexPermissaoOrg struct {
	ID              uuid.UUID `json:"id"`
	OrgID           uuid.UUID `json:"org_id"`
	Ferramenta      string    `json:"ferramenta"`
	Permitida       bool      `json:"permitida"`
	RolesPermitidas []string  `json:"roles_permitidas"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (r *Repo) ListCortexPermissoes(ctx context.Context, orgID uuid.UUID) ([]CortexPermissaoOrg, error) {
	out := []CortexPermissaoOrg{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT id, org_id, ferramenta, permitida, COALESCE(roles_permitidas, '{}'::text[]), updated_at
			FROM public.cortex_permissoes_org
			WHERE org_id = $1
			ORDER BY ferramenta
		`, orgID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			p := CortexPermissaoOrg{}
			if err := rows.Scan(&p.ID, &p.OrgID, &p.Ferramenta, &p.Permitida, &p.RolesPermitidas, &p.UpdatedAt); err != nil {
				return err
			}
			out = append(out, p)
		}
		return rows.Err()
	})
	return out, err
}

// UpdateCortexPermissao atualiza ou insere uma permissão para a ferramenta.
// Se `permitida` ou `rolesPermitidas` forem nil, mantém o valor atual.
func (r *Repo) UpdateCortexPermissao(ctx context.Context, orgID uuid.UUID, ferramenta string, permitida *bool, rolesPermitidas []string) (*CortexPermissaoOrg, error) {
	p := &CortexPermissaoOrg{}
	err := r.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		// Upsert
		_, err := tx.Exec(ctx, `
			INSERT INTO public.cortex_permissoes_org (org_id, ferramenta, permitida, roles_permitidas, updated_at)
			VALUES ($1, $2, COALESCE($3, TRUE), $4::app.org_membro_role[], now())
			ON CONFLICT (org_id, ferramenta) DO UPDATE
			SET permitida = COALESCE($3, public.cortex_permissoes_org.permitida),
			    roles_permitidas = COALESCE($4::app.org_membro_role[], public.cortex_permissoes_org.roles_permitidas),
			    updated_at = now()
		`, orgID, ferramenta, permitida, rolesPermitidas)
		if err != nil {
			return err
		}
		return tx.QueryRow(ctx, `
			SELECT id, org_id, ferramenta, permitida, COALESCE(roles_permitidas, '{}'::text[]), updated_at
			FROM public.cortex_permissoes_org
			WHERE org_id = $1 AND ferramenta = $2
		`, orgID, ferramenta).Scan(&p.ID, &p.OrgID, &p.Ferramenta, &p.Permitida, &p.RolesPermitidas, &p.UpdatedAt)
	})
	return p, err
}
