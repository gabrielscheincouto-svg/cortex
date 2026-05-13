package models

import (
	"time"

	"github.com/google/uuid"
)

// ─── Declarante ────────────────────────────────────────────────────────────
type IrpfDeclarante struct {
	ID             uuid.UUID  `json:"id"`
	OrgID          uuid.UUID  `json:"org_id"`
	EmpresaID      *uuid.UUID `json:"empresa_id,omitempty"`
	CPF            string     `json:"cpf"`
	NomeCompleto   string     `json:"nome_completo"`
	DataNascimento *time.Time `json:"data_nascimento,omitempty"`
	Email          *string    `json:"email,omitempty"`
	Telefone       *string    `json:"telefone,omitempty"`
	Observacoes    *string    `json:"observacoes,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`

	// Agregado opcional preenchido por listagem
	DeclaracoesCount int `json:"declaracoes_count,omitempty"`
}

type CreateIrpfDeclaranteDTO struct {
	EmpresaID      *uuid.UUID `json:"empresa_id"`
	CPF            string     `json:"cpf"`
	NomeCompleto   string     `json:"nome_completo"`
	DataNascimento *string    `json:"data_nascimento"`
	Email          *string    `json:"email"`
	Telefone       *string    `json:"telefone"`
	Observacoes    *string    `json:"observacoes"`
}

type UpdateIrpfDeclaranteDTO struct {
	EmpresaID      *uuid.UUID `json:"empresa_id"`
	NomeCompleto   *string    `json:"nome_completo"`
	DataNascimento *string    `json:"data_nascimento"`
	Email          *string    `json:"email"`
	Telefone       *string    `json:"telefone"`
	Observacoes    *string    `json:"observacoes"`
}

// ─── Declaração ────────────────────────────────────────────────────────────
type IrpfDeclaracao struct {
	ID                    uuid.UUID  `json:"id"`
	OrgID                 uuid.UUID  `json:"org_id"`
	DeclaranteID          uuid.UUID  `json:"declarante_id"`
	DeclaranteNome        *string    `json:"declarante_nome,omitempty"`
	DeclaranteCPF         *string    `json:"declarante_cpf,omitempty"`
	Exercicio             int        `json:"exercicio"`
	AnoCalendario         int        `json:"ano_calendario"`
	Status                string     `json:"status"`
	ResponsavelID         *uuid.UUID `json:"responsavel_id,omitempty"`
	ResponsavelNome       *string    `json:"responsavel_nome,omitempty"`
	RendimentosTotalCents int64      `json:"rendimentos_total_cents"`
	DeducoesTotalCents    int64      `json:"deducoes_total_cents"`
	ImpostoDevidoCents    int64      `json:"imposto_devido_cents"`
	ImpostoRetidoCents    int64      `json:"imposto_retido_cents"`
	SaldoCents            int64      `json:"saldo_cents"`
	SituacaoFinal         *string    `json:"situacao_final,omitempty"`
	ReciboURL             *string    `json:"recibo_url,omitempty"`
	TransmitidaEm         *time.Time `json:"transmitida_em,omitempty"`
	Observacoes           *string    `json:"observacoes,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

type CreateIrpfDeclaracaoDTO struct {
	DeclaranteID  uuid.UUID `json:"declarante_id"`
	Exercicio     int       `json:"exercicio"`
	AnoCalendario int       `json:"ano_calendario"`
	ResponsavelID *uuid.UUID `json:"responsavel_id"`
	Observacoes   *string    `json:"observacoes"`
}

type UpdateIrpfDeclaracaoDTO struct {
	Status        *string    `json:"status"`
	ResponsavelID *uuid.UUID `json:"responsavel_id"`
	Observacoes   *string    `json:"observacoes"`
	ReciboURL     *string    `json:"recibo_url"`
}

// ─── Lançamento ────────────────────────────────────────────────────────────
type IrpfLancamento struct {
	ID                 uuid.UUID `json:"id"`
	OrgID              uuid.UUID `json:"org_id"`
	DeclaracaoID       uuid.UUID `json:"declaracao_id"`
	Tipo               string    `json:"tipo"`
	FontePagadora      *string   `json:"fonte_pagadora,omitempty"`
	FonteCNPJ          *string   `json:"fonte_cnpj,omitempty"`
	Descricao          *string   `json:"descricao,omitempty"`
	ValorCents         int64     `json:"valor_cents"`
	ImpostoRetidoCents int64     `json:"imposto_retido_cents"`
	DocumentoURL       *string   `json:"documento_url,omitempty"`
	Payload            map[string]any `json:"payload"`
	CreatedAt          time.Time `json:"created_at"`
}

type CreateIrpfLancamentoDTO struct {
	Tipo               string         `json:"tipo"`
	FontePagadora      *string        `json:"fonte_pagadora"`
	FonteCNPJ          *string        `json:"fonte_cnpj"`
	Descricao          *string        `json:"descricao"`
	ValorCents         int64          `json:"valor_cents"`
	ImpostoRetidoCents int64          `json:"imposto_retido_cents"`
	DocumentoURL       *string        `json:"documento_url"`
	Payload            map[string]any `json:"payload"`
}

// ─── Detalhe consolidado de uma declaração (resposta de GET /irpf/declaracoes/:id) ─
type IrpfDeclaracaoDetalhe struct {
	Declaracao  IrpfDeclaracao    `json:"declaracao"`
	Declarante  IrpfDeclarante    `json:"declarante"`
	Lancamentos []IrpfLancamento  `json:"lancamentos"`
}

// ─── Dashboard do exercício ────────────────────────────────────────────────
type IrpfDashboard struct {
	Exercicio          int   `json:"exercicio"`
	Total              int   `json:"total"`
	AIniciar           int   `json:"a_iniciar"`
	Coletando          int   `json:"coletando"`
	EmProcessamento    int   `json:"em_processamento"`
	AguardandoCliente  int   `json:"aguardando_cliente"`
	Entregues          int   `json:"entregues"`
	EmMalha            int   `json:"em_malha"`
	Retificadas        int   `json:"retificadas"`
	Canceladas         int   `json:"canceladas"`
	TotalARestituirCents int64 `json:"total_a_restituir_cents"`
	TotalAPagarCents     int64 `json:"total_a_pagar_cents"`
	TotalImpostoRetidoCents int64 `json:"total_imposto_retido_cents"`
}
