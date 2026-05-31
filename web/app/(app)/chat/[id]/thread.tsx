'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Paperclip, Send, WifiOff } from 'lucide-react'
import { apiBrowser, API_BASE_URL, type ChatAnexo, type ChatMensagem } from '@/lib/api'
import { Avatar, Button, Empty, Textarea } from '@/components/ui'
import { createBrowserClient } from '@/lib/supabase'
import { timeBR } from '@/lib/utils'

export interface ChatMessageView extends ChatMensagem {
  autor_email?: string;
  avatar_url?: string;
  anexos?: ChatAnexo[];
}

interface RealtimeEvent {
  type: string;
  room: string;
  payload: ChatMessageView;
}

export function ChatThread({
  canalId,
  currentUserId,
  token,
  initialMessages,
}: {
  canalId: string;
  currentUserId: string;
  token: string;
  initialMessages: ChatMessageView[];
}) {
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages)
  const [conteudo, setConteudo] = useState('')
  const [sending, setSending] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [conexao, setConexao] = useState<'conectado' | 'reconectando' | 'offline'>('reconectando')
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const tentativaRef = useRef(0)
  const fechadoRef = useRef(false)
  const room = `chat:${canalId}`

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  // ── WebSocket com reconnect exponencial + refresh de JWT ──
  // 1s → 2s → 4s → 8s (cap em 30s). Refaz a sessão a cada reconexão
  // pra evitar token expirado depois de muito tempo aberto.
  useEffect(() => {
    fechadoRef.current = false
    const supabase = createBrowserClient()

    async function buildUrl(): Promise<string> {
      // Refresh JWT antes de cada conexão — pega o mais novo do Supabase
      const { data: { session } } = await supabase.auth.getSession()
      const access = session?.access_token ?? token
      const url = new URL(API_BASE_URL)
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      url.pathname = '/ws'
      url.searchParams.set('access_token', access)
      return url.toString()
    }

    async function conectar() {
      if (fechadoRef.current) return
      setConexao('reconectando')
      const wsUrl = await buildUrl()
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.addEventListener('open', async () => {
        tentativaRef.current = 0
        setConexao('conectado')
        ws.send(JSON.stringify({ action: 'subscribe', room }))
        // Marca toda a thread como lida ao (re)conectar (REST endpoint, idempotente)
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            await fetch(`${API_BASE_URL}/api/v1/chat/canais/${canalId}/lido`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
          }
        } catch { /* ignore */ }
      })
      ws.addEventListener('message', event => {
        try {
          const data = JSON.parse(event.data) as RealtimeEvent
          if (data.type !== 'chat.message' || data.room !== room || !data.payload?.id) return
          setMessages(prev => prev.some(m => m.id === data.payload.id) ? prev : [...prev, data.payload])
          // Mensagem de outro = thread visível, marca lida via REST (fire-and-forget)
          if (data.payload.autor_id !== currentUserId && document.visibilityState === 'visible') {
            void supabase.auth.getSession().then(({ data: { session } }) => {
              if (!session?.access_token) return
              fetch(`${API_BASE_URL}/api/v1/chat/canais/${canalId}/lido`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
              }).catch(() => undefined)
            })
          }
        } catch {}
      })
      ws.addEventListener('close', () => {
        if (fechadoRef.current) return
        // Backoff: 1, 2, 4, 8, 16, 30 (cap)
        const backoffMs = Math.min(30000, 1000 * Math.pow(2, tentativaRef.current))
        tentativaRef.current += 1
        setConexao('reconectando')
        setTimeout(() => { void conectar() }, backoffMs)
      })
      ws.addEventListener('error', () => {
        setConexao('offline')
        ws.close() // dispara o close handler → reconnect
      })
    }

    void conectar()

    // Reconecta quando a aba volta a ficar visível depois de muito tempo
    function onVisibility() {
      if (document.visibilityState === 'visible' && wsRef.current?.readyState !== WebSocket.OPEN) {
        tentativaRef.current = 0
        void conectar()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      fechadoRef.current = true
      document.removeEventListener('visibilitychange', onVisibility)
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ action: 'unsubscribe', room })) } catch { /* ignore */ }
      }
      ws?.close()
    }
  }, [room, canalId, currentUserId, token])

  async function enviar() {
    const texto = conteudo.trim()
    if (!texto || sending) return

    setSending(true)
    setErro(null)
    try {
      const msg = await apiBrowser(token).createChatMensagem(canalId, { conteudo: texto })
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      setConteudo('')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar a mensagem')
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void enviar()
    }
  }

  return (
    <div className="flex h-[calc(100vh-230px)] min-h-[520px] flex-col">
      {conexao !== 'conectado' && (
        <div className={`flex items-center gap-2 border-b px-4 py-2 text-xs ${
          conexao === 'offline'
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}>
          <WifiOff size={12} />
          {conexao === 'offline'
            ? 'Sem conexão com o servidor. Tentando reconectar…'
            : 'Reconectando…'}
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <Empty title="Nenhuma mensagem ainda" description="Envie a primeira mensagem para iniciar a conversa." />
        ) : (
          <div className="space-y-4">
            {messages.map(message => (
              <MessageBubble
                key={message.id}
                message={message}
                isMine={message.autor_id === currentUserId}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-black/10 p-4">
        {erro && <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/10 text-ink-500 hover:bg-ink-50"
            title="Anexos em breve"
            aria-label="Anexar arquivo"
            disabled
          >
            <Paperclip size={16} />
          </button>
          <Textarea
            value={conteudo}
            onChange={event => setConteudo(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escreva uma mensagem"
            rows={2}
            className="max-h-32 min-h-[44px] resize-none"
          />
          <Button
            type="button"
            variant="primary"
            icon={Send}
            disabled={sending || !conteudo.trim()}
            onClick={() => void enviar()}
          >
            Enviar
          </Button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, isMine }: { message: ChatMessageView; isMine: boolean }) {
  const nome = message.autor_nome || message.autor_email || 'Sistema'
  return (
    <div className={`flex gap-3 ${isMine ? 'justify-end' : 'justify-start'}`}>
      {!isMine && <Avatar nome={nome} src={message.avatar_url} />}
      <div className={`max-w-[78%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`mb-1 flex items-center gap-2 text-xs ${isMine ? 'flex-row-reverse text-ink-500' : 'text-ink-500'}`}>
          <span className="font-medium text-ink-700">{isMine ? 'Você' : nome}</span>
          <span>{timeBR(message.criada_em)}</span>
        </div>
        <div
          className={`rounded-xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
            isMine
              ? 'rounded-tr-sm bg-ink-900 text-white'
              : 'rounded-tl-sm border border-black/10 bg-white text-ink-800'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.conteudo}</p>
          {message.anexos && message.anexos.length > 0 && (
            <div className="mt-3 space-y-1">
              {message.anexos.map(anexo => (
                <div key={anexo.id} className={isMine ? 'text-white/75' : 'text-ink-500'}>
                  <Paperclip size={12} className="mr-1 inline" />
                  {anexo.nome_original}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
