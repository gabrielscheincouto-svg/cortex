'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, Check, Loader2, Pencil, Save, ShieldOff, Trash2, X, Users, User } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { API_BASE_URL } from '@/lib/api'
import { Button, Pill } from '@/components/ui'

export interface MemoriaRow {
  id: string
  user_id: string | null
  tipo: string
  fato: string
  confianca: number
  expira_em: string | null
  revisada_em: string | null
  atualizado_em: string
  atualizado_em_label: string
}

export function MemoriasClient({ itens }: { itens: MemoriaRow[] }) {
  return (
    <div className="divide-y divide-black/5">
      {itens.map(m => <MemoriaItem key={m.id} memoria={m} />)}
    </div>
  )
}

export { EsquecerTudoBlock }

function MemoriaItem({ memoria }: { memoria: MemoriaRow }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [fato, setFato] = useState(memoria.fato)
  const [confianca, setConfianca] = useState(memoria.confianca)
  const [loading, setLoading] = useState<'salvar' | 'revisar' | 'arquivar' | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function authedFetch(path: string, init: RequestInit = {}) {
    const supabase = createBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sessão expirada')
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(init.headers ?? {}),
      },
    })
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => null)
      throw new Error((body as any)?.message ?? `${res.status}`)
    }
    return res
  }

  async function salvarEdicao() {
    setLoading('salvar')
    setErro(null)
    try {
      await authedFetch(`/api/v1/cortex/memorias/${memoria.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ fato: fato.trim(), confianca }),
      })
      setEditando(false)
      router.refresh()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(null)
    }
  }

  async function marcarRevisada() {
    setLoading('revisar')
    setErro(null)
    try {
      await authedFetch(`/api/v1/cortex/memorias/${memoria.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ revisada: true }),
      })
      router.refresh()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(null)
    }
  }

  async function arquivar() {
    if (!confirm('Arquivar esta memória? O Cortex deixará de usá-la nas próximas conversas.')) return
    setLoading('arquivar')
    setErro(null)
    try {
      await authedFetch(`/api/v1/cortex/memorias/${memoria.id}`, { method: 'DELETE' })
      router.refresh()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(null)
    }
  }

  const isOrg = memoria.user_id === null

  return (
    <div className="py-3">
      <div className="mb-2 flex items-start gap-2">
        <Pill className={isOrg ? 'bg-emerald-100 text-emerald-800' : 'bg-mind-100 text-mind-800'}>
          {isOrg ? <span className="inline-flex items-center gap-1"><Users size={10} /> escopo: org</span>
                 : <span className="inline-flex items-center gap-1"><User size={10} /> escopo: você</span>}
        </Pill>
        <Pill className="bg-ink-100 text-ink-700">
          confiança {Math.round(memoria.confianca * 100)}%
        </Pill>
        {memoria.revisada_em && <Pill className="bg-sky-100 text-sky-800">revisada</Pill>}
        {memoria.expira_em && <Pill className="bg-amber-100 text-amber-800">
          expira {new Date(memoria.expira_em).toLocaleDateString('pt-BR')}
        </Pill>}
      </div>

      {!editando ? (
        <p className="text-sm text-ink-900">{memoria.fato}</p>
      ) : (
        <div className="space-y-2">
          <textarea
            value={fato}
            onChange={e => setFato(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-mind-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mind-500"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500">Confiança:</span>
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={confianca}
              onChange={e => setConfianca(Number(e.target.value))}
              className="flex-1 accent-mind-600"
            />
            <span className="w-10 text-right text-xs font-medium text-ink-700">{Math.round(confianca * 100)}%</span>
          </div>
        </div>
      )}

      {erro && <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">{erro}</p>}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-ink-500">atualizado {memoria.atualizado_em_label}</span>
        <div className="flex gap-1">
          {editando ? (
            <>
              <Button type="button" size="sm" variant="ghost" icon={X} onClick={() => { setEditando(false); setFato(memoria.fato); setConfianca(memoria.confianca) }} disabled={loading !== null}>
                Cancelar
              </Button>
              <Button type="button" size="sm" variant="primary" icon={loading === 'salvar' ? Loader2 : Save} onClick={salvarEdicao} disabled={loading !== null} className="bg-mind-500 hover:bg-mind-600">
                Salvar
              </Button>
            </>
          ) : (
            <>
              <Button type="button" size="sm" variant="ghost" icon={loading === 'revisar' ? Loader2 : Check} onClick={marcarRevisada} disabled={loading !== null}>
                Revisada
              </Button>
              <Button type="button" size="sm" variant="ghost" icon={Pencil} onClick={() => setEditando(true)} disabled={loading !== null}>
                Editar
              </Button>
              <Button type="button" size="sm" variant="ghost" icon={loading === 'arquivar' ? Loader2 : Archive} onClick={arquivar} disabled={loading !== null}>
                Arquivar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EsquecerTudoBlock() {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  async function executar() {
    setLoading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')
      const res = await fetch(`${API_BASE_URL}/api/v1/cortex/memorias/esquecer-tudo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json()
      setResultado(`${body.arquivadas ?? 0} memórias arquivadas.`)
      router.refresh()
    } catch (e) {
      setResultado(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setConfirmando(false)
    }
  }

  return (
    <div className="pt-4">
      {!confirmando ? (
        <Button type="button" variant="ghost" icon={Trash2} onClick={() => setConfirmando(true)} className="text-rose-700 hover:bg-rose-50">
          Esquecer tudo (suas memórias)
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 p-3">
          <ShieldOff size={16} className="text-rose-700" />
          <span className="text-sm text-rose-900">Confirma arquivar TODAS as suas memórias?</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmando(false)}>Cancelar</Button>
          <Button type="button" size="sm" variant="primary" onClick={executar} disabled={loading} className="bg-rose-600 hover:bg-rose-700">
            {loading ? 'Arquivando…' : 'Sim, esquecer tudo'}
          </Button>
        </div>
      )}
      {resultado && <p className="mt-2 text-xs text-ink-600">{resultado}</p>}
    </div>
  )
}
