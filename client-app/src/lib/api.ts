/**
 * Wrapper de chamadas à API Go (cortex-production-f46c.up.railway.app).
 *
 * Usado para MUTAÇÕES que têm regra de negócio (criar solicitação, enviar
 * mensagem, marcar lido, etc.). Para LEITURA, prefira queries direto no
 * Supabase via @supabase/supabase-js — RLS garante o tenant isolation.
 */
import { getSupabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL ?? 'https://cortex-production-f46c.up.railway.app'

export interface ApiError {
  readonly error: string
  readonly message: string
}

export class ApiException extends Error {
  override readonly name = 'ApiException'
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

/** Recupera o JWT atual do Supabase. */
async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) return null
  return data.session.access_token
}

/** Chama API Go autenticado com JWT do Supabase. */
export async function apiFetch<TResponse>(
  path: string,
  init: RequestInit = {},
): Promise<TResponse> {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const url = path.startsWith('http') ? path : `${API_URL}${path}`
  const res = await fetch(url, { ...init, headers })

  if (!res.ok) {
    let body: ApiError | null = null
    try {
      body = (await res.json()) as ApiError
    } catch {
      /* ignore parse */
    }
    throw new ApiException(
      body?.error ?? 'unknown',
      body?.message ?? `HTTP ${res.status}`,
      res.status,
    )
  }

  if (res.status === 204) return undefined as TResponse
  return (await res.json()) as TResponse
}

/** Helpers tipados — açúcar sintático em cima do apiFetch. */
export const api = {
  get<T>(path: string): Promise<T> {
    return apiFetch<T>(path, { method: 'GET' })
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
  },
  patch<T>(path: string, body: unknown): Promise<T> {
    return apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
  },
  delete<T = void>(path: string): Promise<T> {
    return apiFetch<T>(path, { method: 'DELETE' })
  },
}

/** Resposta do endpoint /arquivos/:id/download-url (existente no backend). */
export interface DownloadURLResponse {
  readonly url: string
  readonly expires_at?: string
}

/** Pede signed URL ao backend Go e abre/baixa o arquivo no navegador. */
export async function baixarArquivo(arquivoId: string, nomeSugerido?: string): Promise<void> {
  const resp = await api.get<DownloadURLResponse>(`/api/v1/arquivos/${arquivoId}/download-url`)
  // Abre em nova aba; o navegador segue a Content-Disposition do Storage pra download
  const a = document.createElement('a')
  a.href = resp.url
  if (nomeSugerido) a.download = nomeSugerido
  a.rel = 'noopener noreferrer'
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
