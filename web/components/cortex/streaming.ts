import { API_BASE_URL } from '@/lib/api'

export interface CortexStreamEvent {
  type: 'tool' | 'delta' | 'done' | 'acao_proposta'
  data: any
}

export interface CortexAcaoPendente {
  id: string
  org_id: string
  user_id: string
  conversa_id?: string
  mensagem_id?: string
  ferramenta: string
  args: Record<string, any>
  resumo: string
  status: 'pendente' | 'confirmada' | 'cancelada' | 'falhou'
  resultado?: Record<string, any>
  erro?: string
  expira_em: string
  confirmada_em?: string
  cancelada_em?: string
  created_at: string
}

export async function confirmarCortexAcao(token: string, acaoId: string): Promise<CortexAcaoPendente> {
  const res = await fetch(`${API_BASE_URL}/api/v1/cortex/acoes/${acaoId}/confirmar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error((body as any)?.error ?? `falha ${res.status}`)
  return body as CortexAcaoPendente
}

export async function cancelarCortexAcao(token: string, acaoId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/cortex/acoes/${acaoId}/cancelar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok && res.status !== 204) throw new Error(`falha ${res.status}`)
}

export async function streamCortexMensagem({
  token,
  conversaId,
  conteudo,
  onEvent,
}: {
  token: string
  conversaId: string
  conteudo: string
  onEvent: (event: CortexStreamEvent) => void
}) {
  const res = await fetch(`${API_BASE_URL}/api/v1/cortex/conversas/${conversaId}/mensagens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ conteudo }),
  })
  if (!res.ok || !res.body) throw new Error(`Cortex respondeu ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const lines = part.split('\n')
      const event = lines.find(line => line.startsWith('event: '))?.slice(7).trim()
      const data = lines.find(line => line.startsWith('data: '))?.slice(6).trim()
      if (event && data) onEvent({ type: event as CortexStreamEvent['type'], data: JSON.parse(data) })
    }
  }
}
