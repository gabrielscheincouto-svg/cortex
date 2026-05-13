/**
 * Cliente HTTP que fala com a API Go (Fase 2).
 *
 * Em Server Components/Actions, pega o JWT da sessão Supabase via cookies e injeta como Bearer.
 * Em Client Components, recebe o token via prop ou pega do supabase-js (createBrowserClient).
 */

import { createServerClient } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

class APIError extends Error {
  status: number
  detail?: unknown
  constructor(message: string, status: number, detail?: unknown) {
    super(message)
    this.status = status
    this.detail = detail
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

function safeJson(text: string): unknown {
  try { return JSON.parse(text) } catch { return text }
}

/** API client server-side. Pega o JWT do user atual automaticamente. */
export async function apiServer() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  return {
    me:           () => fetchJSON<{ profile: Profile; orgs: OrgComMembro[] }>('/api/v1/me', { token }),
    listOrgs:     () => fetchJSON<OrgComMembro[]>('/api/v1/orgs', { token }),
    createOrg:    (dto: CreateOrgDTO) => fetchJSON<Org>('/api/v1/orgs', { method: 'POST', body: JSON.stringify(dto), token }),
    listEmpresas: (q?: string) => fetchJSON<Page<Empresa>>(`/api/v1/empresas${q ? `?q=${encodeURIComponent(q)}` : ''}`, { token }),
    getDownloadURL: (id: string) => fetchJSON<DownloadURLResponse>(`/api/v1/arquivos/${id}/download-url`, { token }),
  }
}

/** API client browser-side. Recebe o token externamente. */
export function apiBrowser(token: string) {
  return {
    me:           () => fetchJSON<{ profile: Profile; orgs: OrgComMembro[] }>('/api/v1/me', { token }),
    setCurrentOrg: (org_id: string) => fetchJSON<void>('/api/v1/me/current-org', { method: 'PATCH', body: JSON.stringify({ org_id }), token }),
    listOrgs:     () => fetchJSON<OrgComMembro[]>('/api/v1/orgs', { token }),
    createOrg:    (dto: CreateOrgDTO) => fetchJSON<Org>('/api/v1/orgs', { method: 'POST', body: JSON.stringify(dto), token }),
    prepararUpload: (dto: PrepararUploadRequest) =>
      fetchJSON<PrepararUploadResponse>('/api/v1/uploads/preparar', { method: 'POST', body: JSON.stringify(dto), token }),
    confirmarUpload: (id: string, dto: ConfirmarUploadRequest) =>
      fetchJSON<ConfirmarUploadResponse>(`/api/v1/uploads/${id}/confirmar`, { method: 'POST', body: JSON.stringify(dto), token }),
    cancelarUpload: (id: string) => fetchJSON<void>(`/api/v1/uploads/${id}/cancelar`, { method: 'POST', token }),
    getDownloadURL: (id: string) => fetchJSON<DownloadURLResponse>(`/api/v1/arquivos/${id}/download-url`, { token }),
  }
}

// ─── Tipos compartilhados com a API Go ───
export interface Profile {
  id: string
  nome: string
  email: string
  is_super_admin: boolean
  current_org_id?: string
}

export interface Org {
  id: string
  slug: string
  nome: string
  cnpj?: string
  razao_social?: string
  cor_primaria: string
  plano_id: string
  status: 'trial' | 'ativo' | 'suspenso' | 'cancelado'
  onboarding_completo: boolean
  created_at: string
}

export interface OrgComMembro extends Org {
  my_role: string
}

export interface CreateOrgDTO {
  slug: string
  nome: string
  cnpj?: string
  razao_social?: string
  plano_codigo: 'free' | 'pro' | 'enterprise'
}

export interface Empresa {
  id: string
  org_id: string
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  status: string
  honorario_mensal_cents: number
  tags: string[]
  created_at: string
}

export interface Page<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

export interface PrepararUploadRequest {
  contexto: 'robo_entrega' | 'manual_entrega' | 'solicitacao' | 'mural' | 'chat' | 'avatar' | 'logo_org' | 'cliente_arquivo'
  contexto_id?: string
  contexto_payload?: Record<string, unknown>
  nome_original: string
  mime_type: string
  tamanho_bytes: number
  hash_sha256?: string
}

export interface PrepararUploadResponse {
  upload_id: string
  upload_url: string
  storage_path: string
  bucket: string
  expires_at: string
  max_bytes: number
}

export interface ConfirmarUploadRequest {
  hash_sha256?: string
  contexto_payload?: Record<string, unknown>
}

export interface ConfirmarUploadResponse {
  entrega_id?: string
  arquivo_id?: string
  solicitacao_anexo_id?: string
  mural_anexo_id?: string
  chat_anexo_id?: string
  status: string
}

export interface DownloadURLResponse {
  url: string
  expires_at: string
}
