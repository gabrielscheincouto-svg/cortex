import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Button, Empty, Pill } from '@/components/ui'
import { BalanceteDetalheClient } from './actions'

function mesAnterior(competencia: string) {
  const [ano, mes] = competencia.split('-').map(Number)
  const data = new Date(ano, mes - 2, 1)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

export default async function BalanceteDetalhePage({ params }: { params: { empresaId: string; competencia: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, razao_social')
    .eq('id', params.empresaId)
    .eq('org_id', ctx.org_id)
    .single()

  const { data: balancete } = await supabase
    .from('balancetes')
    .select('id, org_id, empresa_id, competencia, fechado, fechado_em, fechado_por_id, observacoes, created_at, updated_at')
    .eq('empresa_id', params.empresaId)
    .eq('competencia', params.competencia)
    .eq('org_id', ctx.org_id)
    .maybeSingle()

  if (!empresa || !balancete) {
    return (
      <div className="space-y-5">
        <Link href={`/balancete/${params.empresaId}`}><Button size="sm" icon={ChevronLeft}>Voltar</Button></Link>
        <Empty title="Balancete ainda não existe" description="Crie a competência na linha do tempo antes de lançar contas." />
      </div>
    )
  }

  const { data: contas } = await supabase
    .from('balancete_contas')
    .select('*')
    .eq('balancete_id', balancete.id)
    .order('ordem')

  const anterior = mesAnterior(params.competencia)
  const { data: contasAnterior } = await supabase
    .from('balancetes')
    .select('balancete_contas(codigo, saldo_atual)')
    .eq('empresa_id', params.empresaId)
    .eq('competencia', anterior)
    .eq('org_id', ctx.org_id)
    .maybeSingle()

  const variacoes = Object.fromEntries((contas ?? []).map(conta => {
    const previa = (contasAnterior?.balancete_contas ?? []).find((item: { codigo: string }) => item.codigo === conta.codigo)
    const prev = Number(previa?.saldo_atual ?? 0)
    const atual = Number(conta.saldo_atual ?? 0)
    return [conta.codigo, { valor: atual - prev, perc: prev !== 0 ? (atual - prev) / Math.abs(prev) : undefined }]
  }))

  const normalizado = { ...balancete, empresa_nome: empresa.razao_social, contas_count: contas?.length ?? 0 }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href={`/balancete/${params.empresaId}`}><Button size="sm" icon={ChevronLeft}>Voltar</Button></Link>
          <h1 className="mt-4 text-2xl font-semibold text-ink-900">{empresa.razao_social}</h1>
          <p className="mt-1 text-sm text-ink-500">Balancete {params.competencia} comparado com {anterior}.</p>
        </div>
        <Pill className={balancete.fechado ? 'bg-emerald-100 text-emerald-900 ring-emerald-300' : 'bg-amber-100 text-amber-900 ring-amber-300'}>
          {balancete.fechado ? 'Fechado' : 'Aberto'}
        </Pill>
      </div>
      <BalanceteDetalheClient token={session.access_token} balancete={normalizado} contas={contas ?? []} variacoes={variacoes} />
    </div>
  )
}
