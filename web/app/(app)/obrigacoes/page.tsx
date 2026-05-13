import Link from 'next/link'
import { BookOpen, Plus } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, CardHeader, Empty, Pill } from '@/components/ui'
import { departamentoLabel } from '@/lib/utils'
import { HerdarObrigacaoButton } from './actions'

export default async function ObrigacoesPage() {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  const [{ data: obrigacoes }, { data: globais }, { data: vinculos }] = await Promise.all([
    supabase
      .from('obrigacoes_catalogo')
      .select('id, codigo, nome, departamento, periodicidade, dia_legal, ativa, publicada')
      .eq('org_id', ctx.org_id)
      .order('departamento')
      .order('nome'),
    supabase
      .from('obrigacoes_catalogo')
      .select('id, codigo, nome, departamento, periodicidade, dia_legal')
      .is('org_id', null)
      .eq('publicada', true)
      .order('nome'),
    supabase
      .from('obrigacao_empresa')
      .select('id, obrigacao_id')
      .eq('org_id', ctx.org_id)
      .eq('ativa', true),
  ])

  const countPorObrigacao = (vinculos ?? []).reduce<Record<string, number>>((acc, v) => {
    acc[v.obrigacao_id] = (acc[v.obrigacao_id] ?? 0) + 1
    return acc
  }, {})
  const codigosLocais = new Set((obrigacoes ?? []).map(o => String(o.codigo).toLowerCase()))
  const globaisDisponiveis = (globais ?? []).filter(g => !codigosLocais.has(String(g.codigo).toLowerCase()))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Obrigações</h1>
        <p className="mt-1 text-sm text-ink-500">Catálogo da org e vínculos com empresas atendidas.</p>
      </div>

      <Card>
        <CardHeader title="Catálogo da org" subtitle={`${obrigacoes?.length ?? 0} obrigação${obrigacoes?.length === 1 ? '' : 'ões'} cadastrada${obrigacoes?.length === 1 ? '' : 's'}`} icon={BookOpen} />
        {!obrigacoes || obrigacoes.length === 0 ? (
          <Empty icon={BookOpen} title="Nenhuma obrigação local" description="Adicione obrigações do catálogo global para começar." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Obrigação</th>
                  <th className="px-4 py-3 text-left font-semibold">Depto</th>
                  <th className="px-4 py-3 text-left font-semibold">Periodicidade</th>
                  <th className="px-4 py-3 text-left font-semibold">Dia legal</th>
                  <th className="px-4 py-3 text-right font-semibold">Empresas</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {obrigacoes.map(o => (
                  <tr key={o.id} className="hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/obrigacoes/${o.id}`} className="block">
                        <p className="font-medium text-ink-900 hover:text-brand-700">{o.nome}</p>
                        <p className="text-xs text-ink-500">{o.codigo}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{departamentoLabel(o.departamento)}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{o.periodicidade.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{o.dia_legal ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-ink-900">{countPorObrigacao[o.id] ?? 0}</td>
                    <td className="px-4 py-3">
                      <Pill className={o.ativa ? 'bg-emerald-100 text-emerald-900 ring-emerald-300' : 'bg-ink-100 text-ink-500 ring-ink-200'}>
                        {o.ativa ? 'Ativa' : 'Inativa'}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Adicionar do catálogo global" subtitle="Obrigações publicadas pelo Cortex ainda não herdadas pela org" icon={Plus} />
        {globaisDisponiveis.length === 0 ? (
          <p className="text-sm text-ink-400">Todas as obrigações globais publicadas já foram adicionadas.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {globaisDisponiveis.map(o => (
              <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-black/10 p-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{o.nome}</p>
                  <p className="text-xs text-ink-500">{departamentoLabel(o.departamento)} · {o.periodicidade.replace('_', ' ')}</p>
                </div>
                <HerdarObrigacaoButton token={session.access_token} obrigacaoId={o.id} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
