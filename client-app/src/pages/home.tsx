/**
 * Home do cliente — KPIs reais + próximas obrigações + atalhos rápidos.
 *
 * Tudo via Supabase com RLS protegendo o escopo (cliente só lê dados da
 * empresa atribuída em empresa_usuarios_finais).
 */
import { Link } from 'react-router-dom'
import {
  ClipboardList, MessagesSquare, FolderArchive, ArrowRight,
  AlertTriangle, CalendarClock,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Card, CardHeader, Empty, Button, Pill, Spinner, Stat } from '@/components/ui'
import { saudacao, dateLongBR, dateBR } from '@/lib/utils'
import { useKpisCliente, useProximasObrigacoes, type EntregaStatus } from '@/lib/queries'

export function HomePage() {
  const { user, empresa } = useAuth()
  const nome = (user?.email ?? '').split('@')[0] ?? 'cliente'
  const agora = new Date()

  const kpis = useKpisCliente(empresa?.id)
  const proximas = useProximasObrigacoes(empresa?.id)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          {dateLongBR(agora)}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-ink-900 sm:text-2xl">
          {saudacao()}, {nome}
        </h1>
        {empresa && (
          <p className="mt-1 text-sm text-ink-500">
            Visão da empresa <strong className="text-ink-700">{empresa.nome}</strong>
          </p>
        )}
      </div>

      {/* 4 KPIs reais */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.isPending ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : kpis.isError ? (
          <div className="col-span-2 lg:col-span-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Não consegui carregar os indicadores agora. Recarregue em alguns segundos.
          </div>
        ) : (
          <>
            <Stat label="Obrigações do mês" value={String(kpis.data?.obrigacoesDoMes ?? 0)} />
            <Stat
              label="Vencendo até 7 dias"
              value={String(kpis.data?.vencendoEm7Dias ?? 0)}
              accent="gold"
              valueColor={(kpis.data?.vencendoEm7Dias ?? 0) > 0 ? 'text-gold-700' : undefined}
            />
            <Stat
              label="Atrasadas"
              value={String(kpis.data?.atrasadas ?? 0)}
              accent="rose"
              valueColor={(kpis.data?.atrasadas ?? 0) > 0 ? 'text-rose-700' : undefined}
            />
            <Stat
              label="Avisos não lidos"
              value={String(kpis.data?.notificacoesNaoLidas ?? 0)}
            />
          </>
        )}
      </div>

      {/* Próximas obrigações */}
      <Card className="p-0">
        <div className="px-5 pt-5">
          <CardHeader
            icon={ClipboardList}
            title="Próximas obrigações"
            subtitle="Vencimentos das suas guias e declarações nos próximos 30 dias"
            action={
              <Link
                to="/obrigacoes"
                className="inline-flex items-center gap-1 text-xs font-medium text-mind-700 hover:text-mind-900"
              >
                Ver todas <ArrowRight size={12} />
              </Link>
            }
          />
        </div>
        <div className="px-5 pb-5">
          {proximas.isPending ? (
            <div className="flex items-center justify-center py-10"><Spinner size={20} /></div>
          ) : proximas.isError ? (
            <Empty
              icon={AlertTriangle}
              title="Erro ao carregar obrigações"
              description="Tente atualizar a página em alguns segundos."
            />
          ) : (proximas.data ?? []).length === 0 ? (
            <Empty
              icon={ClipboardList}
              title="Sem obrigações nos próximos 30 dias"
              description="Quando algo for vencer ou for cadastrado, aparece aqui automaticamente."
            />
          ) : (
            <div className="divide-y divide-black/5">
              {proximas.data!.map(o => (
                <ObrigacaoLinha key={o.id} obrigacao={o} />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Atalhos */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AtalhoCard
          to="/solicitacoes"
          titulo="Falar com o escritório"
          texto="Abra uma solicitação tipada (admissão, certidão, balancete...) e acompanhe as respostas."
          icon={MessagesSquare}
        />
        <AtalhoCard
          to="/documentos"
          titulo="Meus documentos"
          texto="Guias publicadas pelo escritório, balancetes e arquivos compartilhados com sua empresa."
          icon={FolderArchive}
        />
      </div>
    </div>
  )
}

// ─── ObrigacaoLinha — item da lista de próximas ───────────────────────────

function ObrigacaoLinha({
  obrigacao,
}: {
  obrigacao: {
    id: string
    obrigacao_nome: string
    departamento: string
    competencia: string
    prazo_legal: string
    status: EntregaStatus
  }
}) {
  const prazo = new Date(obrigacao.prazo_legal + 'T12:00:00')
  const hoje = new Date()
  const diasRestantes = Math.ceil((prazo.getTime() - hoje.getTime()) / 86_400_000)

  const tom = diasRestantes < 0
    ? 'rose'
    : diasRestantes <= 3
    ? 'gold'
    : 'neutral'

  return (
    <Link
      to="/obrigacoes"
      className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-ink-50/60"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          tom === 'rose' ? 'bg-rose-50 text-rose-700'
          : tom === 'gold' ? 'bg-gold-100 text-gold-700'
          : 'bg-mind-100 text-mind-700'
        }`}>
          <CalendarClock size={16} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">
            {obrigacao.obrigacao_nome}
          </p>
          <p className="text-[11px] text-ink-500">
            {capitalize(obrigacao.departamento)} · competência {obrigacao.competencia}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-semibold text-ink-900">{dateBR(prazo)}</span>
        <PrazoBadge dias={diasRestantes} />
      </div>
    </Link>
  )
}

function PrazoBadge({ dias }: { dias: number }) {
  if (dias < 0) {
    return <Pill className="bg-rose-50 text-rose-800 ring-rose-200">{Math.abs(dias)}d atrasada</Pill>
  }
  if (dias === 0) {
    return <Pill className="bg-gold-100 text-gold-800 ring-gold-200">vence hoje</Pill>
  }
  if (dias <= 3) {
    return <Pill className="bg-gold-100 text-gold-800 ring-gold-200">em {dias}d</Pill>
  }
  return <Pill className="bg-ink-100 text-ink-700 ring-black/10">em {dias}d</Pill>
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Skeletons ────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-black/10 bg-white px-5 py-4">
      <div className="h-3 w-24 animate-pulse rounded bg-ink-100" />
      <div className="mt-3 h-7 w-12 animate-pulse rounded bg-ink-100" />
    </div>
  )
}

// ─── Atalhos ──────────────────────────────────────────────────────────────

function AtalhoCard({
  to, titulo, texto, icon: Icon,
}: {
  to: string
  titulo: string
  texto: string
  icon: typeof ClipboardList
}) {
  return (
    <Link
      to={to}
      className="block rounded-xl border border-ink-200 bg-white p-5 transition-colors hover:border-ink-900"
    >
      <Icon size={20} className="mb-3 text-mind-600" />
      <p className="text-base font-semibold text-ink-900">{titulo}</p>
      <p className="mt-1 text-sm text-ink-500">{texto}</p>
      <div className="mt-4">
        <Button size="sm" variant="secondary" icon={ArrowRight}>
          Abrir
        </Button>
      </div>
    </Link>
  )
}
