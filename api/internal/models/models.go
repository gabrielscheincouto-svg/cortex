// Package models define os tipos compartilhados entre handlers, services e repositórios.
//
// Convenção: estruturas com sufixo "DTO" são payloads de entrada (request body).
// Estruturas sem sufixo são representações do banco / saída (response body).
package models

import (
	"time"

	"github.com/google/uuid"
)

// ─── Profile ───────────────────────────────────────────────────────────────
type Profile struct {
	ID            uuid.UUID `json:"id"`
	Nome          string    `json:"nome"`
	Email         string    `json:"email"`
	AvatarURL     *string   `json:"avatar_url,omitempty"`
	Telefone      *string   `json:"telefone,omitempty"`
	IsSuperAdmin  bool      `json:"is_super_admin"`
	CurrentOrgID  *uuid.UUID `json:"current_org_id,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

// ─── Org ───────────────────────────────────────────────────────────────────
type Org struct {
	ID                 uuid.UUID  `json:"id"`
	Slug               string     `json:"slug"`
	Nome               string     `json:"nome"`
	CNPJ               *string    `json:"cnpj,omitempty"`
	RazaoSocial        *string    `json:"razao_social,omitempty"`
	Cidade             *string    `json:"cidade,omitempty"`
	Estado             *string    `json:"estado,omitempty"`
	Telefone           *string    `json:"telefone,omitempty"`
	EmailContato       *string    `json:"email_contato,omitempty"`
	LogoURL            *string    `json:"logo_url,omitempty"`
	CorPrimaria        string     `json:"cor_primaria"`
	PlanoID            uuid.UUID  `json:"plano_id"`
	Status             string     `json:"status"`
	TrialEndsAt        *time.Time `json:"trial_ends_at,omitempty"`
	OnboardingCompleto bool       `json:"onboarding_completo"`
	CreatedAt          time.Time  `json:"created_at"`
}

type OrgComMembro struct {
	Org
	MyRole string `json:"my_role"`
}

type CreateOrgDTO struct {
	Slug        string  `json:"slug"`
	Nome        string  `json:"nome"`
	CNPJ        *string `json:"cnpj"`
	RazaoSocial *string `json:"razao_social"`
	PlanoCodigo string  `json:"plano_codigo"` // 'free' | 'pro' | 'enterprise'
}

// ─── Empresa ───────────────────────────────────────────────────────────────
type Empresa struct {
	ID                  uuid.UUID `json:"id"`
	OrgID               uuid.UUID `json:"org_id"`
	CodigoInterno       *string   `json:"codigo_interno,omitempty"`
	RazaoSocial         string    `json:"razao_social"`
	NomeFantasia        *string   `json:"nome_fantasia,omitempty"`
	CNPJ                *string   `json:"cnpj,omitempty"`
	CPF                 *string   `json:"cpf,omitempty"`
	RegimeTributario    *string   `json:"regime_tributario,omitempty"`
	Cidade              *string   `json:"cidade,omitempty"`
	Estado              *string   `json:"estado,omitempty"`
	Email               *string   `json:"email,omitempty"`
	Telefone            *string   `json:"telefone,omitempty"`
	HonorarioMensalCents int64    `json:"honorario_mensal_cents"`
	Status              string    `json:"status"`
	Tags                []string  `json:"tags"`
	CreatedAt           time.Time `json:"created_at"`
}

type CreateEmpresaDTO struct {
	RazaoSocial          string   `json:"razao_social"`
	NomeFantasia         *string  `json:"nome_fantasia"`
	CNPJ                 *string  `json:"cnpj"`
	CPF                  *string  `json:"cpf"`
	CodigoInterno        *string  `json:"codigo_interno"`
	RegimeTributario     *string  `json:"regime_tributario"`
	Cidade               *string  `json:"cidade"`
	Estado               *string  `json:"estado"`
	Email                *string  `json:"email"`
	Telefone             *string  `json:"telefone"`
	HonorarioMensalCents int64    `json:"honorario_mensal_cents"`
	Tags                 []string `json:"tags"`
}

// ─── Entrega ───────────────────────────────────────────────────────────────
type Entrega struct {
	ID                    uuid.UUID  `json:"id"`
	OrgID                 uuid.UUID  `json:"org_id"`
	ObrigacaoEmpresaID    uuid.UUID  `json:"obrigacao_empresa_id"`
	EmpresaID             uuid.UUID  `json:"empresa_id"`
	ObrigacaoID           uuid.UUID  `json:"obrigacao_id"`
	Departamento          string     `json:"departamento"`
	Competencia           string     `json:"competencia"`
	PrazoLegal            time.Time  `json:"prazo_legal"`
	PrazoTecnico          time.Time  `json:"prazo_tecnico"`
	Status                string     `json:"status"`
	ResponsavelID         *uuid.UUID `json:"responsavel_id,omitempty"`
	CoResponsavelID       *uuid.UUID `json:"co_responsavel_id,omitempty"`
	EntregueEm            *time.Time `json:"entregue_em,omitempty"`
	Protocolo             *string    `json:"protocolo,omitempty"`
	MultaAplicada         bool       `json:"multa_aplicada"`
	MultaValorCents       int64      `json:"multa_valor_cents"`
	Observacoes           *string    `json:"observacoes,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`

	// Dados juntados (preenchidos por queries que fazem JOIN)
	EmpresaRazaoSocial *string `json:"empresa_razao_social,omitempty"`
	ObrigacaoNome      *string `json:"obrigacao_nome,omitempty"`
	ResponsavelNome    *string `json:"responsavel_nome,omitempty"`
	CoResponsavelNome  *string `json:"co_responsavel_nome,omitempty"`
}

type EntregaListFilter struct {
	Status         []string  `query:"status"`
	Departamento   *string   `query:"departamento"`
	ResponsavelID  *uuid.UUID `query:"responsavel_id"`
	CoResponsavelID *uuid.UUID `query:"co_responsavel"`
	EmpresaID      *uuid.UUID `query:"empresa_id"`
	Competencia    *string   `query:"competencia"` // yyyy-MM
	PrazoDe        *string   `query:"prazo_de"`
	PrazoAte       *string   `query:"prazo_ate"`
	BuscaTexto     *string   `query:"q"`
	Limit          int       `query:"limit"`
	Offset         int       `query:"offset"`
}

type UpdateEntregaStatusDTO struct {
	Status        string  `json:"status"`
	Protocolo     *string `json:"protocolo"`
	Observacoes   *string `json:"observacoes"`
	Justificativa *string `json:"justificativa"`
	CoResponsavelID *uuid.UUID `json:"co_responsavel_id"`
}

// ─── Chat ─────────────────────────────────────────────────────────────────
type ChatMensagem struct {
	ID          uuid.UUID  `json:"id"`
	OrgID       uuid.UUID  `json:"org_id"`
	CanalID     uuid.UUID  `json:"canal_id"`
	AutorID     *uuid.UUID `json:"autor_id,omitempty"`
	AutorNome   *string    `json:"autor_nome,omitempty"`
	AutorEmail  *string    `json:"autor_email,omitempty"`
	AvatarURL   *string    `json:"avatar_url,omitempty"`
	Conteudo    string     `json:"conteudo"`
	Mencoes     []uuid.UUID `json:"mencoes"`
	RepliedToID *uuid.UUID `json:"replied_to_id,omitempty"`
	CriadaEm    time.Time  `json:"criada_em"`
	Anexos      []ChatAnexo `json:"anexos"`
}

type ChatAnexo struct {
	ID            uuid.UUID `json:"id"`
	MensagemID    uuid.UUID `json:"mensagem_id"`
	StoragePath   string    `json:"storage_path"`
	NomeOriginal  string    `json:"nome_original"`
	MimeType      *string   `json:"mime_type,omitempty"`
	TamanhoBytes  int64     `json:"tamanho_bytes"`
	CriadoEm      time.Time `json:"criado_em"`
}

type CreateChatMensagemDTO struct {
	Conteudo    string     `json:"conteudo"`
	Mencoes     []uuid.UUID `json:"mencoes"`
	RepliedToID *uuid.UUID `json:"replied_to_id"`
}

// ─── Solicitações ─────────────────────────────────────────────────────────
type Solicitacao struct {
	ID            uuid.UUID  `json:"id"`
	OrgID         uuid.UUID  `json:"org_id"`
	EmpresaID     *uuid.UUID `json:"empresa_id,omitempty"`
	EntregaID     *uuid.UUID `json:"entrega_id,omitempty"`
	Assunto       string     `json:"assunto"`
	Descricao     *string    `json:"descricao,omitempty"`
	Prioridade    string     `json:"prioridade"`
	Status        string     `json:"status"`
	ResponsavelID *uuid.UUID `json:"responsavel_id,omitempty"`
	ResolvidaEm   *time.Time `json:"resolvida_em,omitempty"`
	FechadaEm     *time.Time `json:"fechada_em,omitempty"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type UpdateSolicitacaoDTO struct {
	Status        *string    `json:"status"`
	ResponsavelID *uuid.UUID `json:"responsavel_id"`
	Prioridade    *string    `json:"prioridade"`
}

type SolicitacaoMensagem struct {
	ID            uuid.UUID  `json:"id"`
	OrgID         uuid.UUID  `json:"org_id"`
	SolicitacaoID uuid.UUID  `json:"solicitacao_id"`
	AutorID       *uuid.UUID `json:"autor_id,omitempty"`
	AutorTipo     string     `json:"autor_tipo"`
	AutorNome     *string    `json:"autor_nome,omitempty"`
	Conteudo      string     `json:"conteudo"`
	Interna       bool       `json:"interna"`
	CriadoEm      time.Time  `json:"criado_em"`
}

type CreateSolicitacaoMensagemDTO struct {
	Conteudo string `json:"conteudo"`
	Interna  bool   `json:"interna"`
}

// ─── Obrigações ───────────────────────────────────────────────────────────
type ObrigacaoCatalogo struct {
	ID             uuid.UUID `json:"id"`
	OrgID          uuid.UUID `json:"org_id"`
	Codigo         string    `json:"codigo"`
	Nome           string    `json:"nome"`
	Departamento   string    `json:"departamento"`
	Periodicidade  string    `json:"periodicidade"`
	ReferenciaDia  string    `json:"referencia_dia"`
	DiaLegal       *int      `json:"dia_legal,omitempty"`
	Ativa          bool      `json:"ativa"`
	Publicada      bool      `json:"publicada"`
}

type HerdarObrigacaoDTO struct {
	ObrigacaoID uuid.UUID `json:"obrigacao_id"`
}

type ObrigacaoEmpresa struct {
	ID           uuid.UUID  `json:"id"`
	OrgID        uuid.UUID  `json:"org_id"`
	ObrigacaoID  uuid.UUID  `json:"obrigacao_id"`
	EmpresaID    uuid.UUID  `json:"empresa_id"`
	ResponsavelID *uuid.UUID `json:"responsavel_id,omitempty"`
	Ativa        bool       `json:"ativa"`
}

type CreateObrigacaoEmpresaDTO struct {
	ObrigacaoID   uuid.UUID  `json:"obrigacao_id"`
	EmpresaID     uuid.UUID  `json:"empresa_id"`
	ResponsavelID *uuid.UUID `json:"responsavel_id"`
}

// ─── Configurações da org ─────────────────────────────────────────────────
type ConvidarMembroDTO struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

type UpdateMembroDTO struct {
	Role *string `json:"role"`
}

type OrgMembro struct {
	ID     uuid.UUID `json:"id"`
	OrgID  uuid.UUID `json:"org_id"`
	UserID uuid.UUID `json:"user_id"`
	Role   string    `json:"role"`
	Status string    `json:"status"`
}

type UpdateOrgConfiguracoesDTO struct {
	CorPrimaria *string `json:"cor_primaria"`
	LogoURL     *string `json:"logo_url"`
}

type OrgConfiguracoes struct {
	ID          uuid.UUID `json:"id"`
	CorPrimaria string    `json:"cor_primaria"`
	LogoURL     *string   `json:"logo_url,omitempty"`
}

// ─── Uploads assinados ────────────────────────────────────────────────────
type PrepararUploadRequest struct {
	Contexto        string         `json:"contexto"`
	ContextoID      *uuid.UUID      `json:"contexto_id"`
	ContextoPayload map[string]any `json:"contexto_payload"`
	NomeOriginal    string         `json:"nome_original"`
	MimeType        string         `json:"mime_type"`
	TamanhoBytes    int64          `json:"tamanho_bytes"`
	HashSHA256      string         `json:"hash_sha256"`
}

type PrepararUploadResponse struct {
	UploadID    uuid.UUID `json:"upload_id"`
	UploadURL   string    `json:"upload_url"`
	StoragePath string    `json:"storage_path"`
	Bucket      string    `json:"bucket"`
	ExpiresAt   time.Time `json:"expires_at"`
	MaxBytes    int64     `json:"max_bytes"`
}

type ConfirmarUploadRequest struct {
	HashSHA256      string         `json:"hash_sha256"`
	ContextoPayload map[string]any `json:"contexto_payload"`
}

type ConfirmarUploadResponse struct {
	EntregaID           *uuid.UUID `json:"entrega_id,omitempty"`
	ArquivoID           *uuid.UUID `json:"arquivo_id,omitempty"`
	SolicitacaoAnexoID   *uuid.UUID `json:"solicitacao_anexo_id,omitempty"`
	MuralAnexoID        *uuid.UUID `json:"mural_anexo_id,omitempty"`
	ChatAnexoID          *uuid.UUID `json:"chat_anexo_id,omitempty"`
	Status              string     `json:"status"`
}

type UploadPendente struct {
	ID                 uuid.UUID      `json:"id"`
	OrgID              uuid.UUID      `json:"org_id"`
	UserID             *uuid.UUID     `json:"user_id,omitempty"`
	Bucket             string         `json:"bucket"`
	StoragePath        string         `json:"storage_path"`
	NomeOriginal       string         `json:"nome_original"`
	MimeType           *string        `json:"mime_type,omitempty"`
	TamanhoEsperado    int64          `json:"tamanho_esperado"`
	HashSHA256Esperado *string        `json:"hash_sha256_esperado,omitempty"`
	Contexto           string         `json:"contexto"`
	ContextoID         *uuid.UUID     `json:"contexto_id,omitempty"`
	ContextoPayload    map[string]any `json:"contexto_payload"`
	ExpiraEm           time.Time      `json:"expira_em"`
	ConfirmadoEm       *time.Time     `json:"confirmado_em,omitempty"`
	CanceladoEm        *time.Time     `json:"cancelado_em,omitempty"`
	Erro               *string        `json:"erro,omitempty"`
	CreatedAt          time.Time      `json:"created_at"`
}

type DownloadURLResponse struct {
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expires_at"`
}

// ─── Cortex ───────────────────────────────────────────────────────────────
type CortexConversa struct {
	ID             uuid.UUID `json:"id"`
	OrgID          uuid.UUID `json:"org_id"`
	UserID         uuid.UUID `json:"user_id"`
	Titulo         *string   `json:"titulo,omitempty"`
	ContextoPagina *string   `json:"contexto_pagina,omitempty"`
	Arquivada      bool      `json:"arquivada"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type CortexMensagem struct {
	ID           uuid.UUID      `json:"id"`
	OrgID        uuid.UUID      `json:"org_id"`
	ConversaID   uuid.UUID      `json:"conversa_id"`
	Papel        string         `json:"papel"`
	Conteudo     *string        `json:"conteudo,omitempty"`
	ToolChamadas map[string]any `json:"tool_chamadas,omitempty"`
	Modelo       *string        `json:"modelo,omitempty"`
	CriadaEm     time.Time      `json:"criada_em"`
}

type CreateCortexConversaDTO struct {
	Titulo         *string `json:"titulo"`
	ContextoPagina *string `json:"contexto_pagina"`
}

type CreateCortexMensagemDTO struct {
	Conteudo string `json:"conteudo"`
}

type CortexConversaDetalhe struct {
	Conversa  CortexConversa   `json:"conversa"`
	Mensagens []CortexMensagem `json:"mensagens"`
}

type CortexToolEvent struct {
	Ferramenta string         `json:"ferramenta"`
	Resumo     string         `json:"resumo"`
	Resultado   map[string]any `json:"resultado,omitempty"`
}

// ─── Departamentos / premiação ────────────────────────────────────────────
type OrgDepartamento struct {
	ID                   uuid.UUID  `json:"id"`
	OrgID                uuid.UUID  `json:"org_id"`
	Codigo               string     `json:"codigo"`
	Nome                 string     `json:"nome"`
	GerenteID            *uuid.UUID `json:"gerente_id,omitempty"`
	GerenteNome          *string    `json:"gerente_nome,omitempty"`
	MetaPercNoPrazo      *float64   `json:"meta_perc_no_prazo,omitempty"`
	MetaDiasAntecedencia *int       `json:"meta_dias_antecedencia,omitempty"`
	PremiacaoModo        string     `json:"premiacao_modo"`
	Descricao            *string    `json:"descricao,omitempty"`
}

type UpdateOrgDepartamentoDTO struct {
	PremiacaoModo        *string    `json:"premiacao_modo"`
	MetaPercNoPrazo      *float64   `json:"meta_perc_no_prazo"`
	MetaDiasAntecedencia *int       `json:"meta_dias_antecedencia"`
	GerenteID            *uuid.UUID `json:"gerente_id"`
}

type LancamentoManualPontosDTO struct {
	UserID          uuid.UUID  `json:"user_id"`
	Evento          string     `json:"evento"`
	Pontos          int        `json:"pontos"`
	Justificativa   string     `json:"justificativa"`
	ReferenciaTipo  *string    `json:"referencia_tipo"`
	ReferenciaID    *uuid.UUID `json:"referencia_id"`
}

type PontosEvento struct {
	ID              uuid.UUID  `json:"id"`
	OrgID           uuid.UUID  `json:"org_id"`
	UserID          uuid.UUID  `json:"user_id"`
	Evento          string     `json:"evento"`
	Pontos          int        `json:"pontos"`
	ReferenciaTipo  *string    `json:"referencia_tipo,omitempty"`
	ReferenciaID    *uuid.UUID `json:"referencia_id,omitempty"`
	Justificativa   *string    `json:"justificativa,omitempty"`
	CriadoPorID     *uuid.UUID `json:"criado_por_id,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// ─── Balancetes ───────────────────────────────────────────────────────────
type Balancete struct {
	ID           uuid.UUID  `json:"id"`
	OrgID        uuid.UUID  `json:"org_id"`
	EmpresaID    uuid.UUID  `json:"empresa_id"`
	EmpresaNome  *string    `json:"empresa_nome,omitempty"`
	Competencia  string     `json:"competencia"`
	Fechado      bool       `json:"fechado"`
	FechadoEm    *time.Time `json:"fechado_em,omitempty"`
	FechadoPorID *uuid.UUID `json:"fechado_por_id,omitempty"`
	Observacoes  *string    `json:"observacoes,omitempty"`
	ContasCount  int        `json:"contas_count"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type BalanceteConta struct {
	ID            uuid.UUID `json:"id"`
	BalanceteID   uuid.UUID `json:"balancete_id"`
	OrgID         uuid.UUID `json:"org_id"`
	Codigo        string    `json:"codigo"`
	Descricao     string    `json:"descricao"`
	Grupo         *string   `json:"grupo,omitempty"`
	SaldoAnterior float64   `json:"saldo_anterior"`
	Debito        float64   `json:"debito"`
	Credito       float64   `json:"credito"`
	SaldoAtual    float64   `json:"saldo_atual"`
	Natureza      *string   `json:"natureza,omitempty"`
	Ordem         int       `json:"ordem"`
}

type BalanceteDetalhe struct {
	Balancete Balancete        `json:"balancete"`
	Contas    []BalanceteConta `json:"contas"`
}

type CreateBalanceteDTO struct {
	EmpresaID    uuid.UUID `json:"empresa_id"`
	Competencia  string    `json:"competencia"`
	Observacoes  *string   `json:"observacoes"`
}

type ReplaceBalanceteContasDTO struct {
	Contas []ReplaceBalanceteContaDTO `json:"contas"`
}

type ReplaceBalanceteContaDTO struct {
	Codigo        string  `json:"codigo"`
	Descricao     string  `json:"descricao"`
	Grupo         *string `json:"grupo"`
	SaldoAnterior float64 `json:"saldo_anterior"`
	Debito        float64 `json:"debito"`
	Credito       float64 `json:"credito"`
	SaldoAtual    float64 `json:"saldo_atual"`
	Natureza      *string `json:"natureza"`
	Ordem         int     `json:"ordem"`
}

type BalanceteComparativo struct {
	Competencias []string                    `json:"competencias"`
	Balancetes   []Balancete                 `json:"balancetes"`
	Linhas       []BalanceteComparativoLinha `json:"linhas"`
}

type BalanceteComparativoLinha struct {
	Codigo       string             `json:"codigo"`
	Descricao    string             `json:"descricao"`
	Grupo        *string            `json:"grupo,omitempty"`
	Natureza     *string            `json:"natureza,omitempty"`
	Valores      map[string]float64 `json:"valores"`
	Variacao     float64            `json:"variacao"`
	VariacaoPerc *float64           `json:"variacao_perc,omitempty"`
}

// ─── Página paginada genérica ──────────────────────────────────────────────
type Page[T any] struct {
	Data   []T `json:"data"`
	Total  int `json:"total"`
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}
