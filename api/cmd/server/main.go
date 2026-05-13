// Binário principal: api server CECOPEL 2.0.
//
// Boot:
//   1) carrega config (.env em dev, env vars em prod)
//   2) configura logger
//   3) abre pool Postgres (Supabase)
//   4) cria repo, hub WS, jobs runner
//   5) registra rotas e ergue HTTP server
//   6) trata SIGTERM/SIGINT para shutdown gracioso
package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cecopel/api/internal/config"
	"github.com/cecopel/api/internal/db"
	"github.com/cecopel/api/internal/jobs"
	"github.com/cecopel/api/internal/logger"
	"github.com/cecopel/api/internal/realtime"
	"github.com/cecopel/api/internal/repo"
	"github.com/cecopel/api/internal/server"
	"github.com/rs/zerolog/log"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, "config:", err)
		os.Exit(1)
	}
	logger.Init(cfg.AppEnv, cfg.LogLevel)

	rootCtx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Conexão com Postgres
	database, err := db.New(rootCtx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("falha conectando ao Postgres")
	}
	defer database.Close()

	r := repo.New(database)
	hub := realtime.NewHub()
	app := server.New(cfg, r, hub)

	// Workers cron rodam dentro do mesmo processo (1 instância)
	jobs.New(database, cfg).Start(rootCtx)

	// HTTP em goroutine para podermos esperar pelo sinal
	addr := fmt.Sprintf(":%d", cfg.Port)
	go func() {
		log.Info().Str("addr", addr).Str("env", cfg.AppEnv).Msg("api_iniciada")
		if err := app.Listen(addr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error().Err(err).Msg("http_listen_falhou")
			cancel()
		}
	}()

	// Aguarda sinal de shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	<-sigCh
	log.Info().Msg("shutdown_iniciado")

	cancel()
	ctxShutdown, cancelShutdown := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancelShutdown()
	if err := app.ShutdownWithContext(ctxShutdown); err != nil {
		log.Error().Err(err).Msg("shutdown_erro")
	}
	log.Info().Msg("encerrado")
}
