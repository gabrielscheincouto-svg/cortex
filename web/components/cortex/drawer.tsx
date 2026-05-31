'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Send, X, BrainCircuit } from 'lucide-react'
import { apiBrowser, type CortexMensagem } from '@/lib/api'
import { Button, Textarea } from '@/components/ui'
import { MessageBubble, CortexAvatar } from './message-bubble'
import { streamCortexMensagem, type CortexAcaoPendente } from './streaming'
import { ToolCallCard } from './tool-call-card'
import { ActionCard } from './action-card'

export function CortexDrawer({ open, onClose, token }: { open: boolean; onClose: () => void; token: string }) {
  const [conversaId, setConversaId] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<CortexMensagem[]>([])
  const [acoes, setAcoes] = useState<Record<string, CortexAcaoPendente>>({}) // mensagem_id -> acao
  const [texto, setTexto] = useState('')
  const [streaming, setStreaming] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || conversaId) return
    apiBrowser(token).createCortexConversa({ titulo: 'Memória rápida', contexto_pagina: window.location.pathname })
      .then(conv => setConversaId(conv.id))
      .catch(() => undefined)
  }, [open, conversaId, token])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, streaming])

  async function enviar(event?: FormEvent) {
    event?.preventDefault()
    const conteudo = texto.trim()
    if (!conteudo || !conversaId || streaming) return
    setTexto('')
    setStreaming(true)
    const assistantPlaceholderId = crypto.randomUUID()
    setMensagens(prev => [...prev, {
      id: crypto.randomUUID(), org_id: '', conversa_id: conversaId, papel: 'user', conteudo, criada_em: new Date().toISOString(),
    }, {
      id: assistantPlaceholderId, org_id: '', conversa_id: conversaId, papel: 'assistant', conteudo: '', criada_em: new Date().toISOString(),
    }])
    try {
      await streamCortexMensagem({
        token,
        conversaId,
        conteudo,
        onEvent: event => {
          if (event.type === 'tool') {
            setMensagens(prev => {
              const copy = [...prev]
              const last = copy[copy.length - 1]
              copy[copy.length - 1] = { ...last, tool_chamadas: event.data }
              return copy
            })
          }
          if (event.type === 'acao_proposta') {
            const acao = event.data as CortexAcaoPendente
            setAcoes(prev => ({ ...prev, [assistantPlaceholderId]: acao }))
          }
          if (event.type === 'delta') {
            setMensagens(prev => {
              const copy = [...prev]
              const last = copy[copy.length - 1]
              copy[copy.length - 1] = { ...last, conteudo: `${last.conteudo ?? ''}${event.data.texto ?? ''}` }
              return copy
            })
          }
        },
      })
    } finally {
      setStreaming(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Fechar Cortex" className="absolute inset-0 bg-ink-900/20" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[400px] flex-col border-l border-black/10 bg-mind-50 shadow-2xl">
        <header className="flex items-center gap-3 bg-ink-900 px-4 py-3 text-white">
          <div className="rounded-full bg-white/10 p-1">
            <CortexAvatar size={32} pulsando={streaming} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base leading-none">usecortex</p>
            <p className="mt-0.5 text-[11px] text-mind-200">O cérebro do escritório contábil</p>
          </div>
          {streaming && <span className="cortex-pulse bg-white" />}
          <Link
            href="/cortex/memorias"
            onClick={onClose}
            title="Ver memórias do Cortex"
            className="rounded-lg p-1.5 hover:bg-white/10"
          >
            <BrainCircuit size={18} />
          </Link>
          <button type="button" aria-label="Fechar" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {mensagens.length === 0 ? (
            <div className="rounded-lg border border-mind-300 bg-white p-4 text-sm text-ink-600">
              Cortex ainda está aprendendo com a memória deste escritório. Pergunte sobre entregas, empresas ou solicitações.
            </div>
          ) : (
            mensagens.map((msg, index) => (
              <div key={msg.id} className="space-y-2">
                <MessageBubble papel={msg.papel === 'user' ? 'user' : 'assistant'} conteudo={msg.conteudo ?? ''} />
                {msg.papel === 'assistant' && msg.tool_chamadas && (
                  <ToolCallCard
                    ferramenta={String(msg.tool_chamadas.ferramenta ?? '')}
                    resumo={String(msg.tool_chamadas.resumo ?? '')}
                    resultado={msg.tool_chamadas.resultado}
                  />
                )}
                {msg.papel === 'assistant' && acoes[msg.id] && (
                  <ActionCard
                    acao={acoes[msg.id]}
                    token={token}
                    onResolved={(final) => {
                      if (final) setAcoes(prev => ({ ...prev, [msg.id]: final }))
                    }}
                  />
                )}
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={enviar} className="border-t border-mind-300 bg-white p-3">
          <Textarea
            value={texto}
            onChange={event => setTexto(event.target.value)}
            onKeyDown={event => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void enviar()
            }}
            placeholder="Pergunte ao Cortex..."
            className="min-h-[84px] focus:ring-mind-500 focus:border-mind-500"
          />
          <div className="mt-2 flex justify-end">
            <Button type="submit" variant="primary" icon={Send} disabled={!texto.trim() || streaming}>
              Enviar
            </Button>
          </div>
        </form>
      </aside>
    </div>
  )
}
