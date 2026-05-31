/**
 * Atividade do Robô — timeline auditável.
 *
 * Lista as últimas N ações do robô Tauri (entrega_eventos com ator_descricao
 * = 'robo_tauri', tipo arquivo_anexado). Pra cada ação:
 *   - quando aconteceu
 *   - qual hostname do robô disparou
 *   - qual empresa-cliente foi identificada
 *   - qual obrigação foi liquidada
 *   - link pra entrega
 *
 * Pra escritório fiscalizar se o robô tá identificando errado e poder reverter.
 */

import Link from 'next/link'
import { Bot, FileCheck, FolderOpen, AlertTriangle, ExternalLink } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, Empty, Pill, Stat } from '@/components/ui'
import { ago } from '@/lib/utils'

export const revalidate = 0

interface EventoRow {
  id: string
  entrega_id: string
  criado_em: string
  payload: Record<string, unknown>
  entregas: {
    id: string
    competencia: string
    empresa_id: string
    obrigacao_id: string
    empresas: { id: string; razao_social: string; nome_fantasia: string | null }[] | null
    obrigacoes_catalogo: { id: string; nome: string; codigo: string }[] | null
  }[] | null
}

export default async function AtividadeRoboPage({
  searchParams,
}: {
  searchParams: { hostname?: string; obrigacao?: string }
}) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  // Carrega últimos 100 arquivos anexados pelo robô
  let q = supabase
    .from('entrega_eventos')
    .select(`
      id, entrega_id, criado_em, payload,
      entregas:entrega_id (
        id, competencia, empresa_id, obrigacao_id,
        empresas:empresa_id (id, razao_social, nome_fantasia),
        obrigacoes_catalogo:obrigacao_id (id, nome, codigo)
      )
    `)
    .eq('org_id', ctx.org_id)
    .eq('tipo', 'arquivo_anexado')
    .eq('ator_descricao', 'robo_tauri')
    .order('criado_em', { ascending: false })
    .limit(100)

  if (searchParams.hostname) {
    q = q.eq('payload->>hostname', searchParams.hostname)
  }

  const { data: eventosRaw } = await q

  const eventos = (eventosRaw ?? []) as EventoRow[]

  // KPIs por janela
  const agora = new Date()
  const ultimas24h = eventos.filter(e => new Date(e.criado_em).getTime() > agora.getTime() - 86_400_000)
  const ultimos7d = eventos.filter(e => new Date(e.criado_em).getTime() > agora.getTime() - 7 * 86_400_000)
  const hostnames = new Set(eventos.map(e => String((e.payload as { hostname?: string })?.hostname ?? '')).filter(Boolean))

  // Estado dos robôs registrados (heartbeat)
  const { data: hostsRaw } = await supabase
    .from('robo_hosts')
    .select('id, hostname, arquivos_enviados, ultimo_heartbeat_at, ativo')
    .eq('org_id', ctx.org_id)
    .order('ultimo_heartbeat_at', { ascending: false, nullsFirst: false })
    .limit(20)

  type Host = {
    id: string
    hostname: string
    arquivos_enviados: number
    ultimo_heartbeat_at: string | null
    ativo: boolean
  }
  const hosts = (hostsRaw ?? []) as Host[]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-ink-900 sm:text-2xl">
          <Bot size={22} className="text-mind-600" />
          Atividade do Robô
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Tudo o que o robô Tauri liquidou nesta org. Cada arquivo identificado, qual cliente, qual obrigação.
        </p>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Liquidados (24h)" value={String(ultimas24h.length)} accent={ultimas24h.length > 0 ? 'brand' : 'none'} />
        <Stat label="Liquidados (7 dias)" value={String(ultimos7d.length)} />
        <Stat label="Total visível" value={String(eventos.length)} sub="últimos 100" />
        <Stat label="Robôs ativos" value={String(hosts.filter(h => h.ativo).length)} sub={`${hostnames.size} máquinas`} />
      </div>

      {/* Hosts */}
      {hosts.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-black/5 px-5 py-3.5">
            <p className="text-sm font-semibold text-ink-900">Máquinas com robô ativo</p>
          </div>
          <div className="divide-y divide-black/5 px-5">
            {hosts.map(h => (
              <div key={h.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${h.ativo ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>
                    <Bot size={14} />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-medium text-ink-900">{h.hostname}</p>
                    <p className="text-[11px] text-ink-500">
                      {h.ultimo_heartbeat_at
                        ? `último sinal ${ago(h.ultimo_heartbeat_at)}`
                        : 'sem sinal ainda'}
                      {' · '}
                      {h.arquivos_enviados.toLocaleString('pt-BR')} arquivos enviados
                    </p>
                  </div>
                </div>
                <Pill className={h.ativo ? 'bg-brand-50 text-brand-800 ring-brand-200' : 'bg-ink-100 text-ink-600 ring-black/10'}>
                  {h.ativo ? 'Ativo' : 'Inativo'}
                </Pill>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Timeline */}
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-3.5">
          <p className="text-sm font-semibold text-ink-900">Timeline de liquidações</p>
          {searchParams.hostname && (
            <Link href="/robo/atividade" className="text-xs font-medium text-mind-700 hover:text-mind-900">
              Limpar filtro: {searchParams.hostname} ×
            </Link>
          )}
        </div>
        {eventos.length === 0 ? (
          <Empty
            icon={FolderOpen}
            title="Nenhuma liquidação do robô ainda"
            description={
              searchParams.hostname
                ? `Nenhum arquivo do hostname "${searchParams.hostname}" nas últimas 100 ações.`
                : 'Quando o robô identificar um arquivo na pasta e fizer upload, ele aparece aqui em ordem cronológica.'
            }
          />
        ) : (
          <ol className="divide-y divide-black/5">
            {eventos.map(ev => {
              const entrega = Array.isArray(ev.entregas) ? ev.entregas[0] : ev.entregas
              const empresa = entrega?.empresas?.[0]
              const obrigacao = entrega?.obrigacoes_catalogo?.[0]
              const payload = ev.payload as { hostname?: string; arquivo_id?: string; tamanho_bytes?: number }

              return (
                <li key={ev.id} className="flex items-start gap-3 px-5 py-3.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mind-100 text-mind-700">
                    <FileCheck size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-ink-900">
                        {obrigacao?.nome ?? 'Obrigação'}
                        {obrigacao?.codigo && (
                          <span className="ml-2 font-mono text-[11px] font-normal text-ink-500">{obrigacao.codigo}</span>
                        )}
                      </p>
                      {entrega?.competencia && (
                        <Pill className="bg-ink-100 text-ink-700 ring-black/10">{entrega.competencia}</Pill>
                      )}
                    </div>
                    <p className="text-xs text-ink-600">
                      <span className="font-medium">{empresa?.nome_fantasia ?? empresa?.razao_social ?? 'empresa'}</span>
                      {payload.hostname && (
                        <>
                          {' · '}
                          <Link
                            href={`/robo/atividade?hostname=${encodeURIComponent(payload.hostname)}`}
                            className="font-mono text-mind-700 hover:text-mind-900"
                          >
                            {payload.hostname}
                          </Link>
                        </>
                      )}
                      {payload.tamanho_bytes && (
                        <> · {formatBytes(payload.tamanho_bytes)}</>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-400">{ago(ev.criado_em)}</p>
                  </div>
                  {entrega && (
                    <Link
                      href={`/entregas/${entrega.id}`}
                      prefetch={false}
                      className="inline-flex shrink-0 items-center gap-1 self-center rounded-lg border border-black/10 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
                    >
                      Abrir <ExternalLink size={11} />
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 text-gold-600" />
          <div className="text-sm text-ink-600">
            <p className="font-medium text-ink-900">Identificou errado?</p>
            <p className="mt-1">
              Se o robô amarrou um arquivo à empresa ou obrigação errada, abra a entrega e clique
              em "Remover arquivo". O regex da obrigação pode estar mal configurado — ajuste em{' '}
              <Link href="/configuracoes/departamentos" className="font-medium text-mind-700 hover:text-mind-900">
                Configurações
              </Link>.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}
