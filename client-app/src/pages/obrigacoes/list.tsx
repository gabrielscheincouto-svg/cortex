/**
 * Obrigações do cliente — lista filtrável com download de guia.
 *
 * Lista entregas (status, prazo, competência) e expande mostrando arquivos
 * publicados pelo escritório (entrega_arquivos.visivel_cliente). Download via
 * signed URL gerada pelo backend Go (/arquivos/:id/download-url).
 */
import { useMemo, useState } from 'react'
import {
  ClipboardList, AlertTriangle, CalendarClock, Download, ChevronDown, ChevronUp,
  FileText, CheckCircle2,
} from 'lucide-react'
import { Card, Empty, Pill, Spinner, Button } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import {
  useObrigacoes, type EntregaStatus, type EntregaResumida,
  competenciaAtual,
} from '@/lib/queries'
import { baixarArquivo } from '@/lib/api'
import { dateBR, cn } from '@/lib/utils'

type StatusFiltroUI = 'todas' | 'em_aberto' | 'entregues' | 'atrasadas'

const STATUS_LABEL: Record<EntregaStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  aguardando_cliente: 'Aguarda você',
  entregue: 'Entregue',
  justificada: 'Justificada',
  dispensada: 'Dispensada',
  atrasada: 'Atrasada',
}

const STATUS_PILL: Record<EntregaStatus, string> = {
  pendente: 'bg-ink-100 text-ink-700 ring-black/10',
  em_andamento: 'bg-mind-100 text-mind-800 ring-mind-200',
  aguardando_cliente: 'bg-gold-100 text-gold-800 ring-gold-200',
  entregue: 'bg-brand-50 text-brand-800 ring-brand-200',
  justificada: 'bg-ink-100 text-ink-700 ring-black/10',
  dispensada: 'bg-ink-100 text-ink-500 ring-black/10',
  atrasada: 'bg-rose-50 text-rose-800 ring-rose-200',
}

export function ObrigacoesListPage() {
  const { empresa } = useAuth()
  const [filtro, setFiltro] = useState<StatusFiltroUI>('em_aberto')
  const [competencia, setCompetencia] = useState<string>('') // vazio = todas

  // Filtro UI → status reais
  const statusReais = useMemo<EntregaStatus[] | null>(() => {
    switch (filtro) {
      case 'em_aberto':
        return ['pendente', 'em_andamento', 'aguardando_cliente']
      case 'entregues':
        return ['entregue']
      case 'atrasadas':
        return ['atrasada']
      case 'todas':
      default:
        return null
    }
  }, [filtro])

  // O hook só aceita 1 status — pra múltiplos eu busco "todas" e filtro localmente.
  const query = useObrigacoes(empresa?.id, {
    competencia: competencia || undefined,
  })

  const filtered = useMemo(() => {
    const all = query.data ?? []
    if (!statusReais) return all
    return all.filter(o => statusReais.includes(o.status))
  }, [query.data, statusReais])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">Obrigações</h1>
        <p className="mt-1 text-sm text-ink-500">
          Acompanhe vencimentos, status e baixe as guias publicadas pelo escritório.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill active={filtro === 'em_aberto'} onClick={() => setFiltro('em_aberto')}>Em aberto</FilterPill>
        <FilterPill active={filtro === 'atrasadas'} onClick={() => setFiltro('atrasadas')}>Atrasadas</FilterPill>
        <FilterPill active={filtro === 'entregues'} onClick={() => setFiltro('entregues')}>Entregues</FilterPill>
        <FilterPill active={filtro === 'todas'} onClick={() => setFiltro('todas')}>Todas</FilterPill>
        <span className="mx-1 h-4 w-px bg-ink-200" aria-hidden="true" />
        <select
          value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}
          className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Toda competência</option>
          <option value={competenciaAtual()}>Mês atual ({competenciaAtual()})</option>
          {gerarUltimasCompetencias(6).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Conteúdo */}
      {query.isPending ? (
        <Card className="flex items-center justify-center py-12"><Spinner size={20} /></Card>
      ) : query.isError ? (
        <Card>
          <Empty
            icon={AlertTriangle}
            title="Erro ao carregar obrigações"
            description="Tente atualizar a página em alguns segundos."
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <Empty
            icon={ClipboardList}
            title={filtro === 'em_aberto' ? 'Sem obrigações em aberto' : 'Nada com esse filtro'}
            description={filtro === 'em_aberto'
              ? 'Tudo em dia — não há entregas pendentes para a sua empresa neste momento.'
              : 'Mude o filtro acima para ver mais.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => (
            <ObrigacaoCard key={o.id} obrigacao={o} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Card de obrigação ────────────────────────────────────────────────────

function ObrigacaoCard({ obrigacao }: { obrigacao: EntregaResumida }) {
  const [expanded, setExpanded] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const prazo = new Date(obrigacao.prazo_legal + 'T12:00:00')
  const hoje = new Date()
  const diasRestantes = Math.ceil((prazo.getTime() - hoje.getTime()) / 86_400_000)
  const arquivos = obrigacao.arquivos ?? []
  const podeBaixar = arquivos.length > 0

  async function handleDownload(id: string, nome: string) {
    setErro(null)
    setDownloading(id)
    try {
      await baixarArquivo(id, nome)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'erro ao baixar arquivo')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <Card className="!p-0">
      <button
        type="button"
        onClick={() => setExpanded(s => !s)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-ink-50/60"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            obrigacao.status === 'atrasada' ? 'bg-rose-50 text-rose-700'
              : obrigacao.status === 'entregue' ? 'bg-brand-50 text-brand-700'
              : diasRestantes <= 3 ? 'bg-gold-100 text-gold-700'
              : 'bg-mind-100 text-mind-700'
          )}>
            {obrigacao.status === 'entregue'
              ? <CheckCircle2 size={16} />
              : <CalendarClock size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-ink-900">
                {obrigacao.obrigacao_nome}
              </p>
              <Pill className={STATUS_PILL[obrigacao.status]}>
                {STATUS_LABEL[obrigacao.status]}
              </Pill>
            </div>
            <p className="text-[11px] text-ink-500">
              {capitalize(obrigacao.departamento)} · competência {obrigacao.competencia} · prazo {dateBR(prazo)}
              {podeBaixar && (
                <span className="ml-2 inline-flex items-center gap-1 font-medium text-mind-700">
                  · <FileText size={10} /> {arquivos.length} arquivo{arquivos.length > 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PrazoBadge dias={diasRestantes} status={obrigacao.status} />
          {expanded ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-black/5 px-5 py-4">
          {!podeBaixar ? (
            <p className="text-sm text-ink-500">
              {obrigacao.status === 'entregue'
                ? 'Esta entrega foi marcada como concluída, mas nenhum arquivo foi publicado para você.'
                : 'O escritório ainda não publicou nenhum arquivo para você nesta obrigação.'}
            </p>
          ) : (
            <>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Arquivos disponíveis
              </p>
              <ul className="space-y-2">
                {arquivos.map(a => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-ink-50/40 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText size={14} className="shrink-0 text-mind-600" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">{a.nome_original}</p>
                        <p className="text-[11px] text-ink-500">
                          {formatBytes(a.tamanho_bytes)} · publicado em {dateBR(a.created_at)}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={Download}
                      onClick={() => void handleDownload(a.id, a.nome_original)}
                      disabled={downloading === a.id}
                    >
                      {downloading === a.id ? 'Baixando…' : 'Baixar'}
                    </Button>
                  </li>
                ))}
              </ul>
              {erro && (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
                  {erro}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────

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

function PrazoBadge({ dias, status }: { dias: number; status: EntregaStatus }) {
  if (status === 'entregue' || status === 'dispensada' || status === 'justificada') {
    return null
  }
  if (dias < 0) return <Pill className="bg-rose-50 text-rose-800 ring-rose-200">{Math.abs(dias)}d atrasada</Pill>
  if (dias === 0) return <Pill className="bg-gold-100 text-gold-800 ring-gold-200">vence hoje</Pill>
  if (dias <= 3) return <Pill className="bg-gold-100 text-gold-800 ring-gold-200">em {dias}d</Pill>
  return <Pill className="bg-ink-100 text-ink-700 ring-black/10">em {dias}d</Pill>
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function gerarUltimasCompetencias(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  d.setDate(1)
  // Começa do mês anterior (mês atual já está fixo na opção dedicada)
  for (let i = 1; i <= n; i++) {
    const x = new Date(d)
    x.setMonth(d.getMonth() - i)
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}
