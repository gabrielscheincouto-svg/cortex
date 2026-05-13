// Package server monta o app Fiber, registra middlewares e rotas.
package server

import (
	"github.com/cecopel/api/internal/auth"
	"github.com/cecopel/api/internal/config"
	"github.com/cecopel/api/internal/handler"
	"github.com/cecopel/api/internal/middleware"
	"github.com/cecopel/api/internal/realtime"
	"github.com/cecopel/api/internal/repo"
	"github.com/gofiber/fiber/v2"
)

// New cria e configura o app Fiber pronto para Listen().
func New(cfg *config.Config, r *repo.Repo, hub *realtime.Hub) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:               "cecopel-api",
		DisableStartupMessage: cfg.IsProduction(),
		BodyLimit:             50 * 1024 * 1024, // 50 MB para uploads pequenos
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": "request_failed", "message": err.Error()})
		},
	})

	// Middlewares globais
	app.Use(middleware.RequestID())
	app.Use(middleware.Recover())
	app.Use(middleware.CORS(cfg.CorsOrigins))
	app.Use(middleware.Logger())

	h := handler.New(r, hub, cfg)

	// Rotas públicas
	app.Get("/health", h.Health)
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"service": "cecopel-api",
			"version": "0.1.0",
			"docs":    "https://github.com/cecopel/api",
		})
	})
	app.Get("/api/v1/tv", h.TVData)

	// Rotas autenticadas
	api := app.Group("/api/v1", auth.Middleware(cfg.SupabaseJWTSecret, true, false))

	api.Get("/me", h.Me)
	api.Patch("/me/current-org", h.SetCurrentOrg)

	api.Get("/orgs", h.ListOrgs)
	api.Post("/orgs", h.CreateOrg)

	api.Get("/empresas", h.ListEmpresas)
	api.Post("/empresas", h.CreateEmpresa)

	api.Get("/entregas", h.ListEntregas)
	api.Patch("/entregas/:id/status", h.UpdateEntregaStatus)

	api.Post("/chat/canais/:id/mensagens", h.CreateChatMensagem)
	api.Post("/chat/canais/:id/lido",      h.MarcarChatLido)

	api.Patch("/solicitacoes/:id", h.UpdateSolicitacao)
	api.Patch("/solicitacoes/:id/status", h.UpdateSolicitacao)
	api.Post("/solicitacoes/:id/mensagens", h.CreateSolicitacaoMensagem)

	api.Post("/obrigacoes/herdar", h.HerdarObrigacao)
	api.Post("/obrigacao-empresa", h.CreateObrigacaoEmpresa)
	api.Delete("/obrigacao-empresa/:id", h.DeleteObrigacaoEmpresa)

	api.Post("/org/membros/convidar", h.ConvidarOrgMembro)
	api.Patch("/org/membros/:id", h.UpdateOrgMembro)
	api.Delete("/org/membros/:id", h.DeleteOrgMembro)
	api.Patch("/org/configuracoes", h.UpdateOrgConfiguracoes)
	api.Get("/org/departamentos", h.ListOrgDepartamentos)
	api.Patch("/org/departamentos/:codigo", h.UpdateOrgDepartamento)
	api.Post("/pontos/lancamento-manual", h.CreateLancamentoManualPontos)
	api.Get("/kanban/tarefas", h.ListKanbanTarefas)
	api.Post("/kanban/tarefas", h.CreateKanbanTarefa)
	api.Patch("/kanban/tarefas/:id", h.UpdateKanbanTarefa)
	api.Delete("/kanban/tarefas/:id", h.DeleteKanbanTarefa)
	api.Get("/frequencia", h.ListFrequencia)
	api.Patch("/frequencia/:user_id/:data", h.PatchFrequencia)
	api.Post("/frequencia/fechar-mes", h.FecharMesFrequencia)
	api.Get("/balancetes", h.ListBalancetes)
	api.Post("/balancetes", h.CreateBalancete)
	api.Get("/balancetes/comparativo", h.GetBalanceteComparativo)
	api.Get("/balancetes/:id", h.GetBalancete)
	api.Post("/balancetes/:id/contas", h.ReplaceBalanceteContas)
	api.Patch("/balancetes/:id/fechar", h.FecharBalancete)

	// ── IRPF ──
	api.Get("/irpf/dashboard", h.IrpfDashboard)
	api.Get("/irpf/declarantes", h.ListIrpfDeclarantes)
	api.Post("/irpf/declarantes", h.CreateIrpfDeclarante)
	api.Patch("/irpf/declarantes/:id", h.UpdateIrpfDeclarante)
	api.Delete("/irpf/declarantes/:id", h.DeleteIrpfDeclarante)
	api.Get("/irpf/declaracoes", h.ListIrpfDeclaracoes)
	api.Post("/irpf/declaracoes", h.CreateIrpfDeclaracao)
	api.Get("/irpf/declaracoes/:id", h.GetIrpfDeclaracao)
	api.Patch("/irpf/declaracoes/:id", h.UpdateIrpfDeclaracao)
	api.Post("/irpf/declaracoes/:id/lancamentos", h.AddIrpfLancamento)
	api.Post("/irpf/declaracoes/:id/calcular", h.RecalcularIrpfDeclaracao)
	api.Delete("/irpf/lancamentos/:id", h.DeleteIrpfLancamento)

	api.Post("/uploads/preparar", h.PrepararUpload)
	api.Post("/uploads/:id/confirmar", h.ConfirmarUpload)
	api.Post("/uploads/:id/cancelar", h.CancelarUpload)
	api.Get("/arquivos/:id/download-url", h.GetArquivoDownloadURL)

	api.Get("/cortex/conversas", h.ListCortexConversas)
	api.Post("/cortex/conversas", h.CreateCortexConversa)
	api.Get("/cortex/conversas/:id", h.GetCortexConversa)
	api.Post("/cortex/conversas/:id/mensagens", h.CreateCortexMensagem)
	api.Delete("/cortex/conversas/:id", h.DeleteCortexConversa)

	// Cortex v3 — ações pendentes (agente que age sob confirmação)
	api.Get("/cortex/acoes", h.ListCortexAcoes)
	api.Post("/cortex/acoes/:id/confirmar", h.ConfirmarCortexAcao)
	api.Post("/cortex/acoes/:id/cancelar", h.CancelarCortexAcao)
	api.Get("/cortex/permissoes", h.ListCortexPermissoes)
	api.Patch("/cortex/permissoes/:ferramenta", h.UpdateCortexPermissao)

	// Cortex v4 — memória persistente
	api.Get("/cortex/memorias", h.ListCortexMemorias)
	api.Post("/cortex/memorias", h.CreateCortexMemoria)
	api.Patch("/cortex/memorias/:id", h.UpdateCortexMemoria)
	api.Delete("/cortex/memorias/:id", h.DeleteCortexMemoria)
	api.Post("/cortex/memorias/esquecer-tudo", h.EsquecerTudoCortexMemorias)

	// Cortex Quick (Cmd+K) — busca cross-entity + comando single-shot
	api.Get("/busca", h.BuscaGlobal)
	api.Post("/cortex/comando", h.CortexComando)

	// Endpoints do robô Tauri
	api.Get("/robo/catalogo",   h.RoboCatalogo)
	api.Post("/robo/heartbeat", h.RoboHeartbeat)
	api.Post("/robo/upload",    h.RoboUpload)

	// WebSocket realtime (chat + mural)
	app.Get("/ws", auth.Middleware(cfg.SupabaseJWTSecret, true, true), realtime.WSUpgrade(hub))

	return app
}
