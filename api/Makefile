# CECOPEL 2.0 — API · comandos comuns
# Uso: make <alvo>

.DEFAULT_GOAL := help
.PHONY: help run dev build test fmt vet tidy docker docker-run deploy

help: ## Lista os alvos disponíveis
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

run: ## Roda a API em modo dev (carrega .env)
	go run ./cmd/server

dev: ## Roda com auto-reload (precisa de github.com/air-verse/air)
	@command -v air >/dev/null 2>&1 || (echo "instale: go install github.com/air-verse/air@latest"; exit 1)
	air

build: ## Compila o binário para ./bin/api
	@mkdir -p bin
	CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/api ./cmd/server
	@ls -lh bin/api

test: ## Roda todos os testes
	go test -race -cover ./...

fmt: ## Formata o código
	gofmt -s -w .

vet: ## Análise estática
	go vet ./...

tidy: ## Limpa go.mod / baixa deps
	go mod tidy

docker: ## Builda imagem Docker local
	docker build -t cecopel-api:local .

docker-run: docker ## Builda e roda imagem local com .env
	docker run --rm -p 8080:8080 --env-file .env cecopel-api:local

deploy: ## Deploy no Fly.io (requer fly CLI e fly.toml configurado)
	fly deploy
