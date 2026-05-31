// Package config carrega variáveis de ambiente e expõe a configuração tipada.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config agrega toda a configuração da aplicação.
type Config struct {
	AppEnv            string
	Port              int
	DatabaseURL       string
	SupabaseURL       string
	SupabaseAnonKey   string
	SupabaseSvcKey    string
	SupabaseJWTSecret string
	CorsOrigins       []string

	// Opcionais (vão entrar em fases futuras)
	OneSignalAppID   string
	OneSignalKey     string
	ResendKey        string
	StripeSecret     string
	StripeWebhook    string
	SentryDSN        string
	LogLevel         string
}

// Load lê o arquivo .env (se existir) e retorna a Config validada.
// Em produção (App Env != development), o .env é ignorado e tudo vem do ambiente.
func Load() (*Config, error) {
	// Em dev, carrega .env. Em prod, as vars já estão no ambiente.
	_ = godotenv.Load()

	cfg := &Config{
		AppEnv:            envOr("APP_ENV", "development"),
		Port:              envInt("PORT", 8080),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		SupabaseURL:       os.Getenv("SUPABASE_URL"),
		SupabaseAnonKey:   os.Getenv("SUPABASE_ANON_KEY"),
		SupabaseSvcKey:    os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		SupabaseJWTSecret: os.Getenv("SUPABASE_JWT_SECRET"),
		CorsOrigins:       splitCsv(envOr("CORS_ALLOWED_ORIGINS", "http://localhost:3000")),
		OneSignalAppID:    os.Getenv("ONESIGNAL_APP_ID"),
		OneSignalKey:      os.Getenv("ONESIGNAL_REST_API_KEY"),
		ResendKey:         os.Getenv("RESEND_API_KEY"),
		StripeSecret:      os.Getenv("STRIPE_SECRET_KEY"),
		StripeWebhook:     os.Getenv("STRIPE_WEBHOOK_SECRET"),
		SentryDSN:         os.Getenv("SENTRY_DSN"),
		LogLevel:          envOr("LOG_LEVEL", "info"),
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) validate() error {
	missing := []string{}
	if c.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if c.SupabaseURL == "" {
		missing = append(missing, "SUPABASE_URL")
	}
	if c.SupabaseJWTSecret == "" {
		missing = append(missing, "SUPABASE_JWT_SECRET")
	}
	if len(missing) > 0 {
		return fmt.Errorf("variáveis obrigatórias faltando: %s", strings.Join(missing, ", "))
	}
	return nil
}

// IsProduction retorna true quando rodando em produção.
func (c *Config) IsProduction() bool { return c.AppEnv == "production" }

// IsDev retorna true em desenvolvimento.
func (c *Config) IsDev() bool { return c.AppEnv == "development" }

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func splitCsv(s string) []string {
	out := []string{}
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
