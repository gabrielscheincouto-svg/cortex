// Package middleware agrupa middlewares HTTP transversais (não-auth).
package middleware

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/rs/zerolog/log"
)

// RequestID injeta um X-Request-ID por request (gera UUID v4 se ausente).
func RequestID() fiber.Handler {
	return requestid.New()
}

// Recover captura panics e devolve 500.
func Recover() fiber.Handler {
	return recover.New(recover.Config{EnableStackTrace: true})
}

// CORS configura CORS para os domínios permitidos.
func CORS(origins []string) fiber.Handler {
	return cors.New(cors.Config{
		AllowOrigins:     strings.Join(origins, ","),
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Authorization,X-Request-ID",
		ExposeHeaders:    "X-Request-ID",
		AllowCredentials: true,
		MaxAge:           300,
	})
}

// Logger registra cada request em formato estruturado.
func Logger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()

		event := log.Info()
		if err != nil || c.Response().StatusCode() >= 500 {
			event = log.Error().Err(err)
		}
		event.
			Str("request_id", c.GetRespHeader("X-Request-ID")).
			Str("method", c.Method()).
			Str("path", c.Path()).
			Int("status", c.Response().StatusCode()).
			Dur("latency", time.Since(start)).
			Str("ip", c.IP()).
			Msg("http_request")
		return err
	}
}
