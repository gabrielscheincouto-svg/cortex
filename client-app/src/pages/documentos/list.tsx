/**
 * Documentos do cliente — lista arquivos visíveis publicados pelo escritório.
 *
 * Fonte: entrega_arquivos onde visivel_cliente = TRUE da empresa atribuída via
 * empresa_usuarios_finais (RLS faz o filtro). Agrupados por mês de competência.
 *
 * Filtros: busca por nome + tipo (guia/declaração/recibo/etc).
 * Download: via signed URL gerada pelo backend Go (lib/api.baixarArquivo).
 */
import { useMemo, useState } from 'react'
import {
  FolderArchive, Download, FileText, Search, AlertTriangle,
  FileCheck, Receipt, BookOpen,
} from 'lucide-react'
import { Card, Empty, Pill, Spinner, Button, Input } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { useDocumentos, type ArquivoTipo, type DocumentoCliente } from '@/lib/queries'
import { baixarArquivo } from '@/lib/api'
import { dateBR, cn } from '@/lib/utils'

const TIPO_LABEL: Record<ArquivoTipo, string> = {
  sped: 'SPED',
  guia: 'Guia',
  recibo: 'Recibo',
  declaracao: 'Declaração',
  relatorio: 'Relatório',
  documento: 'Documento',
  outro: 'Outro',
}

const TIPO_PILL: Record<ArquivoTipo, string> = {
  guia: 'bg-mind-100 text-mind-800 ring-mind-200',
  declaracao: 'bg-brand-50 text-brand-800 ring-brand-200',
  recibo: 'bg-gold-100 text-gold-800 ring-gold-200',
  sped: 'bg-ink-100 text-ink-700 ring-black/10',
  relatorio: 'bg-rose-50 text-rose-800 ring-rose-200',
  documento: 'bg-ink-100 text-ink-700 ring-black/10',
  outro: 'bg-ink-100 text-ink-500 ring-black/10',
}

type FiltroTipo = 'todos' | ArquivoTipo

export function DocumentosListPage() {
  const { empresa } = useAuth()
  const docs = useDocumentos(empresa?.id)
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState<FiltroTipo>('todos')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const filtrados = useMemo(() => {
    const all = docs.data ?? []
    const term = busca.trim().toLowerCase()
    return all.filter(d => {
      if (tipo !== 'todos' && d.tipo !== tipo) return false
      if (term) {
        const blob = `${d.nome_original} ${d.obrigacao_nome} ${d.competencia}`.toLowerCase()
        if (!blob.includes(term)) return false
      }
      return true
    })
  }, [docs.data, busca, tipo])

  // Agrupa por competência (yyyy-MM), do mais recente pro mais antigo
  const grupos = useMemo(() => {
    const map = new Map<string, DocumentoCliente[]>()
    for (const d of filtrados) {
      const k = d.competencia || 'sem_competencia'
      const arr = map.get(k) ?? []
      arr.push(d)
      map.set(k, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'sem_competencia') return 1
      if (b === 'sem_competencia') return -1
      return b.localeCompare(a)
    })
  }, [filtrados])

  async function handleDownload(d: DocumentoCliente) {
    setErro(null)
    setDownloading(d.id)
    try {
      await baixarArquivo(d.id, d.nome_original)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'erro ao baixar arquivo')
    } finally {
      setDownloading(null)
    }
  }

  const tiposDisponiveis = useMemo(() => {
    const all = new Set((docs.data ?? []).map(d => d.tipo))
    return Array.from(all)
  }, [docs.data])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">Documentos</h1>
        <p className="mt-1 text-sm text-ink-500">
          Tudo que o escritório publicou para sua empresa — guias, declarações, recibos, relatórios.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:flex-initial sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input
            placeholder="Buscar por nome, obrigação, mês…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={tipo}
          onChange={e => setTipo(e.target.value as FiltroTipo)}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="todos">Todos os tipos</option>
          {tiposDisponiveis.map(t => (
            <option key={t} value={t}>{TIPO_LABEL[t]}</option>
          ))}
        </select>
      </div>

      {erro && (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          {erro}
        </div>
      )}

      {/* Conteúdo */}
      {docs.isPending ? (
        <Card className="flex items-center justify-center py-12"><Spinner size={20} /></Card>
      ) : docs.isError ? (
        <Card>
          <Empty
            icon={AlertTriangle}
            title="Erro ao carregar documentos"
            description="Tente atualizar a página em alguns segundos."
          />
        </Card>
      ) : filtrados.length === 0 ? (
        <Card>
          <Empty
            icon={FolderArchive}
            title={busca || tipo !== 'todos' ? 'Nada com esses filtros' : 'Sem documentos ainda'}
            description={busca || tipo !== 'todos'
              ? 'Tente limpar os filtros pra ver tudo.'
              : 'Quando o escritório publicar guias, declarações ou outros arquivos, eles aparecem aqui.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {grupos.map(([competencia, items]) => (
            <section key={competencia}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-500">
                {competencia === 'sem_competencia' ? 'Sem competência' : formatarMes(competencia)}
                <span className="ml-2 font-medium normal-case text-ink-400">
                  ({items.length} {items.length === 1 ? 'arquivo' : 'arquivos'})
                </span>
              </h2>
              <div className="space-y-2">
                {items.map(d => (
                  <DocumentoCard
                    key={d.id}
                    documento={d}
                    onDownload={() => void handleDownload(d)}
                    downloading={downloading === d.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Card de documento ───────────────────────────────────────────────────

function DocumentoCard({
  documento, onDownload, downloading,
}: {
  documento: DocumentoCliente
  onDownload: () => void
  downloading: boolean
}) {
  const Icone = iconePorTipo(documento.tipo)
  return (
    <Card className="!p-0">
      <div className="flex items-center gap-3 px-5 py-3.5">
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          documento.tipo === 'guia' ? 'bg-mind-50 text-mind-700'
            : documento.tipo === 'declaracao' ? 'bg-brand-50 text-brand-700'
            : documento.tipo === 'recibo' ? 'bg-gold-50 text-gold-700'
            : 'bg-ink-50 text-ink-700',
        )}>
          <Icone size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-ink-900">{documento.nome_original}</p>
            <Pill className={TIPO_PILL[documento.tipo]}>{TIPO_LABEL[documento.tipo]}</Pill>
          </div>
          <p className="text-[11px] text-ink-500">
            {documento.obrigacao_nome} · {capitalize(documento.departamento)} · {formatBytes(documento.tamanho_bytes)}
            <span className="ml-2 text-ink-400">· publicado {dateBR(documento.created_at)}</span>
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          icon={Download}
          onClick={onDownload}
          disabled={downloading}
        >
          {downloading ? 'Baixando…' : 'Baixar'}
        </Button>
      </div>
    </Card>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function iconePorTipo(t: ArquivoTipo) {
  switch (t) {
    case 'guia': return Receipt
    case 'declaracao': return FileCheck
    case 'relatorio': return BookOpen
    case 'sped':
    case 'recibo':
    case 'documento':
    case 'outro':
    default: return FileText
  }
}

function formatarMes(yyyymm: string): string {
  if (!/^\d{4}-\d{2}$/.test(yyyymm)) return yyyymm
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const [yyyy, mm] = yyyymm.split('-')
  const idx = Number(mm) - 1
  if (idx < 0 || idx > 11) return yyyymm
  return `${meses[idx]} ${yyyy}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}
