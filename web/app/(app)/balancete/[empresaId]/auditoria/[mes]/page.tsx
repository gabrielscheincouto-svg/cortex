/**
 * Auditoria do balancete — tela operacional crítica.
 *
 * Para o funcionário do escritório LIQUIDAR o mês contábil de uma empresa,
 * ele precisa passar por aqui: o sistema rodou as 5 regras de auditoria
 * (migration 046) e devolveu uma lista de findings. Cada finding precisa ser
 * justificado ou corrigido antes do botão "Liquidar mês" liberar.
 *
 * Fluxo:
 *   1. Server Component resolve o balancete via (empresa_id, competencia)
 *   2. Carrega resumo + lista inicial de findings via Supabase (RLS protege)
 *   3. Passa tudo pro FindingsBoard (Client Component) que faz as interações
 *      via API Go (rodar auditoria, justificar/resolver, liquidar mês)
 */

import Link from 'next/link'
import { ChevronLeft, AlertTriangle, ShieldCheck, FileSearch } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Empty, Stat } from '@/components/ui'
import { FindingsBoard } from './findings-board'
import type { BalanceteFinding, FindingSeverity, FindingStatus, BalanceteFindingsResumo } from '@/lib/api'

export const revalidate = 0

export default async function AuditoriaBalancetePage({
  params,
}: {
  params: { empresaId: string; mes: string }
}) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  // Validar formato yyyy-MM
  if (!/^\d{4}-\d{2}$/.test(params.mes)) {
    return (
      <Empty
        icon={FileSearch}
        title="Competência inválida"
        description={`O parâmetro "${params.mes}" não está no formato yyyy-MM esperado.`}
      />
    )
  }

  // 1) Resolve empresa + balancete da competência
  const [{ data: empresa }, { data: balancete }] = await Promise.all([
    supabase
      .from('empresas')
      .select('id, razao_social, nome_fantasia, cnpj')
      .eq('id', params.empresaId)
      .eq('org_id', ctx.org_id)
      .maybeSingle(),
    supabase
      .from('balancetes')
      .select('id, empresa_id, competencia, fechado, fechado_em, observacoes')
      .eq('empresa_id', params.empresaId)
      .eq('competencia', params.mes)
      .eq('org_id', ctx.org_id)
      .maybeSingle(),
  ])

  if (!empresa) {
    return <Empty icon={FileSearch} title="Empresa não encontrada" description="Você não tem acesso a essa empresa nesta org." />
  }

  if (!balancete) {
    return (
      <div className="space-y-5">
        <BreadcrumbHeader empresaId={params.empresaId} empresaNome={empresa.nome_fantasia ?? empresa.razao_social} mes={params.mes} />
        <Empty
          icon={FileSearch}
          title={`Sem balancete em ${formatMes(params.mes)}`}
          description="Importe o balancete antes de rodar a auditoria. A auditoria precisa das contas pra calcular as regras."
        />
      </div>
    )
  }

  // 2) Carrega resumo agregado (RPC) + lista inicial de findings (read direto na tabela via RLS)
  type ResumoRow = BalanceteFindingsResumo
  const [{ data: resumoRows }, { data: findingsRaw }] = await Promise.all([
    // PostgREST chama a função SQL como RPC; ele aceita o nome simples (sem schema app.)
    supabase.rpc('balancete_findings_resumo', { p_balancete_id: balancete.id }),
    supabase
      .from('balancete_findings')
      .select('*')
      .eq('balancete_id', balancete.id)
      .order('severity', { ascending: true })   // 'danger' antes de 'warning' (asc string)
      .order('created_at', { ascending: false }),
  ])

  const resumo: BalanceteFindingsResumo =
    Array.isArray(resumoRows) && resumoRows.length > 0
      ? (resumoRows[0] as ResumoRow)
      : { total: 0, abertos: 0, danger: 0, warnings: 0, resolvidos: 0 }

  const findings: BalanceteFinding[] = ((findingsRaw ?? []) as Array<{
    id: string; org_id: string; balancete_id: string;
    severity: FindingSeverity; tipo: BalanceteFinding['tipo']; titulo: string; descricao: string;
    conta_codigo: string | null; conta_descricao: string | null; valor_referencia: number | null;
    contexto: Record<string, unknown> | null;
    status: FindingStatus; justificativa: string | null;
    resolvido_por_id: string | null; resolvido_em: string | null; run_token: string | null;
    created_at: string; updated_at: string;
  }>).map(f => ({
    ...f,
    contexto: f.contexto ?? {},
  }))

  const podeLiquidar = resumo.abertos === 0 && resumo.total > 0 && !balancete.fechado

  return (
    <div className="space-y-5">
      <BreadcrumbHeader
        empresaId={params.empresaId}
        empresaNome={empresa.nome_fantasia ?? empresa.razao_social}
        mes={params.mes}
        cnpj={empresa.cnpj}
        fechado={!!balancete.fechado}
      />

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Findings totais" value={String(resumo.total)} />
        <Stat label="Em aberto" value={String(resumo.abertos)} accent={resumo.abertos > 0 ? 'rose' : 'none'} valueColor={resumo.abertos > 0 ? 'text-rose-700' : undefined} />
        <Stat label="Críticos" value={String(resumo.danger)} accent={resumo.danger > 0 ? 'rose' : 'none'} valueColor={resumo.danger > 0 ? 'text-rose-700' : undefined} />
        <Stat label="Resolvidos" value={String(resumo.resolvidos)} accent={resumo.resolvidos > 0 ? 'brand' : 'none'} valueColor={resumo.resolvidos > 0 ? 'text-brand-700' : undefined} />
      </div>

      <FindingsBoard
        balanceteId={balancete.id}
        balanceteFechado={!!balancete.fechado}
        empresaId={params.empresaId}
        mes={params.mes}
        empresaNome={empresa.nome_fantasia ?? empresa.razao_social}
        initialFindings={findings}
        initialResumo={resumo}
        initialPodeLiquidar={podeLiquidar}
      />
    </div>
  )
}

function BreadcrumbHeader({
  empresaId,
  empresaNome,
  mes,
  cnpj,
  fechado,
}: {
  empresaId: string
  empresaNome: string
  mes: string
  cnpj?: string | null
  fechado?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-ink-500">
        <Link prefetch={false} href="/balancete" className="hover:text-ink-900">Balancete</Link>
        <span>/</span>
        <Link prefetch={false} href={`/balancete/${empresaId}`} className="hover:text-ink-900">{empresaNome}</Link>
        <span>/</span>
        <span className="text-ink-700">Auditoria · {formatMes(mes)}</span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            prefetch={false}
            href={`/balancete/${empresaId}`}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-mind-700 hover:text-mind-900"
          >
            <ChevronLeft size={12} /> Voltar para {empresaNome}
          </Link>
          <h1 className="flex items-center gap-3 text-xl font-semibold text-ink-900 sm:text-2xl">
            <ShieldCheck size={22} className="text-mind-600" />
            Auditoria do balancete
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {empresaNome}
            {cnpj && <span className="ml-2 font-mono text-xs text-ink-400">CNPJ {formatCNPJ(cnpj)}</span>}
            <span className="ml-2">·</span>
            <span className="ml-2">Competência {formatMes(mes)}</span>
            {fechado && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700">
                · <AlertTriangle size={12} /> Mês já liquidado
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

function formatMes(mes: string): string {
  // "2026-05" → "Maio/2026"
  const [yyyy, mm] = mes.split('-')
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const idx = Number(mm) - 1
  if (isNaN(idx) || idx < 0 || idx > 11) return mes
  return `${nomes[idx]}/${yyyy}`
}

function formatCNPJ(raw: string): string {
  const clean = raw.replace(/\D/g, '')
  if (clean.length !== 14) return raw
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`
}
