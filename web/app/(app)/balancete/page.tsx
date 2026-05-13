import Link from 'next/link'
import { BarChart3, Building2 } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, Empty, Pill } from '@/components/ui'

function statusUltimo(competencia?: string, fechado?: boolean) {
  if (!competencia) return { label: 'Sem balancete', className: 'bg-ink-100 text-ink-700 ring-ink-200' }
  if (fechado) return { label: 'Fechado', className: 'bg-emerald-100 text-emerald-900 ring-emerald-300' }
  const atual = new Date().toISOString().slice(0, 7)
  if (competencia < atual) return { label: 'Atrasado', className: 'bg-rose-100 text-rose-900 ring-rose-300' }
  return { label: 'Aberto', className: 'bg-amber-100 text-amber-900 ring-amber-300' }
}

export default async function BalancetePage() {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const { data: empresas } = await supabase
    .from('empresas')
    .select('id, razao_social, nome_fantasia, status, balancetes(competencia, fechado, updated_at)')
    .eq('org_id', ctx.org_id)
    .neq('status', 'baixada')
    .order('razao_social')
    .limit(200)

  const linhas = (empresas ?? []).map(empresa => {
    const balancetes = [...(empresa.balancetes ?? [])].sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)))
    return { ...empresa, ultimo: balancetes[0] }
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Análise de balancete</h1>
        <p className="mt-1 text-sm text-ink-500">Memória contábil mensal, comparativos e indicadores por empresa.</p>
      </div>

      <Card>
        {linhas.length === 0 ? (
          <Empty icon={Building2} title="Nenhuma empresa ativa" description="Cadastre empresas antes de importar balancetes." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Empresa</th>
                  <th className="px-4 py-3 text-left font-semibold">Último balancete</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {linhas.map(empresa => {
                  const status = statusUltimo(empresa.ultimo?.competencia, empresa.ultimo?.fechado)
                  return (
                    <tr key={empresa.id} className="hover:bg-ink-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-900">{empresa.razao_social}</p>
                        {empresa.nome_fantasia && <p className="text-xs text-ink-500">{empresa.nome_fantasia}</p>}
                      </td>
                      <td className="px-4 py-3 text-ink-700">{empresa.ultimo?.competencia ?? '-'}</td>
                      <td className="px-4 py-3"><Pill className={status.className}>{status.label}</Pill></td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/balancete/${empresa.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-900">
                          <BarChart3 size={15} /> Abrir análise
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
