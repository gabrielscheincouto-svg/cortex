// Package realtime implementa um Hub WebSocket para broadcast em tempo real
// de eventos de chat e mural por organização.
//
// Modelo simples (suficiente até dezenas de milhares de conexões por instância):
//   • Cada conexão se associa a um org_id e se inscreve em N "rooms" (canal de chat, mural)
//   • Mensagens são publicadas em rooms; o Hub faz fan-out para todos os subscribers
//   • Quando a API persiste uma chat_mensagem ou mural_post, ela chama Hub.Publish
//     para empurrar o evento para os clientes conectados
package realtime

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// Event é o payload genérico enviado para clientes.
type Event struct {
	Type      string          `json:"type"`             // 'chat.message', 'mural.post', 'entrega.evento', etc.
	Room      string          `json:"room"`             // ex: 'chat:<canal_id>' ou 'mural:<org_id>'
	OrgID     uuid.UUID       `json:"org_id"`
	Payload   json.RawMessage `json:"payload"`
	Timestamp time.Time       `json:"ts"`
}

type client struct {
	id     uuid.UUID
	userID uuid.UUID
	orgID  uuid.UUID
	conn   *websocket.Conn
	rooms  map[string]struct{}
	send   chan Event
}

// Hub orquestra todas as conexões abertas.
type Hub struct {
	mu      sync.RWMutex
	clients map[uuid.UUID]*client
	rooms   map[string]map[uuid.UUID]*client
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[uuid.UUID]*client),
		rooms:   make(map[string]map[uuid.UUID]*client),
	}
}

// Register adiciona um cliente novo. Devolve um handle para subscribe/unsubscribe.
func (h *Hub) Register(conn *websocket.Conn, userID, orgID uuid.UUID) *client {
	cl := &client{
		id:     uuid.New(),
		userID: userID,
		orgID:  orgID,
		conn:   conn,
		rooms:  make(map[string]struct{}),
		send:   make(chan Event, 64),
	}
	h.mu.Lock()
	h.clients[cl.id] = cl
	h.mu.Unlock()
	go cl.writer()
	return cl
}

// Unregister remove o cliente de tudo.
func (h *Hub) Unregister(cl *client) {
	h.mu.Lock()
	delete(h.clients, cl.id)
	for room := range cl.rooms {
		if subs, ok := h.rooms[room]; ok {
			delete(subs, cl.id)
			if len(subs) == 0 {
				delete(h.rooms, room)
			}
		}
	}
	h.mu.Unlock()
	close(cl.send)
}

// Subscribe inscreve o cliente em uma room. A room precisa pertencer à mesma org.
func (h *Hub) Subscribe(cl *client, room string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.rooms[room]; !ok {
		h.rooms[room] = make(map[uuid.UUID]*client)
	}
	h.rooms[room][cl.id] = cl
	cl.rooms[room] = struct{}{}
}

// Unsubscribe remove o cliente de uma room.
func (h *Hub) Unsubscribe(cl *client, room string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if subs, ok := h.rooms[room]; ok {
		delete(subs, cl.id)
	}
	delete(cl.rooms, room)
}

// Publish envia um evento para todos os clientes inscritos na room.
// Filtra por org_id como camada extra de proteção contra erros de configuração.
func (h *Hub) Publish(ev Event) {
	ev.Timestamp = time.Now()
	h.mu.RLock()
	subs := h.rooms[ev.Room]
	targets := make([]*client, 0, len(subs))
	for _, c := range subs {
		if c.orgID == ev.OrgID {
			targets = append(targets, c)
		}
	}
	h.mu.RUnlock()

	for _, c := range targets {
		select {
		case c.send <- ev:
		default:
			// Buffer cheio = cliente lento. Desconecta para liberar.
			log.Warn().Str("client_id", c.id.String()).Msg("ws_client_slow_disconnect")
			_ = c.conn.Close()
		}
	}
}

func (c *client) writer() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case ev, ok := <-c.send:
			if !ok {
				return
			}
			data, _ := json.Marshal(ev)
			if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}
		case <-ticker.C:
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
