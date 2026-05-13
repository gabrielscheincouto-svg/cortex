'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, X, Calculator, Send } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import {
  fetchIrpf, tipoLabel,
  type IrpfLancamento, type IrpfLancamentoTipo, type IrpfDeclaracao,
} from '@/lib/irpf'
import { Button, Card, Input } from '@/components/ui'

const TIPOS: IrpfLancamentoTipo[] = [
  'rendimento_tributavel', 'rendimento_isento', 'rendimento_exclusivo',
  'deducao_medica', 'deducao_educacao', 'deducao_previdencia', 'deducao_pensao',
  'dependente', 'bem_direito', 'divida',
]

// ─── Botão "Calcular" ─────────────────────────────────────────────────────
export function CalcularButton({ declaracaoId }: { declaracaoId: string }) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function calcular() {
    setErro(null)
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')
      await fetchIrpf<IrpfDeclaracao>(session.access_token, `/api/v1/irpf/declaracoes/${declaracaoId}/calcular`, {
        method: 'POST',
      })
      router.refresh()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="primary" icon={Calculator} onClick={calcular} disabled={loading}>
        {loading ? 'Calculando...' : 'Recalcular imposto'}
      </Button>
      {erro && <p className="text-xs text-rose-700">{erro}</p>}
    </div>
  )
}

// ─── Mudar status (transmitir, em malha, etc.) ───────────────────────────
export function MudarStatusButton({ declaracaoId, statusAtual }: { declaracaoId: string; statusAtual: string }) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [open, setOpen] = useState(false)
  const [novoStatus, setNovoStatus] = useState(statusAtual)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const opcoes: { value: string; label: string }[] = [
    { value: 'a_iniciar', label: 'A iniciar' },
    { value: 'coletando', label: 'Coletando' },
    { value: 'em_processamento', label: 'Em processamento' },
    { value: 'aguardando_cliente', label: 'Aguardando cliente' },
    { value: 'entregue', label: 'Entregue (transmitir)' },
    { value: 'em_malha', label: 'Em malha' },
    { value: 'retificada', label: 'Retificada' },
    { value: 'cancelada', label: 'Cancelada' },
  ]

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')
      await fetchIrpf<IrpfDeclaracao>(session.access_token, `/api/v1/irpf/declaracoes/${declaracaoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: novoStatus }),
      })
      router.refresh()
      setOpen(false)
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : String(e2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="secondary" icon={Send} onClick={() => setOpen(true)}>Mudar status</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-base font-semibold text-ink-900">Mudar status da declaração</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-ink-500 hover:bg-ink-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <select
                value={novoStatus}
                onChange={e => setNovoStatus(e.target.value)}
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {opcoes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}

              <div className="flex justify-end gap-2 border-t border-black/5 pt-3">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? 'Salvando...' : 'Confirmar'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  )
}

// ─── Novo lançamento ─────────────────────────────────────────────────────
export function NovoLancamentoButton({ declaracaoId, tipo: tipoInicial }: { declaracaoId: string; tipo?: IrpfLancamentoTipo }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" icon={Plus} size="sm" onClick={() => setOpen(true)}>
        Novo lançamento
      </Button>
      {open && <NovoLancamentoModal declaracaoId={declaracaoId} tipoInicial={tipoInicial} onClose={() => setOpen(false)} />}
    </>
  )
}

function NovoLancamentoModal({ declaracaoId, tipoInicial, onClose }: {
  declaracaoId: string
  tipoInicial?: IrpfLancamentoTipo
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [tipo, setTipo] = useState<IrpfLancamentoTipo>(tipoInicial ?? 'rendimento_tributavel')
  const [fonte, setFonte] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [imposto, setImposto] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function toCents(value: string): number {
    const n = parseFloat(value.replace(/\./g, '').replace(',', '.'))
    if (Number.isNaN(n)) return 0
    return Math.round(n * 100)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')
      await fetchIrpf<IrpfLancamento>(session.access_token, `/api/v1/irpf/declaracoes/${declaracaoId}/lancamentos`, {
        method: 'POST',
        body: JSON.stringify({
          tipo,
          fonte_pagadora: fonte.trim() || undefined,
          fonte_cnpj: cnpj.replace(/\D/g, '') || undefined,
          descricao: descricao.trim() || undefined,
          valor_cents: toCents(valor),
          imposto_retido_cents: toCents(imposto),
        }),
      })
      router.refresh()
      onClose()
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : String(e2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Novo lançamento</h2>
            <p className="mt-1 text-sm text-ink-500">Adiciona rendimento, dedução ou outro item à declaração</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-500 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Tipo *</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value as IrpfLancamentoTipo)}
              className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {TIPOS.map(t => <option key={t} value={t}>{tipoLabel[t]}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Fonte pagadora</label>
              <Input value={fonte} onChange={e => setFonte(e.target.value)} placeholder="ex: Banco do Brasil" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">CNPJ fonte</label>
              <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Descrição</label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhe opcional" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Valor *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-ink-400">R$</span>
                <Input value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" className="pl-9" required />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Imposto retido na fonte</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-ink-400">R$</span>
                <Input value={imposto} onChange={e => setImposto(e.target.value)} placeholder="0,00" className="pl-9" />
              </div>
            </div>
          </div>

          {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}

          <div className="flex justify-end gap-2 border-t border-black/5 pt-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ─── Excluir lançamento ────────────────────────────────────────────────────
export function ExcluirLancamentoButton({ lancamentoId, declaracaoId }: { lancamentoId: string; declaracaoId: string }) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)

  async function excluir() {
    if (!confirm('Excluir este lançamento?')) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')
      await fetchIrpf(session.access_token, `/api/v1/irpf/lancamentos/${lancamentoId}`, { method: 'DELETE' })
      // recalcula
      await fetchIrpf(session.access_token, `/api/v1/irpf/declaracoes/${declaracaoId}/calcular`, { method: 'POST' })
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={excluir}
      disabled={loading}
      className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-700"
      aria-label="Excluir"
    >
      <Trash2 size={14} />
    </button>
  )
}
