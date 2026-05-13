// Package logger configura o zerolog global e expõe helpers contextuais.
package logger

import (
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// Init configura o logger global.
//   - Em produção: JSON estruturado (fácil de processar por Fly.io/Railway/Loki)
//   - Em desenvolvimento: console colorido legível
func Init(env, level string) {
	zerolog.TimeFieldFormat = time.RFC3339Nano

	lvl, err := zerolog.ParseLevel(level)
	if err != nil {
		lvl = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(lvl)

	if env == "production" {
		log.Logger = zerolog.New(os.Stdout).With().Timestamp().Caller().Logger()
	} else {
		log.Logger = zerolog.New(zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.Kitchen,
		}).With().Timestamp().Caller().Logger()
	}
}
