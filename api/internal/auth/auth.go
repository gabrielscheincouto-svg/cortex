// Package auth valida JWTs emitidos pelo Supabase Auth e extrai o user/org atual.
//
// Em 2025 o Supabase migrou o default de assinatura HS256 (shared secret) pra
// ES256 (ECC P-256, par de chaves assimétricas). A chave pública é exposta no
// endpoint JWKS do projeto: https://<projeto>.supabase.co/auth/v1/.well-known/jwks.json.
//
// Este middleware aceita os dois algoritmos:
//   - HS256: valida com SUPABASE_JWT_SECRET (legacy)
//   - ES256: valida com a chave pública ECDSA P-256 buscada do JWKS no startup
//
// A JWK é carregada uma vez no boot e cacheada em memória. Se o Supabase
// rotacionar a chave, é preciso redeployar a API (próximo passo: refresh
// periódico via tempo ou on-cache-miss).
package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/cecopel/api/internal/db"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// SupabaseClaims representa as claims que o Supabase coloca no JWT.
type SupabaseClaims struct {
	Sub      string                 `json:"sub"`  // user_id no auth.users
	Email    string                 `json:"email"`
	Role     string                 `json:"role"` // 'authenticated' | 'service_role'
	AppMeta  map[string]interface{} `json:"app_metadata"`
	UserMeta map[string]interface{} `json:"user_metadata"`
	jwt.RegisteredClaims
}

// ─── JWKS cache ──────────────────────────────────────────────────────────────

// jwkKey é uma chave JWK genérica (campos comuns + EC).
type jwkKey struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"` // "EC", "RSA", "oct"
	Crv string `json:"crv"` // "P-256" pra ES256
	Alg string `json:"alg"` // "ES256"
	Use string `json:"use"`
	X   string `json:"x"` // base64url
	Y   string `json:"y"` // base64url
}

type jwksDocument struct {
	Keys []jwkKey `json:"keys"`
}

// jwksCache guarda as chaves públicas ECDSA P-256 mapeadas por kid.
type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*ecdsa.PublicKey
	url     string
	lastFix time.Time
}

func (c *jwksCache) get(kid string) (*ecdsa.PublicKey, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	k, ok := c.keys[kid]
	return k, ok
}

// refresh busca o JWKS no Supabase e atualiza o cache.
// Idempotente — pode ser chamado em paralelo (faz lock).
func (c *jwksCache) refresh(ctx context.Context) error {
	if c.url == "" {
		return errors.New("jwks url vazio")
	}
	req, err := http.NewRequestWithContext(ctx, "GET", c.url, nil)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("jwks status %d: %s", resp.StatusCode, string(body))
	}
	var doc jwksDocument
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return err
	}
	parsed := make(map[string]*ecdsa.PublicKey)
	for _, k := range doc.Keys {
		if k.Kty != "EC" || k.Crv != "P-256" {
			continue
		}
		pub, err := parseECPublicKey(k)
		if err != nil {
			log.Warn().Err(err).Str("kid", k.Kid).Msg("falha parseando JWK")
			continue
		}
		parsed[k.Kid] = pub
	}
	c.mu.Lock()
	c.keys = parsed
	c.lastFix = time.Now()
	c.mu.Unlock()
	log.Info().Int("keys", len(parsed)).Str("url", c.url).Msg("JWKS carregado")
	return nil
}

// parseECPublicKey converte uma JWK EC P-256 em *ecdsa.PublicKey.
// As coordenadas x/y vêm como base64url (sem padding).
func parseECPublicKey(k jwkKey) (*ecdsa.PublicKey, error) {
	xBytes, err := base64.RawURLEncoding.DecodeString(k.X)
	if err != nil {
		return nil, fmt.Errorf("decode x: %w", err)
	}
	yBytes, err := base64.RawURLEncoding.DecodeString(k.Y)
	if err != nil {
		return nil, fmt.Errorf("decode y: %w", err)
	}
	return &ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     new(big.Int).SetBytes(xBytes),
		Y:     new(big.Int).SetBytes(yBytes),
	}, nil
}

// ─── Middleware ──────────────────────────────────────────────────────────────

// Middleware retorna um middleware Fiber que:
//   1) Lê o header Authorization: Bearer <jwt>
//   2) Valida a assinatura (ES256 via JWKS OU HS256 via secret)
//   3) Extrai user_id e (opcionalmente) org_id de app_metadata.current_org_id
//   4) Anexa um db.TenantCtx ao c.UserContext()
//
// Se requireAuth=true e o token estiver ausente ou inválido, devolve 401.
//
// `jwtSecret` é opcional (pode ser vazio). Se vazio, só ES256 é aceito.
// `supabaseURL` é usado pra construir a JWKS URL automaticamente. Se vazio,
// JWKS não é carregado e só HS256 é aceito.
func Middleware(jwtSecret string, supabaseURL string, requireAuth bool, allowQueryToken bool) fiber.Handler {
	if jwtSecret == "" && supabaseURL == "" {
		log.Fatal().Msg("auth: nem SUPABASE_JWT_SECRET nem SUPABASE_URL configurados — middleware não pode validar")
	}

	// Carrega JWKS no startup se SUPABASE_URL foi configurado
	var jwks *jwksCache
	if supabaseURL != "" {
		jwksURL := strings.TrimRight(supabaseURL, "/") + "/auth/v1/.well-known/jwks.json"
		jwks = &jwksCache{url: jwksURL, keys: map[string]*ecdsa.PublicKey{}}
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := jwks.refresh(ctx); err != nil {
			log.Warn().Err(err).Str("url", jwksURL).
				Msg("JWKS não carregado no boot — só HS256 aceito até o próximo retry")
		}
	}
	secret := []byte(jwtSecret)

	return func(c *fiber.Ctx) error {
		header := c.Get("Authorization")
		if allowQueryToken && !strings.HasPrefix(header, "Bearer ") {
			if token := c.Query("access_token"); token != "" {
				header = "Bearer " + token
			}
		}
		if !strings.HasPrefix(header, "Bearer ") {
			if requireAuth {
				return c.Status(401).JSON(fiber.Map{"error": "missing_authorization"})
			}
			return c.Next()
		}
		raw := strings.TrimPrefix(header, "Bearer ")

		claims := &SupabaseClaims{}
		_, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (interface{}, error) {
			switch t.Method.(type) {

			case *jwt.SigningMethodHMAC:
				// HS256 (legacy)
				if len(secret) == 0 {
					return nil, fmt.Errorf("HS256 desabilitado (SUPABASE_JWT_SECRET vazio)")
				}
				return secret, nil

			case *jwt.SigningMethodECDSA:
				// ES256 (default novo do Supabase)
				if jwks == nil {
					return nil, fmt.Errorf("ES256 desabilitado (SUPABASE_URL vazio)")
				}
				kid, _ := t.Header["kid"].(string)
				if kid == "" {
					return nil, fmt.Errorf("token ES256 sem kid")
				}
				key, ok := jwks.get(kid)
				if !ok {
					// kid desconhecido: pode ter rotacionado — força refresh
					ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
					defer cancel()
					if rerr := jwks.refresh(ctx); rerr != nil {
						return nil, fmt.Errorf("kid desconhecido (%s) e refresh JWKS falhou: %w", kid, rerr)
					}
					key, ok = jwks.get(kid)
					if !ok {
						return nil, fmt.Errorf("kid desconhecido após refresh: %s", kid)
					}
				}
				return key, nil

			default:
				return nil, fmt.Errorf("método de assinatura inesperado: %v", t.Header["alg"])
			}
		})
		if err != nil {
			if requireAuth {
				return c.Status(401).JSON(fiber.Map{"error": "invalid_token", "detail": err.Error()})
			}
			return c.Next()
		}

		userID, err := uuid.Parse(claims.Sub)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "invalid_user_id"})
		}

		// org_id atual vem da app_metadata (setada pelo backend quando o user troca de org)
		var orgID uuid.UUID
		if v, ok := claims.AppMeta["current_org_id"].(string); ok && v != "" {
			if parsed, err := uuid.Parse(v); err == nil {
				orgID = parsed
			}
		}

		ctx := db.WithTenantValue(c.UserContext(), db.TenantCtx{
			UserID: userID,
			OrgID:  orgID,
		})
		c.SetUserContext(ctx)

		// Atalhos para handlers que não querem mexer no context
		c.Locals("user_id", userID)
		c.Locals("org_id", orgID)
		c.Locals("email", claims.Email)
		return c.Next()
	}
}

// MustUserID retorna o user_id do request ou panic (use apenas após Middleware com requireAuth=true).
func MustUserID(c *fiber.Ctx) uuid.UUID {
	id, ok := c.Locals("user_id").(uuid.UUID)
	if !ok || id == uuid.Nil {
		panic(errors.New("user_id ausente — chame este handler depois do middleware de auth"))
	}
	return id
}

// CurrentOrg retorna o org_id atual do request. Pode ser uuid.Nil se o user ainda
// não selecionou nenhuma org.
func CurrentOrg(c *fiber.Ctx) uuid.UUID {
	id, _ := c.Locals("org_id").(uuid.UUID)
	return id
}
