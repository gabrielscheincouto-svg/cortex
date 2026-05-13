// Package auth valida JWTs emitidos pelo Supabase Auth e extrai o user/org atual.
package auth

import (
	"errors"
	"fmt"
	"strings"

	"github.com/cecopel/api/internal/db"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// SupabaseClaims representa as claims que o Supabase coloca no JWT.
type SupabaseClaims struct {
	Sub      string                 `json:"sub"`        // user_id no auth.users
	Email    string                 `json:"email"`
	Role     string                 `json:"role"`       // 'authenticated' | 'service_role'
	AppMeta  map[string]interface{} `json:"app_metadata"`
	UserMeta map[string]interface{} `json:"user_metadata"`
	jwt.RegisteredClaims
}

// Middleware retorna um middleware Fiber que:
//   1) Lê o header Authorization: Bearer <jwt>
//   2) Valida a assinatura com SUPABASE_JWT_SECRET
//   3) Extrai user_id e (opcionalmente) org_id de app_metadata.current_org_id
//   4) Anexa um db.TenantCtx ao c.UserContext()
//
// Se requireAuth=true e o token estiver ausente ou inválido, devolve 401.
func Middleware(jwtSecret string, requireAuth bool, allowQueryToken bool) fiber.Handler {
	if jwtSecret == "" {
		log.Fatal().Msg("SUPABASE_JWT_SECRET vazio — middleware de auth não pode operar")
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
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("método de assinatura inesperado: %v", t.Header["alg"])
			}
			return secret, nil
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
