import Link from 'next/link'
import { Building2, Plus, Search } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, Button, Input, Pill, Empty } from '@/components/ui'
import { brl, dateBR } from '@/lib/utils'

export default async function EmpresasPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const q = searchParams.q?.trim()
  let query = supabase
    .from('empresas')
    .select('id, razao_social, nome_fantasia, cnpj, cidade, estado, status, honorario_mensal_cents, tags, regime_tributario, created_at')
    .eq('org_id', ctx.org_id)
    .order('razao_social')
    .limit(200)

  if (q) {
    query = query.or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%,cnpj.ilike.%${q}%`)
  }

  const { data: empresas, error } = await query

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Empresas atendidas</h1>
          <p className="mt-1 text-sm text-ink-500">
            {empresas?.length ?? 0} empresa{empresas?.length === 1 ? '' : 's'} cadastrada{empresas?.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link href="/empresas/nova"><Button variant="primary" icon={Plus}>Nova empresa</Button></Link>
      </div>

      <Card>
        <form className="mb-4 flex gap-2" action="/empresas" method="GET">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-ink-400" />
            <Input name="q" placeholder="Buscar por razão social, fantasia ou CNPJ" defaultValue={q ?? ''} className="pl-9" />
          </div>
          <Button type="submit" variant="secondary">Buscar</Button>
        </form>

        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">Erro: {error.message}</p>}

        {!error && (!empresas || empresas.length === 0) ? (
          <Empty
            icon={Building2}
            title={q ? 'Nenhuma empresa encontrada' : 'Ainda não há empresas cadastradas'}
            description={q ? 'Tente outros termos' : 'Cadastre a primeira empresa que o escritório atende.'}
            action={!q && <Link href="/empresas/nova"><Button variant="primary" icon={Plus}>Cadastrar primeira</Button></Link>}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Empresa</th>
                  <th className="px-4 py-3 text-left font-semibold">CNPJ</th>
                  <th className="px-4 py-3 text-left font-semibold">Regime</th>
                  <th className="px-4 py-3 text-left font-semibold">Local</th>
                  <th className="px-4 py-3 text-right font-semibold">Honorário</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {empresas?.map(e => (
                  <tr key={e.id} className="hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/empresas/${e.id}`} className="block">
                        <p className="font-medium text-ink-900 hover:text-brand-700">{e.razao_social}</p>
                        {e.nome_fantasia && <p className="text-xs text-ink-500">{e.nome_fantasia}</p>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-500 font-mono text-xs">{e.cnpj ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-700 text-xs">{e.regime_tributario ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-700 text-xs">{[e.cidade, e.estado].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="px-4 py-3 text-right text-ink-900 font-medium">{brl(e.honorario_mensal_cents)}</td>
                    <td className="px-4 py-3">
                      <Pill className={e.status === 'ativa' ? 'bg-emerald-100 text-emerald-900 ring-emerald-300' : 'bg-ink-100 text-ink-700 ring-ink-200'}>
                        {e.status}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
