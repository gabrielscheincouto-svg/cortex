# ──────────────────────────────────────────────────────────────
# Build stage — compila o binário com CGO desligado para imagem distroless
# ──────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

WORKDIR /src

# Dependências primeiro (cacheia camadas mesmo quando código muda)
COPY go.mod go.sum* ./
RUN go mod download

# Código
COPY . .

# Compila estatico
ENV CGO_ENABLED=0 GOOS=linux GOARCH=amd64
RUN go build -ldflags="-s -w" -o /out/api ./cmd/server

# ──────────────────────────────────────────────────────────────
# Runtime — distroless é mínimo (~20 MB) e não tem shell, reduzindo superfície
# ──────────────────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app
COPY --from=builder /out/api /app/api

USER nonroot:nonroot
EXPOSE 8080

ENTRYPOINT ["/app/api"]
