'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MessageSquarePlus, Save } from 'lucide-react'
import { apiBrowser } from '@/lib/api'
import { Button, Textarea } from '@/components/ui'

interface MembroOption {
  id: string;
  nome: string;
  role: string;
}

export function SolicitacaoActions({
  id,
  token,
  status,
  prioridade,
  responsavelId,
  membros,
}: {
  id: string;
  token: string;
  status: string;
  prioridade: string;
  responsavelId?: string | null;
  membros: MembroOption[];
}) {
  const router = useRouter()
  const [statusValue, setStatusValue] = useState(status)
  const [prioridadeValue, setPrioridadeValue] = useState(prioridade)
  const [responsavelValue, setResponsavelValue] = useState(responsavelId ?? '')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    setSaving(true)
    setErro(null)
    try {
      await apiBrowser(token).updateSolicitacao(id, {
        status: statusValue,
        prioridade: prioridadeValue,
        ...(responsavelValue ? { responsavel_id: responsavelValue } : {}),
      })
      router.refresh()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500">
        Status
        <select
          value={statusValue}
          onChange={event => setStatusValue(event.target.value)}
          className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="nova">Nova</option>
          <option value="em_atendimento">Em atendimento</option>
          <option value="aguardando_cliente">Aguardando cliente</option>
          <option value="resolvida">Resolvida</option>
          <option value="fechada">Fechada</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </label>

      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500">
        Prioridade
        <select
          value={prioridadeValue}
          onChange={event => setPrioridadeValue(event.target.value)}
          className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
          <option value="muito_alta">Muito alta</option>
        </select>
      </label>

      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500">
        Responsável
        <select
          value={responsavelValue}
          onChange={event => setResponsavelValue(event.target.value)}
          className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Sem atribuição</option>
          {membros.map(m => (
            <option key={m.id} value={m.id}>{m.nome} · {m.role}</option>
          ))}
        </select>
      </label>

      {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}
      <Button type="button" variant="primary" icon={Save} disabled={saving} onClick={() => void salvar()} className="w-full">
        Salvar atendimento
      </Button>
    </div>
  )
}

export function MensagemComposer({ id, token }: { id: string; token: string }) {
  const router = useRouter()
  const [conteudo, setConteudo] = useState('')
  const [interna, setInterna] = useState(false)
  const [sending, setSending] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar() {
    const texto = conteudo.trim()
    if (!texto || sending) return

    setSending(true)
    setErro(null)
    try {
      await apiBrowser(token).createSolicitacaoMensagem(id, { conteudo: texto, interna })
      setConteudo('')
      setInterna(false)
      router.refresh()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar a mensagem')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={conteudo}
        onChange={event => setConteudo(event.target.value)}
        placeholder="Responder ao cliente"
        rows={4}
        className="resize-y"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={interna}
            onChange={event => setInterna(event.target.checked)}
            className="h-4 w-4 rounded border-black/20 text-brand-600 focus:ring-brand-500"
          />
          Nota interna
        </label>
        <Button type="button" variant="primary" icon={MessageSquarePlus} disabled={sending || !conteudo.trim()} onClick={() => void enviar()}>
          Enviar mensagem
        </Button>
      </div>
      {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}
    </div>
  )
}
