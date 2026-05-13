import Link from 'next/link'
import { Search, ClipboardCheck, AlertTriangle, Calendar } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, Input, Button, Pill, Empty } from '@/components/ui'
import { dateBR, entregaStatusBadge, departamentoLabel } from '@/lib/utils'

interface SP {
  status?: string
  dept?: string
  competencia?: string
  q?: string
}

export default async function EntregasPage({ searchParams }: { searchParams: SP }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  // monta a query com filtros
  let qy = supabase
    .from('entregas')
    .select(`
      id, competencia, prazo_legal, prazo_tecnico, status, departamento,
      responsavel_id, co_responsavel_id, entregue_em, protocolo, multa_aplicada,
      empresas(razao_social, nome_fantasia, cnpj),
      obrigacoes_catalogo(nome, codigo),
      profiles!responsavel_id(nome),
      co:profiles!co_responsavel_id(nome)
    `)
    .eq('org_id', ctx.org_id)
    .order('prazo_legal', { ascending: true })
    .limit(100)

  if (searchParams.status && searchParams.status !== 'todos') {
    qy = qy.eq('status', searchParams.status)
  }
  if (searchParams.dept && searchParams.dept !== 'todos') {
    qy = qy.eq('departamento', searchParams.dept)
  }
  if (searchParams.competencia) {
    qy = qy.eq('competencia', searchParams.competencia)
  }

  const { data: entregas, error } = await qy

  // contadores rápidos por status (para os tabs)
  const { data: counts } = await supabase
    .from('entregas')
    .select('status')
    .eq('org_id', ctx.org_id)

  const tabCounts = (counts ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  const tabs = [
    { key: 'pendente',           label: 'Pendentes' },
    { key: 'em_andamento',       label: 'Em andamento' },
    { key: 'aguardando_cliente', label: 'Aguardando cliente' },
    { key: 'atrasada',           label: 'Atrasadas' },
    { key: 'entregue',           label: 'Entregues' },
    { key: 'todos',              label: 'Todas' },
  ]
  const statusAtivo = searchParams.status ?? 'todos'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Lista de entregas</h1>
        <p className="mt-1 text-sm text-ink-500">
          {entregas?.length ?? 0} entrega{entregas?.length === 1 ? '' : 's'} {searchParams.status ? `com status "${entregaStatusBadge(searchParams.status).label.toLowerCase()}"` : ''}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(t => {
          const active = t.key === statusAtivo
          const params = new URLSearchParams({ ...(searchParams as any), status: t.key })
          return (
            <Link
              key={t.key}
              href={`/entregas?${params.toString()}`}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ring-inset transition-colors ${
                active ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-700 ring-black/10 hover:bg-ink-50'
              }`}
            >
              {t.label}
              {t.key !== 'todos' && (
                <span className={active ? 'text-white/70' : 'text-ink-400'}>{tabCounts[t.key] ?? 0}</span>
              )}
            </Link>
          )
        })}
      </div>

      <Card>
        <form className="mb-4 flex flex-wrap gap-2" action="/entregas" method="GET">
          {searchParams.status && <input type="hidden" name="status" value={searchParams.status} />}
          <div className="relative flex-1 min-w-[260px]">
            <Search size={16} className="absolute left-3 top-2.5 text-ink-400" />
            <Input name="q" placeholder="Buscar empresa, CNPJ ou obrigação" defaultValue={searchParams.q ?? ''} className="pl-9" />
          </div>
          <select
            name="dept"
            defaultValue={searchParams.dept ?? 'todos'}
            className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="todos">Todos os deptos</option>
            <option value="contabil">Contábil</option>
            <option value="fiscal">Fiscal</option>
            <option value="pessoal">Pessoal</option>
            <option value="societario">Societário</option>
            <option value="comercial">Comercial</option>
            <option value="rural">Rural</option>
          </select>
          <Input name="competencia" placeholder="Competência (yyyy-mm)" defaultValue={searchParams.competencia ?? ''} className="w-44" />
          <Button type="submit" variant="primary">Filtrar</Button>
        </form>

        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">Erro: {error.message}</p>}

        {!error && (!entregas || entregas.length === 0) ? (
          <Empty
            icon={ClipboardCheck}
            title="Nenhuma entrega encontrada"
            description={statusAtivo === 'todos' ? 'Cadastre obrigações e empresas para gerar entregas automaticamente.' : 'Tente outro filtro.'}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Obrigação / empresa</th>
                  <th className="px-4 py-3 text-left font-semibold">Depto</th>
                  <th className="px-4 py-3 text-left font-semibold">Competência</th>
                  <th className="px-4 py-3 text-left font-semibold">Prazo legal</th>
                  <th className="px-4 py-3 text-left font-semibold">Responsável</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {entregas?.map(e => {
                  const emp = Array.isArray(e.empresas) ? e.empresas[0] : (e as any).empresas
                  const obr = Array.isArray(e.obrigacoes_catalogo) ? e.obrigacoes_catalogo[0] : (e as any).obrigacoes_catalogo
                  const resp = Array.isArray(e.profiles) ? e.profiles[0] : (e as any).profiles
                  const co = Array.isArray((e as any).co) ? (e as any).co[0] : (e as any).co
                  const badge = entregaStatusBadge(e.status)
                  const prazoVencido = new Date(e.prazo_legal) < new Date() && !['entregue','justificada','dispensada'].includes(e.status)
                  return (
                    <tr key={e.id} className="hover:bg-ink-50/60">
                      <td className="px-4 py-3">
                        <Link href={`/entregas/${e.id}`} className="block">
                          <p className="font-medium text-ink-900 hover:text-brand-700">{obr?.nome ?? '—'}</p>
                          <p className="text-xs text-ink-500">{emp?.razao_social ?? '—'}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-700">{departamentoLabel(e.departamento)}</td>
                      <td className="px-4 py-3 text-ink-500 font-mono text-xs">{e.competencia}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 text-xs ${prazoVencido ? 'text-rose-700 font-medium' : 'text-ink-700'}`}>
                          {prazoVencido && <AlertTriangle size={12} />}
                          {dateBR(e.prazo_legal)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-700 text-xs">
                        <div>{resp?.nome ?? <span className="text-ink-400">sem responsável</span>}</div>
                        {co?.nome && <div className="text-ink-400">Aux: {co.nome}</div>}
                      </td>
                      <td className="px-4 py-3"><Pill className={badge.classes}>{badge.label}</Pill></td>
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
