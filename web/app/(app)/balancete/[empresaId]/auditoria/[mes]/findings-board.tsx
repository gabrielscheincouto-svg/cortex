/**
 * FindingsBoard — Client Component das interações de auditoria.
 *
 * O Server Component (page.tsx) carrega os dados iniciais. Esse aqui assume a
 * partir daí, chamando a API Go via apiBrowser pra:
 *   - Rodar auditoria (POST /balancetes/:id/auditoria/rodar)
 *   - Resolver finding (PATCH /findings/:id)
 *   - Liquidar mês (POST /balancetes/:id/liquidar)
 *
 * UX:
 *   - Findings danger primeiro, depois warning, depois resolvidos (collapsed)
 *   - Cada finding tem 3 ações: Justificar (com textarea) / Marcar corrigido / Arquivar
 *   - Botão "Liquidar mês" no topo direito, disabled se há abertos
 *   - "Rodar auditoria de novo" no topo (re-roda; preserva findings já justificados)
 */

'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, AlertCircle, CheckCircle2, Archive, RotateCw,
  Lock, Loader2, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react'
import { Button, Card, Pill, Empty, Textarea } from '@/components/ui'
import { apiBrowser } from '@/lib/api'
import type {
  BalanceteFinding, BalanceteFindingsResumo, FindingSeverity, FindingStatus, FindingTipo,
} from '@/lib/api'

interface Props {
  balanceteId: string
  balanceteFechado: boolean
  empresaId: string
  mes: string
  empresaNome: string
  initialFindings: BalanceteFinding[]
  initialResumo: BalanceteFindingsResumo
  initialPodeLiquidar: boolean
}

type FilterStatus = 'todos' | 'abertos' | 'resolvidos'

const TIPO_LABEL: Record<FindingTipo, string> = {
  saldo_invertido: 'Saldo invertido',
  variacao_extrema: 'Variação extrema',
  conta_reativada: 'Conta reativada',
  outlier_estatistico: 'Outlier estatístico',
  receita_zerada: 'Receita zerada',
  despesa_atipica: 'Despesa atípica',
  bate_dre_divergente: 'DRE não bate com balancete',
}

export function FindingsBoard({
  balanceteId, balanceteFechado, empresaNome, mes,
  initialFindings, initialResumo, initialPodeLiquidar,
}: Props) {
  const router = useRouter()
  const [findings, setFindings] = useState<BalanceteFinding[]>(initialFindings)
  const [resumo, setResumo] = useState<BalanceteFindingsResumo>(initialResumo)
  const [podeLiquidar, setPodeLiquidar] = useState(initialPodeLiquidar)
  const [filter, setFilter] = useState<FilterStatus>('abertos')
  const [token] = useTokenLazy()
  const [rodando, startRodando] = useTransition()
  const [liquidando, startLiquidando] = useTransition()
  const [erroBanner, setErroBanner] = useState<string | null>(null)

  const counters = useMemo(() => {
    const danger = findings.filter(f => f.severity === 'danger' && f.status === 'aberto').length
    const warning = findings.filter(f => f.severity === 'warning' && f.status === 'aberto').length
    const resolvidos = findings.filter(f => f.status !== 'aberto').length
    return { danger, warning, resolvidos }
  }, [findings])

  const filtered = useMemo(() => {
    if (filter === 'abertos') return findings.filter(f => f.status === 'aberto')
    if (filter === 'resolvidos') return findings.filter(f => f.status !== 'aberto')
    return findings
  }, [findings, filter])

  async function rodarAuditoria() {
    setErroBanner(null)
    startRodando(async () => {
      try {
        const t = await token()
        await apiBrowser(t).rodarAuditoriaBalancete(balanceteId)
        // Recarrega via router.refresh — Server Component vai re-buscar os dados frescos
        router.refresh()
      } catch (e) {
        setErroBanner(messageOf(e))
      }
    })
  }

  async function liquidar() {
    setErroBanner(null)
    if (!podeLiquidar) {
      setErroBanner('Existem findings em aberto. Justifique ou corrija antes de liquidar.')
      return
    }
    if (!confirm(`Liquidar o mês de ${empresaNome} em ${mes}? Após liquidar, o balancete fica fechado.`)) return
    startLiquidando(async () => {
      try {
        const t = await token()
        await apiBrowser(t).liquidarBalancete(balanceteId)
        router.refresh()
      } catch (e) {
        setErroBanner(messageOf(e))
      }
    })
  }

  async function resolverFinding(
    finding: BalanceteFinding,
    status: 'justificado' | 'corrigido' | 'arquivado',
    justificativa?: string,
  ) {
    setErroBanner(null)
    try {
      const t = await token()
      const atualizado = await apiBrowser(t).resolverBalanceteFinding(finding.id, { status, justificativa })
      setFindings(prev => prev.map(f => (f.id === finding.id ? atualizado : f)))
      // Atualiza contagens otimistas
      setResumo(prev => ({
        ...prev,
        abertos: Math.max(0, prev.abertos - 1),
        resolvidos: prev.resolvidos + 1,
      }))
      // Se zerou os abertos, libera o botão de liquidar
      const novoAbertos = findings.filter(f => f.status === 'aberto' && f.id !== finding.id).length
      if (novoAbertos === 0 && !balanceteFechado) setPodeLiquidar(true)
    } catch (e) {
      setErroBanner(messageOf(e))
    }
  }

  // ── Empty state especial: nenhum finding ainda — peça pra rodar
  if (findings.length === 0) {
    return (
      <Card className="p-0">
        <div className="px-6 py-12 text-center">
          <Sparkles size={28} className="mx-auto mb-3 text-mind-500" />
          <h3 className="text-base font-semibold text-ink-900">Auditoria ainda não rodou neste balancete</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
            O Cortex vai aplicar 5 regras (saldo invertido, variação extrema, outlier estatístico,
            receita zerada, despesa atípica) e devolver os achados pra você revisar.
          </p>
          {erroBanner && <ErrorBanner message={erroBanner} />}
          <div className="mt-5">
            <Button
              variant="primary"
              icon={rodando ? Loader2 : Sparkles}
              onClick={() => void rodarAuditoria()}
              disabled={rodando || balanceteFechado}
            >
              {rodando ? 'Rodando auditoria…' : 'Rodar auditoria agora'}
            </Button>
          </div>
          {balanceteFechado && (
            <p className="mt-3 inline-flex items-center gap-1 text-xs text-brand-700">
              <Lock size={12} /> Este balancete já está fechado.
            </p>
          )}
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: filtros + ações */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill active={filter === 'abertos'} onClick={() => setFilter('abertos')}>
            Em aberto · {resumo.abertos}
          </FilterPill>
          <FilterPill active={filter === 'resolvidos'} onClick={() => setFilter('resolvidos')}>
            Resolvidos · {resumo.resolvidos}
          </FilterPill>
          <FilterPill active={filter === 'todos'} onClick={() => setFilter('todos')}>
            Todos · {resumo.total}
          </FilterPill>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={rodando ? Loader2 : RotateCw}
            onClick={() => void rodarAuditoria()}
            disabled={rodando || balanceteFechado}
          >
            {rodando ? 'Rodando…' : 'Rodar auditoria de novo'}
          </Button>
          <Button
            size="sm"
            variant={podeLiquidar ? 'success' : 'secondary'}
            icon={liquidando ? Loader2 : CheckCircle2}
            onClick={() => void liquidar()}
            disabled={!podeLiquidar || liquidando || balanceteFechado}
            title={!podeLiquidar ? 'Resolva os findings em aberto antes' : 'Liquidar o mês'}
          >
            {liquidando ? 'Liquidando…' : balanceteFechado ? 'Mês liquidado' : 'Liquidar mês'}
          </Button>
        </div>
      </div>

      {erroBanner && <ErrorBanner message={erroBanner} />}

      {/* Lista */}
      {filtered.length === 0 ? (
        <Empty
          icon={CheckCircle2}
          title={filter === 'abertos' ? 'Nenhum finding em aberto' : 'Nenhum finding com esse filtro'}
          description={
            filter === 'abertos' && counters.resolvidos > 0
              ? `Todos os ${counters.resolvidos} findings foram tratados. Você pode liquidar o mês.`
              : 'Mude o filtro pra ver mais.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(f => (
            <FindingCard
              key={f.id}
              finding={f}
              disabled={balanceteFechado}
              onResolve={resolverFinding}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── FindingCard — card individual ──────────────────────────────────────────

function FindingCard({
  finding, disabled, onResolve,
}: {
  finding: BalanceteFinding
  disabled: boolean
  onResolve: (f: BalanceteFinding, status: 'justificado' | 'corrigido' | 'arquivado', j?: string) => Promise<void>
}) {
  const [showJustify, setShowJustify] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [busy, startTx] = useTransition()

  const isResolved = finding.status !== 'aberto'
  const sevTint =
    finding.severity === 'danger'
      ? 'border-l-rose-500 bg-rose-50/40'
      : 'border-l-amber-500 bg-amber-50/40'
  const ringClass = isResolved
    ? 'border-black/10 bg-white'
    : `bg-white border-black/10 border-l-4 ${sevTint}`

  return (
    <Card className={`!p-0 ${ringClass}`}>
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <SeverityIcon severity={finding.severity} resolved={isResolved} />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Pill className={severityPillClass(finding.severity, isResolved)}>
                {TIPO_LABEL[finding.tipo] ?? finding.tipo}
              </Pill>
              {isResolved && <StatusPill status={finding.status} />}
              {finding.conta_codigo && (
                <span className="font-mono text-[11px] text-ink-500">{finding.conta_codigo}</span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-ink-900">{finding.titulo}</h3>
            <p className="mt-1 text-sm leading-snug text-ink-700">{finding.descricao}</p>

            {isResolved && finding.justificativa && (
              <div className="mt-3 rounded-lg border border-black/5 bg-ink-50/60 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  Justificativa
                </p>
                <p className="mt-1 text-sm text-ink-700">{finding.justificativa}</p>
                {finding.resolvido_em && (
                  <p className="mt-1 text-[11px] text-ink-400">
                    Resolvido em {new Date(finding.resolvido_em).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            )}

            {/* Detalhes técnicos colapsáveis */}
            {finding.contexto && Object.keys(finding.contexto).length > 0 && (
              <button
                type="button"
                onClick={() => setShowDetails(s => !s)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-ink-500 hover:text-ink-900"
              >
                {showDetails ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                Detalhes técnicos
              </button>
            )}
            {showDetails && (
              <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-900 px-3 py-2 text-[11px] text-ink-100">
                {JSON.stringify(finding.contexto, null, 2)}
              </pre>
            )}

            {/* Ações */}
            {!isResolved && !disabled && (
              <div className="mt-3">
                {showJustify ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Explique por que esse achado pode ser ignorado (essa justificativa fica gravada no audit log)"
                      rows={2}
                      value={justificativa}
                      onChange={e => setJustificativa(e.target.value)}
                      disabled={busy}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={busy || justificativa.trim().length < 8}
                        onClick={() => startTx(async () => {
                          await onResolve(finding, 'justificado', justificativa.trim())
                          setShowJustify(false)
                          setJustificativa('')
                        })}
                      >
                        {busy ? 'Salvando…' : 'Salvar justificativa'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowJustify(false); setJustificativa('') }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" icon={CheckCircle2} onClick={() => setShowJustify(true)}>
                      Justificar
                    </Button>
                    <Button
                      size="sm"
                      variant="success"
                      icon={CheckCircle2}
                      disabled={busy}
                      onClick={() => startTx(() => onResolve(finding, 'corrigido'))}
                    >
                      Já corrigi (re-importei)
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Archive}
                      disabled={busy}
                      onClick={() => {
                        const j = prompt('Por que arquivar esse achado? (vai pro audit log)')
                        if (!j || j.trim().length < 8) return
                        startTx(() => onResolve(finding, 'arquivado', j.trim()))
                      }}
                    >
                      Arquivar
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Sub-componentes ────────────────────────────────────────────────────────

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

function SeverityIcon({ severity, resolved }: { severity: FindingSeverity; resolved: boolean }) {
  if (resolved) {
    return (
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <CheckCircle2 size={16} />
      </div>
    )
  }
  if (severity === 'danger') {
    return (
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-700">
        <AlertCircle size={16} />
      </div>
    )
  }
  return (
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
      <AlertTriangle size={16} />
    </div>
  )
}

function severityPillClass(severity: FindingSeverity, resolved: boolean): string {
  if (resolved) return 'bg-ink-100 text-ink-700 ring-ink-200'
  if (severity === 'danger') return 'bg-rose-50 text-rose-800 ring-rose-200'
  return 'bg-amber-50 text-amber-800 ring-amber-200'
}

function StatusPill({ status }: { status: FindingStatus }) {
  const label =
    status === 'justificado' ? 'Justificado'
    : status === 'corrigido' ? 'Corrigido'
    : status === 'arquivado' ? 'Arquivado'
    : status
  return (
    <Pill className="bg-brand-50 text-brand-800 ring-brand-200">
      <CheckCircle2 size={10} className="mr-1 inline" />
      {label}
    </Pill>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-3 inline-flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Hook lazy pra pegar access_token sem precisar passar via props. */
function useTokenLazy(): [() => Promise<string>] {
  // Importação dinâmica evita carregar @supabase/ssr no client
  const get = async () => {
    const { createBrowserClient } = await import('@supabase/ssr')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    const supabase = createBrowserClient(url, key)
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) throw new Error('sessão expirada — faça login novamente')
    return data.session.access_token
  }
  return [get]
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'erro inesperado'
}
