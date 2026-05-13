import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Button, Empty } from '@/components/ui'
import { BalanceteEmpresaClient } from './actions'

export default async function BalanceteEmpresaPage({ params }: { params: { empresaId: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, razao_social, nome_fantasia')
    .eq('id', params.empresaId)
    .eq('org_id', ctx.org_id)
    .single()

  const { data: balancetes } = await supabase
    .from('balancetes')
    .select('id, org_id, empresa_id, competencia, fechado, fechado_em, fechado_por_id, observacoes, created_at, updated_at, balancete_contas(count)')
    .eq('empresa_id', params.empresaId)
    .eq('org_id', ctx.org_id)
    .order('competencia', { ascending: false })
    .limit(12)

  const ids = (balancetes ?? []).map(b => b.id)
  const { data: contas } = ids.length
    ? await supabase.from('balancete_contas').select('*').in('balancete_id', ids).order('ordem')
    : { data: [] }

  const normalizados = (balancetes ?? []).map(b => ({
    ...b,
    empresa_nome: empresa?.razao_social,
    contas_count: (b.balancete_contas?.[0]?.count as number | undefined) ?? 0,
  }))

  const contasPorBalancete = Object.fromEntries(
    ids.map(id => [id, (contas ?? []).filter(conta => conta.balancete_id === id)])
  )

  if (!empresa) {
    return <Empty title="Empresa não encontrada" description="Não consegui ler essa empresa nesta org." />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/balancete"><Button size="sm" icon={ChevronLeft}>Voltar</Button></Link>
          <h1 className="mt-4 text-2xl font-semibold text-ink-900">{empresa.razao_social}</h1>
          <p className="mt-1 text-sm text-ink-500">Análise contábil mensal e memória de balancetes.</p>
        </div>
      </div>
      <BalanceteEmpresaClient
        token={session.access_token}
        empresaId={params.empresaId}
        balancetes={normalizados}
        contasPorBalancete={contasPorBalancete}
      />
    </div>
  )
}
