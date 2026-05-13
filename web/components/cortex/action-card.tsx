'use client'

/**
 * Card de ação proposta pelo Cortex.
 * Mostra o resumo humano da ação e os botões Confirmar/Cancelar.
 * Quando Cortex "quer" fazer algo de escrita (criar tarefa, postar mural,
 * mudar status), ele cria uma ação pendente e o card aparece aqui.
 * Nada é executado até o user confirmar — auditabilidade preservada.
 */

import { useState } from 'react'
import { Check, X, Sparkles, Clock, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui'
import {
  confirmarCortexAcao,
  cancelarCortexAcao,
  type CortexAcaoPendente,
} from './streaming'

const FERRAMENTA_LABELS: Record<string, string> = {
  criar_tarefa_kanban: 'Criar tarefa no Kanban',
  mudar_status_entrega: 'Mudar status de entrega',
  postar_mural: 'Publicar no mural',
  lancar_pontos_manual: 'Lançar pontos',
  responder_solicitacao: 'Responder solicitação',
  lembrar_fato: 'Lembrar fato',
  esquecer_fato: 'Esquecer fato',
}

export function ActionCard({
  acao,
  token,
  onResolved,
}: {
  acao: CortexAcaoPendente
  token: string
  onResolved?: (finalState: CortexAcaoPendente | null) => void
}) {
  const [status, setStatus] = useState(acao.status)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState<'confirmar' | 'cancelar' | null>(null)
  const [resultado, setResultado] = useState(acao.resultado)

  const ferramentaLabel = FERRAMENTA_LABELS[acao.ferramenta] ?? acao.ferramenta
  const expirado = new Date(acao.expira_em).getTime() < Date.now()
  const ativo = status === 'pendente' && !expirado

  async function handleConfirmar() {
    setLoading('confirmar')
    setErro(null)
    try {
      const r = await confirmarCortexAcao(token, acao.id)
      setStatus(r.status)
      setResultado(r.resultado)
      onResolved?.(r)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErro(msg)
      if (msg.startsWith('acao_nao_pendente') || msg.startsWith('acao_expirada')) {
        setStatus('cancelada')
      }
    } finally {
      setLoading(null)
    }
  }

  async function handleCancelar() {
    setLoading('cancelar')
    try {
      await cancelarCortexAcao(token, acao.id)
      setStatus('cancelada')
      onResolved?.(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(null)
    }
  }

  // Banner por status
  if (status === 'confirmada') {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3">
        <div className="flex items-start gap-2">
          <div className="rounded-full bg-emerald-200 p-1">
            <Check size={14} className="text-emerald-800" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Ação executada</p>
            <p className="mt-0.5 text-sm text-ink-900">{acao.resumo}</p>
            {resultado && (
              <p className="mt-1 text-xs text-emerald-800">
                {Object.entries(resultado).slice(0, 3).map(([k, v]) => `${k}: ${String(v).slice(0, 20)}`).join(' · ')}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'falhou') {
    return (
      <div className="rounded-lg border border-rose-300 bg-rose-50 p-3">
        <div className="flex items-start gap-2">
          <div className="rounded-full bg-rose-200 p-1">
            <AlertTriangle size={14} className="text-rose-800" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">Falhou</p>
            <p className="mt-0.5 text-sm text-ink-900">{acao.resumo}</p>
            {erro && <p className="mt-1 text-xs text-rose-700">{erro}</p>}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'cancelada' || expirado) {
    return (
      <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {expirado ? 'Expirada' : 'Cancelada'}
        </p>
        <p className="mt-0.5 text-sm text-ink-600 line-through">{acao.resumo}</p>
      </div>
    )
  }

  // Status pendente — card de confirmação
  return (
    <div className="rounded-lg border border-mind-300 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <div className="rounded-full bg-mind-100 p-1">
          <Sparkles size={14} className="text-mind-700" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-mind-700">
          Cortex propõe uma ação
        </p>
      </div>
      <p className="mb-1 text-xs text-ink-500">{ferramentaLabel}</p>
      <p className="mb-3 text-sm font-medium text-ink-900">{acao.resumo}</p>

      {erro && (
        <p className="mb-2 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">{erro}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-ink-500">
          <Clock size={12} /> expira em {new Date(acao.expira_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            icon={X}
            onClick={handleCancelar}
            disabled={loading !== null || !ativo}
          >
            {loading === 'cancelar' ? 'Cancelando…' : 'Cancelar'}
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={Check}
            onClick={handleConfirmar}
            disabled={loading !== null || !ativo}
            className="bg-mind-500 hover:bg-mind-600"
          >
            {loading === 'confirmar' ? 'Executando…' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
