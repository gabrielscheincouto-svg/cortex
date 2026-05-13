package realtime

import (
	"encoding/json"

	"github.com/cecopel/api/internal/auth"
	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// WSUpgrade é o endpoint que upgrada HTTP para WebSocket.
// O auth.Middleware já validou o JWT, então user_id está disponível em Locals.
//
// Protocolo do cliente:
//   { "action": "subscribe",   "room": "chat:<canal_id>" }
//   { "action": "unsubscribe", "room": "chat:<canal_id>" }
//
// O servidor envia mensagens no formato Event (definido em hub.go).
func WSUpgrade(hub *Hub) fiber.Handler {
	// Filtro: rejeita upgrade se não veio pelo websocket.
	return func(c *fiber.Ctx) error {
		if !websocket.IsWebSocketUpgrade(c) {
			return fiber.ErrUpgradeRequired
		}
		userID := auth.MustUserID(c)
		orgID := auth.CurrentOrg(c)
		if orgID == uuid.Nil {
			return c.Status(400).JSON(fiber.Map{"error": "selecione uma org antes de conectar"})
		}
		c.Locals("ws_user_id", userID)
		c.Locals("ws_org_id", orgID)
		return websocket.New(handle(hub))(c)
	}
}

type clientMsg struct {
	Action string `json:"action"`
	Room   string `json:"room"`
}

func handle(hub *Hub) func(*websocket.Conn) {
	return func(conn *websocket.Conn) {
		userID := conn.Locals("ws_user_id").(uuid.UUID)
		orgID := conn.Locals("ws_org_id").(uuid.UUID)

		cl := hub.Register(conn, userID, orgID)
		log.Info().Str("user", userID.String()).Str("org", orgID.String()).Msg("ws_connected")
		defer func() {
			hub.Unregister(cl)
			log.Info().Str("user", userID.String()).Msg("ws_disconnected")
		}()

		for {
			_, raw, err := conn.ReadMessage()
			if err != nil {
				return
			}
			var msg clientMsg
			if err := json.Unmarshal(raw, &msg); err != nil {
				continue
			}
			switch msg.Action {
			case "subscribe":
				if msg.Room != "" {
					hub.Subscribe(cl, msg.Room)
				}
			case "unsubscribe":
				if msg.Room != "" {
					hub.Unsubscribe(cl, msg.Room)
				}
			}
		}
	}
}
