import Link from 'next/link'
import { Plus, Building2, Search } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { Card, Button, Input, Pill, Empty } from '@/components/ui'
import { dateBR, orgStatusBadge } from '@/lib/utils'

type SearchParams = { q?: string }

export default async function EscritoriosPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createServerClient()
  const q = searchParams.q?.trim()

  let query = supabase
    .from('orgs')
    .select('id, slug, nome, cnpj, status, created_at, plano_id, planos(nome,codigo)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (q) {
    query = query.or(`nome.ilike.%${q}%,cnpj.ilike.%${q}%,slug.ilike.%${q}%`)
  }

  const { data: orgs, error } = await query

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Escritórios</h1>
          <p className="mt-1 text-sm text-ink-500">Todos os tenants do SaaS — clique para abrir o detalhe.</p>
        </div>
        <Link href="/escritorios/novo">
          <Button variant="primary" icon={Plus}>Novo escritório</Button>
        </Link>
      </div>

      <Card>
        <form className="mb-4 flex gap-2" action="/escritorios" method="GET">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-ink-400" />
            <Input name="q" placeholder="Buscar por nome, slug ou CNPJ" defaultValue={q ?? ''} className="pl-9" />
          </div>
          <Button type="submit" variant="secondary">Buscar</Button>
        </form>

        {error && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
            Erro carregando: {error.message}
          </p>
        )}

        {!error && (!orgs || orgs.length === 0) ? (
          <Empty
            icon={Building2}
            title={q ? 'Nenhum escritório encontrado' : 'Ainda não há escritórios cadastrados'}
            description={q ? 'Tente outros termos de busca' : 'Crie o primeiro para começar a usar a plataforma.'}
            action={!q && <Link href="/escritorios/novo"><Button variant="primary" icon={Plus}>Criar primeiro</Button></Link>}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Nome</th>
                  <th className="px-4 py-3 text-left font-semibold">Slug</th>
                  <th className="px-4 py-3 text-left font-semibold">CNPJ</th>
                  <th className="px-4 py-3 text-left font-semibold">Plano</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Criado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {orgs?.map(org => {
                  const badge = orgStatusBadge(org.status)
                  const plano = Array.isArray(org.planos) ? org.planos[0] : org.planos
                  return (
                    <tr key={org.id} className="hover:bg-ink-50/60">
                      <td className="px-4 py-3">
                        <Link href={`/escritorios/${org.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                          {org.nome}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-500 font-mono text-xs">{org.slug}</td>
                      <td className="px-4 py-3 text-ink-500 font-mono text-xs">{org.cnpj ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-700">{plano?.nome ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Pill className={badge.classes}>{badge.label}</Pill>
                      </td>
                      <td className="px-4 py-3 text-ink-500 text-xs">{dateBR(org.created_at)}</td>
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
