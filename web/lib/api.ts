/** Cliente HTTP da API Go. Versão do frontend escritório (espelha admin com endpoints próprios). */

import { createServerClient } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
export const API_BASE_URL = API_URL

class APIError extends Error {
  status: number
  detail?: unknown
  constructor(message: string, status: number, detail?: unknown) {
    super(message); this.status = status; this.detail = detail
  }
}

async function fetchJSON<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: 'no-store',
  })
  const text = await res.text()
  const body = text ? safeJson(text) : null
  if (!res.ok) {
    const message = (body as { message?: string } | null)?.message ?? `${res.status} ${res.statusText}`
    throw new APIError(message, res.status, body)
  }
  return body as T
}

function safeJson(t: string): unknown {
  try { return JSON.parse(t) } catch { return t }
}

export async function apiServer() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  return {
    me:               () => fetchJSON<{ profile: Profile; orgs: OrgComMembro[] }>('/api/v1/me', { token }),
    setCurrentOrg:    (org_id: string) => fetchJSON<void>('/api/v1/me/current-org', { method: 'PATCH', body: JSON.stringify({ org_id }), token }),
    listEmpresas:     (q?: string) => fetchJSON<Page<Empresa>>(`/api/v1/empresas${q ? `?q=${encodeURIComponent(q)}` : ''}`, { token }),
    createEmpresa:    (dto: CreateEmpresaDTO) => fetchJSON<Empresa>('/api/v1/empresas', { method: 'POST', body: JSON.stringify(dto), token }),
    listEntregas:     (params: Record<string, string | number | undefined>) => {
      const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()
      return fetchJSON<Page<Entrega>>(`/api/v1/entregas${q ? `?${q}` : ''}`, { token })
    },
    updateEntregaStatus: (id: string, dto: UpdateEntregaStatusDTO) =>
      fetchJSON<Entrega>(`/api/v1/entregas/${id}/status`, { method: 'PATCH', body: JSON.stringify(dto), token }),
    listDepartamentos: () => fetchJSON<OrgDepartamento[]>('/api/v1/org/departamentos', { token }),
  }
}

export function apiBrowser(token: string) {
  return {
    setCurrentOrg: (org_id: string) => fetchJSON<void>('/api/v1/me/current-org', { method: 'PATCH', body: JSON.stringify({ org_id }), token }),
    createEmpresa: (dto: CreateEmpresaDTO) => fetchJSON<Empresa>('/api/v1/empresas', { method: 'POST', body: JSON.stringify(dto), token }),
    updateEntregaStatus: (id: string, dto: UpdateEntregaStatusDTO) =>
      fetchJSON<Entrega>(`/api/v1/entregas/${id}/status`, { method: 'PATCH', body: JSON.stringify(dto), token }),
    createChatMensagem: (canalId: string, dto: CreateChatMensagemDTO) =>
      fetchJSON<ChatMensagem>(`/api/v1/chat/canais/${canalId}/mensagens`, { method: 'POST', body: JSON.stringify(dto), token }),
    updateSolicitacao: (id: string, dto: UpdateSolicitacaoDTO) =>
      fetchJSON<Solicitacao>(`/api/v1/solicitacoes/${id}`, { method: 'PATCH', body: JSON.stringify(dto), token }),
    createSolicitacaoMensagem: (id: string, dto: CreateSolicitacaoMensagemDTO) =>
      fetchJSON<SolicitacaoMensagem>(`/api/v1/solicitacoes/${id}/mensagens`, { method: 'POST', body: JSON.stringify(dto), token }),
    herdarObrigacao: (obrigacao_id: string) =>
      fetchJSON<ObrigacaoCatalogo>('/api/v1/obrigacoes/herdar', { method: 'POST', body: JSON.stringify({ obrigacao_id }), token }),
    createObrigacaoEmpresa: (dto: CreateObrigacaoEmpresaDTO) =>
      fetchJSON<ObrigacaoEmpresa>('/api/v1/obrigacao-empresa', { method: 'POST', body: JSON.stringify(dto), token }),
    deleteObrigacaoEmpresa: (id: string) =>
      fetchJSON<void>(`/api/v1/obrigacao-empresa/${id}`, { method: 'DELETE', token }),
    convidarMembro: (dto: ConvidarMembroDTO) =>
      fetchJSON<OrgMembro>('/api/v1/org/membros/convidar', { method: 'POST', body: JSON.stringify(dto), token }),
    updateMembro: (id: string, dto: UpdateMembroDTO) =>
      fetchJSON<OrgMembro>(`/api/v1/org/membros/${id}`, { method: 'PATCH', body: JSON.stringify(dto), token }),
    deleteMembro: (id: string) =>
      fetchJSON<void>(`/api/v1/org/membros/${id}`, { method: 'DELETE', token }),
    updateOrgConfiguracoes: (dto: UpdateOrgConfiguracoesDTO) =>
      fetchJSON<OrgConfiguracoes>('/api/v1/org/configuracoes', { method: 'PATCH', body: JSON.stringify(dto), token }),
    listDepartamentos: () =>
      fetchJSON<OrgDepartamento[]>('/api/v1/org/departamentos', { token }),
    updateDepartamento: (codigo: string, dto: UpdateOrgDepartamentoDTO) =>
      fetchJSON<OrgDepartamento>(`/api/v1/org/departamentos/${codigo}`, { method: 'PATCH', body: JSON.stringify(dto), token }),
    lancamentoManualPontos: (dto: LancamentoManualPontosDTO) =>
      fetchJSON<PontosEvento>('/api/v1/pontos/lancamento-manual', { method: 'POST', body: JSON.stringify(dto), token }),
    listKanbanTarefas: () =>
      fetchJSON<KanbanTarefa[]>('/api/v1/kanban/tarefas', { token }),
    createKanbanTarefa: (dto: CreateKanbanTarefaDTO) =>
      fetchJSON<{ id: string }>('/api/v1/kanban/tarefas', { method: 'POST', body: JSON.stringify(dto), token }),
    updateKanbanTarefa: (id: string, dto: Partial<CreateKanbanTarefaDTO> & { status?: KanbanStatus }) =>
      fetchJSON<void>(`/api/v1/kanban/tarefas/${id}`, { method: 'PATCH', body: JSON.stringify(dto), token }),
    deleteKanbanTarefa: (id: string) =>
      fetchJSON<void>(`/api/v1/kanban/tarefas/${id}`, { method: 'DELETE', token }),
    listFrequencia: (competencia: string) =>
      fetchJSON<FrequenciaDia[]>(`/api/v1/frequencia?competencia=${encodeURIComponent(competencia)}`, { token }),
    patchFrequencia: (userId: string, data: string, dto: PatchFrequenciaDTO) =>
      fetchJSON<void>(`/api/v1/frequencia/${userId}/${data}`, { method: 'PATCH', body: JSON.stringify(dto), token }),
    fecharMesFrequencia: (competencia: string) =>
      fetchJSON<void>('/api/v1/frequencia/fechar-mes', { method: 'POST', body: JSON.stringify({ competencia }), token }),
    listBalancetes: (params: Record<string, string | number | undefined> = {}) => {
      const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString()
      return fetchJSON<Page<Balancete>>(`/api/v1/balancetes${q ? `?${q}` : ''}`, { token })
    },
    createBalancete: (dto: CreateBalanceteDTO) =>
      fetchJSON<Balancete>('/api/v1/balancetes', { method: 'POST', body: JSON.stringify(dto), token }),
    getBalancete: (id: string) =>
      fetchJSON<BalanceteDetalhe>(`/api/v1/balancetes/${id}`, { token }),
    replaceBalanceteContas: (id: string, contas: ReplaceBalanceteContaDTO[]) =>
      fetchJSON<void>(`/api/v1/balancetes/${id}/contas`, { method: 'POST', body: JSON.stringify({ contas }), token }),
    fecharBalancete: (id: string) =>
      fetchJSON<Balancete>(`/api/v1/balancetes/${id}/fechar`, { method: 'PATCH', token }),
    getBalanceteComparativo: (empresaId: string, competencias: string[]) =>
      fetchJSON<BalanceteComparativo>(`/api/v1/balancetes/comparativo?empresa_id=${empresaId}&competencias=${competencias.join(',')}`, { token }),
    prepararUpload: (dto: PrepararUploadRequest) =>
      fetchJSON<PrepararUploadResponse>('/api/v1/uploads/preparar', { method: 'POST', body: JSON.stringify(dto), token }),
    confirmarUpload: (id: string, dto: ConfirmarUploadRequest) =>
      fetchJSON<ConfirmarUploadResponse>(`/api/v1/uploads/${id}/confirmar`, { method: 'POST', body: JSON.stringify(dto), token }),
    cancelarUpload: (id: string) =>
      fetchJSON<void>(`/api/v1/uploads/${id}/cancelar`, { method: 'POST', token }),
    getDownloadURL: (id: string) =>
      fetchJSON<DownloadURLResponse>(`/api/v1/arquivos/${id}/download-url`, { token }),
    listCortexConversas: () =>
      fetchJSON<CortexConversa[]>('/api/v1/cortex/conversas', { token }),
    createCortexConversa: (dto: CreateCortexConversaDTO) =>
      fetchJSON<CortexConversa>('/api/v1/cortex/conversas', { method: 'POST', body: JSON.stringify(dto), token }),
    getCortexConversa: (id: string) =>
      fetchJSON<CortexConversaDetalhe>(`/api/v1/cortex/conversas/${id}`, { token }),
    deleteCortexConversa: (id: string) =>
      fetchJSON<void>(`/api/v1/cortex/conversas/${id}`, { method: 'DELETE', token }),
  }
}

// Tipos
export interface Profile {
  id: string; nome: string; email: string;
  avatar_url?: string;
  is_super_admin: boolean;
  current_org_id?: string;
}

export interface Org {
  id: string; slug: string; nome: string; cor_primaria: string;
  plano_id: string; status: string; onboarding_completo: boolean;
}

export interface OrgComMembro extends Org { my_role: string }

export interface Empresa {
  id: string; org_id: string;
  razao_social: string; nome_fantasia?: string; cnpj?: string;
  status: string; tags: string[];
  honorario_mensal_cents: number;
  created_at: string;
}

export interface CreateEmpresaDTO {
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
  honorario_mensal_cents?: number;
  tags?: string[];
}

export interface Entrega {
  id: string; org_id: string;
  competencia: string; prazo_legal: string; prazo_tecnico: string;
  status: string; departamento: string;
  responsavel_id?: string; entregue_em?: string;
  co_responsavel_id?: string;
  protocolo?: string; multa_aplicada: boolean;
  observacoes?: string; created_at: string;
  empresa_razao_social?: string;
  obrigacao_nome?: string;
  responsavel_nome?: string;
  co_responsavel_nome?: string;
}

export interface UpdateEntregaStatusDTO {
  status: 'pendente' | 'em_andamento' | 'aguardando_cliente' | 'entregue' | 'justificada' | 'dispensada' | 'atrasada';
  protocolo?: string;
  observacoes?: string;
  justificativa?: string;
  co_responsavel_id?: string;
}

export interface ChatMensagem {
  id: string;
  org_id: string;
  canal_id: string;
  autor_id?: string;
  autor_nome?: string;
  autor_email?: string;
  avatar_url?: string;
  conteudo: string;
  mencoes: string[];
  replied_to_id?: string;
  criada_em: string;
  anexos?: ChatAnexo[];
}

export interface ChatAnexo {
  id: string;
  mensagem_id: string;
  storage_path: string;
  nome_original: string;
  mime_type?: string;
  tamanho_bytes: number;
  criado_em: string;
}

export interface CreateChatMensagemDTO {
  conteudo: string;
  mencoes?: string[];
  replied_to_id?: string;
}

export interface Solicitacao {
  id: string;
  org_id: string;
  empresa_id?: string;
  entrega_id?: string;
  assunto: string;
  descricao?: string;
  prioridade: string;
  status: string;
  responsavel_id?: string;
  resolvida_em?: string;
  fechada_em?: string;
  updated_at: string;
}

export interface UpdateSolicitacaoDTO {
  status?: string;
  responsavel_id?: string;
  prioridade?: string;
}

export interface SolicitacaoMensagem {
  id: string;
  org_id: string;
  solicitacao_id: string;
  autor_id?: string;
  autor_tipo: 'escritorio' | 'cliente' | 'sistema';
  autor_nome?: string;
  conteudo: string;
  interna: boolean;
  criado_em: string;
}

export interface CreateSolicitacaoMensagemDTO {
  conteudo: string;
  interna: boolean;
}

export interface ObrigacaoCatalogo {
  id: string;
  org_id?: string;
  codigo: string;
  nome: string;
  departamento: string;
  periodicidade: string;
  referencia_dia: string;
  dia_legal?: number;
  ativa: boolean;
  publicada: boolean;
}

export interface ObrigacaoEmpresa {
  id: string;
  org_id: string;
  obrigacao_id: string;
  empresa_id: string;
  responsavel_id?: string;
  ativa: boolean;
}

export interface CreateObrigacaoEmpresaDTO {
  obrigacao_id: string;
  empresa_id: string;
  responsavel_id?: string;
}

export interface ConvidarMembroDTO {
  email: string;
  role: string;
}

export interface UpdateMembroDTO {
  role?: string;
}

export interface OrgMembro {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  status: string;
}

export interface UpdateOrgConfiguracoesDTO {
  cor_primaria?: string;
  logo_url?: string;
}

export interface OrgConfiguracoes {
  id: string;
  cor_primaria: string;
  logo_url?: string;
}

export interface PrepararUploadRequest {
  contexto: 'robo_entrega' | 'manual_entrega' | 'solicitacao' | 'mural' | 'chat' | 'avatar' | 'logo_org' | 'cliente_arquivo';
  contexto_id?: string;
  contexto_payload?: Record<string, unknown>;
  nome_original: string;
  mime_type: string;
  tamanho_bytes: number;
  hash_sha256?: string;
}

export interface PrepararUploadResponse {
  upload_id: string;
  upload_url: string;
  storage_path: string;
  bucket: string;
  expires_at: string;
  max_bytes: number;
}

export interface ConfirmarUploadRequest {
  hash_sha256?: string;
  contexto_payload?: Record<string, unknown>;
}

export interface ConfirmarUploadResponse {
  entrega_id?: string;
  arquivo_id?: string;
  solicitacao_anexo_id?: string;
  mural_anexo_id?: string;
  chat_anexo_id?: string;
  status: string;
}

export interface DownloadURLResponse {
  url: string;
  expires_at: string;
}

export interface CortexConversa {
  id: string;
  org_id: string;
  user_id: string;
  titulo?: string;
  contexto_pagina?: string;
  arquivada: boolean;
  created_at: string;
  updated_at: string;
}

export interface CortexMensagem {
  id: string;
  org_id: string;
  conversa_id: string;
  papel: 'user' | 'assistant' | 'system' | 'tool';
  conteudo?: string;
  tool_chamadas?: Record<string, unknown>;
  modelo?: string;
  criada_em: string;
}

export interface CreateCortexConversaDTO {
  titulo?: string;
  contexto_pagina?: string;
}

export interface CortexConversaDetalhe {
  conversa: CortexConversa;
  mensagens: CortexMensagem[];
}

export interface OrgDepartamento {
  id: string;
  org_id: string;
  codigo: string;
  nome: string;
  gerente_id?: string;
  gerente_nome?: string;
  meta_perc_no_prazo?: number;
  meta_dias_antecedencia?: number;
  premiacao_modo: 'automatico' | 'manual';
  descricao?: string;
}

export interface UpdateOrgDepartamentoDTO {
  premiacao_modo?: 'automatico' | 'manual';
  meta_perc_no_prazo?: number;
  meta_dias_antecedencia?: number;
  gerente_id?: string;
}

export interface LancamentoManualPontosDTO {
  user_id: string;
  evento?: string;
  pontos: number;
  justificativa: string;
  referencia_tipo?: string;
  referencia_id?: string;
}

export interface PontosEvento {
  id: string;
  org_id: string;
  user_id: string;
  evento: string;
  pontos: number;
  created_at: string;
}

export type KanbanStatus = 'a_fazer' | 'em_andamento' | 'concluido' | 'cancelado';
export interface KanbanTarefa {
  id: string;
  titulo: string;
  descricao?: string;
  departamento?: string;
  prioridade?: 'baixa' | 'media' | 'alta' | 'urgente';
  status: KanbanStatus;
  responsavel_id?: string;
  co_responsavel_id?: string;
  prazo?: string;
  created_at: string;
}

export interface CreateKanbanTarefaDTO {
  titulo: string;
  descricao?: string;
  departamento?: string;
  prioridade?: 'baixa' | 'media' | 'alta' | 'urgente';
  responsavel_id?: string;
  co_responsavel_id?: string;
  prazo?: string;
}

export interface FrequenciaDia {
  user_id: string;
  nome: string;
  data?: string;
  status?: 'presente' | 'falta' | 'folga' | 'atestado' | 'home_office' | 'ferias';
  horario_chegada?: string;
  minutos_atraso?: number;
  justificativa?: string;
}

export interface PatchFrequenciaDTO {
  status: 'presente' | 'falta' | 'folga' | 'atestado' | 'home_office' | 'ferias';
  horario_chegada?: string;
  justificativa?: string;
}

export interface Balancete {
  id: string;
  org_id: string;
  empresa_id: string;
  empresa_nome?: string;
  competencia: string;
  fechado: boolean;
  fechado_em?: string;
  fechado_por_id?: string;
  observacoes?: string;
  contas_count: number;
  created_at: string;
  updated_at: string;
}

export interface BalanceteConta {
  id: string;
  balancete_id: string;
  org_id: string;
  codigo: string;
  descricao: string;
  grupo?: string;
  saldo_anterior: number;
  debito: number;
  credito: number;
  saldo_atual: number;
  natureza?: 'D' | 'C';
  ordem: number;
}

export interface BalanceteDetalhe {
  balancete: Balancete;
  contas: BalanceteConta[];
}

export interface CreateBalanceteDTO {
  empresa_id: string;
  competencia: string;
  observacoes?: string;
}

export interface ReplaceBalanceteContaDTO {
  codigo: string;
  descricao: string;
  grupo?: string;
  saldo_anterior: number;
  debito: number;
  credito: number;
  saldo_atual: number;
  natureza?: 'D' | 'C';
  ordem?: number;
}

export interface BalanceteComparativoLinha {
  codigo: string;
  descricao: string;
  grupo?: string;
  natureza?: string;
  valores: Record<string, number>;
  variacao: number;
  variacao_perc?: number;
}

export interface BalanceteComparativo {
  competencias: string[];
  balancetes: Balancete[];
  linhas: BalanceteComparativoLinha[];
}

export interface Page<T> {
  data: T[]; total: number; limit: number; offset: number;
}
