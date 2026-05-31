/**
 * Notificações do cliente — sino + tela cheia.
 *
 * O cliente final vê aqui tudo que o escritório (ou o robô) publicou pra ele:
 * novas guias, balancetes, respostas em chamados, alertas de vencimento.
 *
 * Cada notificação tem `payload` com refs (entrega_id, solicitacao_id, etc) —
 * usamos pra montar deep-link pra rota correspondente.
 *
 * Marcar uma específica como lida ao clicar; botão "marcar todas como lidas".
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell, BellOff, FileText, BookOpen, MessageSquare,
  AlertTriangle, CalendarClock, CheckCheck, ChevronRight, Loader2,
} from 'lucide-react'
import { Card, Empty, Pill, Spinner, Button } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import {
  useNotificacoes, useMarcarNotificacaoLida, useMarcarTodasLidas,
  type NotificacaoCliente, type NotificacaoTipo,
} from '@/lib/queries'
import { ago, cn } from '@/lib/utils'

const TIPO_LABEL: Record<NotificacaoTipo, string> = {
  nova_guia: 'Nova guia',
  novo_documento: 'Novo documento',
  novo_balancete: 'Novo balancete',
  resposta_chamado: 'Resposta em chamado',
  alerta_vencimento: 'Vencimento próximo',
  alerta_atraso: 'Obrigação atrasada',
}

export function NotificacoesListPage() {
  const { empresa } = useAuth()
  const [apenasNaoLidas, setApenasNaoLidas] = useState(false)
  const lista = useNotificacoes(empresa?.id, apenasNaoLidas)
  const marcarLida = useMarcarNotificacaoLida()
  const marcarTodas = useMarcarTodasLidas()

  const naoLidas = (lista.data ?? []).filter(n => !n.lida_em).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-ink-900 sm:text-2xl">
            <Bell size={20} className="text-mind-600" />
            Avisos
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Tudo que o escritório publicou pra você — novas guias, balancetes e respostas.
          </p>
        </div>
        {naoLidas > 0 && empresa?.id && (
          <Button
            size="sm"
            variant="secondary"
            icon={marcarTodas.isPending ? Loader2 : CheckCheck}
            disabled={marcarTodas.isPending}
            onClick={() => marcarTodas.mutate(empresa.id)}
          >
            {marcarTodas.isPending ? 'Marcando…' : `Marcar ${naoLidas} como lidas`}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <FilterPill active={!apenasNaoLidas} onClick={() => setApenasNaoLidas(false)}>
          Todas
        </FilterPill>
        <FilterPill active={apenasNaoLidas} onClick={() => setApenasNaoLidas(true)}>
          Apenas não lidas
        </FilterPill>
      </div>

      {lista.isPending ? (
        <Card className="flex items-center justify-center py-12"><Spinner size={20} /></Card>
      ) : lista.isError ? (
        <Card>
          <Empty
            icon={AlertTriangle}
            title="Erro ao carregar avisos"
            description="Tente atualizar a página em alguns segundos."
          />
        </Card>
      ) : (lista.data ?? []).length === 0 ? (
        <Card>
          <Empty
            icon={BellOff}
            title={apenasNaoLidas ? 'Tudo em dia' : 'Sem avisos ainda'}
            description={apenasNaoLidas
              ? 'Você não tem nenhuma notificação não lida no momento.'
              : 'Quando o escritório ou o robô publicarem algo pra você, aparece aqui.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {lista.data!.map(n => (
            <NotificacaoCard
              key={n.id}
              notificacao={n}
              onAbrir={() => {
                if (!n.lida_em) marcarLida.mutate(n.id)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Card de notificação ──────────────────────────────────────────────────

function NotificacaoCard({
  notificacao, onAbrir,
}: {
  notificacao: NotificacaoCliente
  onAbrir: () => void
}) {
  const naoLida = !notificacao.lida_em
  const Icone = iconePorTipo(notificacao.tipo)
  const corClasse = corPorTipo(notificacao.tipo)
  const linkDestino = deepLink(notificacao)

  const conteudo = (
    <div className="flex items-start gap-3 px-5 py-4">
      <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', corClasse)}>
        <Icone size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Pill className={tipoPillClass(notificacao.tipo)}>
            {TIPO_LABEL[notificacao.tipo]}
          </Pill>
          {naoLida && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" aria-label="Não lida" />
          )}
        </div>
        <p className={cn('text-sm', naoLida ? 'font-semibold text-ink-900' : 'font-medium text-ink-700')}>
          {notificacao.titulo}
        </p>
        {notificacao.corpo && (
          <p className="mt-0.5 text-sm leading-snug text-ink-600">{notificacao.corpo}</p>
        )}
        <p className="mt-1 text-[11px] text-ink-400">{ago(notificacao.created_at)}</p>
      </div>
      {linkDestino && <ChevronRight size={16} className="shrink-0 text-ink-300" />}
    </div>
  )

  if (linkDestino) {
    return (
      <Card className={cn('!p-0 transition-colors', naoLida ? 'border-mind-200 bg-mind-50/30' : '')}>
        <Link
          to={linkDestino}
          onClick={onAbrir}
          className="block hover:bg-ink-50/60"
        >
          {conteudo}
        </Link>
      </Card>
    )
  }

  return (
    <Card className={cn('!p-0', naoLida ? 'border-mind-200 bg-mind-50/30' : '')}>
      <button type="button" onClick={onAbrir} className="block w-full text-left hover:bg-ink-50/60">
        {conteudo}
      </button>
    </Card>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function iconePorTipo(t: NotificacaoTipo) {
  switch (t) {
    case 'nova_guia': return FileText
    case 'novo_documento': return FileText
    case 'novo_balancete': return BookOpen
    case 'resposta_chamado': return MessageSquare
    case 'alerta_vencimento': return CalendarClock
    case 'alerta_atraso': return AlertTriangle
  }
}

function corPorTipo(t: NotificacaoTipo): string {
  switch (t) {
    case 'nova_guia':
    case 'novo_documento': return 'bg-mind-100 text-mind-700'
    case 'novo_balancete': return 'bg-brand-50 text-brand-700'
    case 'resposta_chamado': return 'bg-gold-100 text-gold-700'
    case 'alerta_vencimento': return 'bg-gold-100 text-gold-700'
    case 'alerta_atraso': return 'bg-rose-50 text-rose-700'
  }
}

function tipoPillClass(t: NotificacaoTipo): string {
  switch (t) {
    case 'alerta_atraso': return 'bg-rose-50 text-rose-800 ring-rose-200'
    case 'alerta_vencimento': return 'bg-gold-100 text-gold-800 ring-gold-200'
    case 'resposta_chamado': return 'bg-gold-100 text-gold-800 ring-gold-200'
    case 'novo_balancete': return 'bg-brand-50 text-brand-800 ring-brand-200'
    default: return 'bg-mind-100 text-mind-800 ring-mind-200'
  }
}

/** Resolve qual rota abrir a partir do payload da notificação. */
function deepLink(n: NotificacaoCliente): string | null {
  switch (n.tipo) {
    case 'nova_guia':
    case 'novo_documento':
    case 'alerta_vencimento':
    case 'alerta_atraso':
      return '/obrigacoes'
    case 'novo_balancete':
      return '/documentos'
    case 'resposta_chamado':
      return '/solicitacoes'
  }
}

function FilterPill({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-ink-900 px-3.5 py-1.5 text-xs font-semibold text-white'
          : 'rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-ink-700 ring-1 ring-inset ring-black/10 hover:bg-ink-50'
      }
    >
      {children}
    </button>
  )
}
