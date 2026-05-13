import { createServerClient } from '@/lib/supabase'
import { Card, CardHeader, Stat, Pill } from '@/components/ui'
import { brl } from '@/lib/utils'

export default async function PlanosPage() {
  const supabase = createServerClient()

  const { data: planos } = await supabase
    .from('planos')
    .select('*')
    .order('ordem')

  // Contagem de orgs por plano
  const { data: orgsByPlano } = await supabase
    .from('orgs')
    .select('plano_id')

  const countByPlano = (orgsByPlano ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.plano_id] = (acc[r.plano_id] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Planos</h1>
        <p className="mt-1 text-sm text-ink-500">
          Catálogo comercial. Alterações aqui afetam o pricing público e o onboarding self-service.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {planos?.map(p => (
          <Card key={p.id}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{p.codigo}</p>
                <h3 className="mt-1 text-lg font-semibold text-ink-900">{p.nome}</h3>
              </div>
              {p.publico && <Pill className="bg-emerald-100 text-emerald-900 ring-emerald-300">público</Pill>}
            </div>

            <p className="text-3xl font-semibold text-ink-900">
              {brl(p.preco_mensal_cents)}
              <span className="text-sm font-normal text-ink-500"> /mês</span>
            </p>

            <p className="mt-3 text-sm text-ink-500">{p.descricao}</p>

            <dl className="mt-4 space-y-1.5 border-t border-black/5 pt-4 text-xs">
              <DD label="Usuários" value={p.limite_usuarios ? `até ${p.limite_usuarios}` : 'ilimitado'} />
              <DD label="Empresas" value={p.limite_empresas ? `até ${p.limite_empresas}` : 'ilimitado'} />
              <DD label="Storage"  value={p.limite_storage_gb ? `${p.limite_storage_gb} GB` : 'ilimitado'} />
              <DD label="Módulos"  value={`${Array.isArray(p.modulos_inclusos) ? p.modulos_inclusos.length : 0} inclusos`} />
            </dl>

            <div className="mt-4 border-t border-black/5 pt-4">
              <Stat label="Escritórios ativos neste plano" value={(countByPlano[p.id] ?? 0).toString()} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function DD({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-medium text-ink-900">{value}</dd>
    </div>
  )
}
