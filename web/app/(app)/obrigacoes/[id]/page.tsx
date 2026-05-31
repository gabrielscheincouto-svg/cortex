import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, ClipboardList } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, CardHeader, Empty, Pill } from '@/components/ui'
import { departamentoLabel } from '@/lib/utils'
import { DesvincularButton, VincularEmpresaForm } from '../actions'

export default async function ObrigacaoDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  const { data: obrigacao } = await supabase
    .from('obrigacoes_catalogo')
    .select('id, codigo, nome, departamento, periodicidade, referencia_dia, dia_legal, ativa, descricao')
    .eq('org_id', ctx.org_id)
    .eq('id', params.id)
    .maybeSingle()

  if (!obrigacao) return notFound()

  const [{ data: vinculos }, { data: empresas }, { data: membros }] = await Promise.all([
    supabase
      .from('obrigacao_empresa')
      .select('id, empresa_id, responsavel_id, ativa, empresas(id, razao_social, cnpj), profiles!responsavel_id(id, nome, email)')
      .eq('org_id', ctx.org_id)
      .eq('obrigacao_id', obrigacao.id)
      .eq('ativa', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('empresas')
      .select('id, razao_social')
      .eq('org_id', ctx.org_id)
      .eq('status', 'ativa')
      .order('razao_social'),
    supabase
      .from('org_membros')
      .select('user_id, role')
      .eq('org_id', ctx.org_id)
      .eq('status', 'ativo'),
  ])

  const membroIds = Array.from(new Set((membros ?? []).map(m => m.user_id))) as string[]
  const { data: profiles } = membroIds.length
    ? await supabase.from('profiles').select('id, nome, email').in('id', membroIds)
    : { data: [] as any[] }
  const profileById = new Map((profiles ?? []).map(p => [p.id, p]))
  const empresasVinculadas = new Set((vinculos ?? []).map(v => v.empresa_id))
  const empresasDisponiveis = (empresas ?? [])
    .filter(e => !empresasVinculadas.has(e.id))
    .map(e => ({ id: e.id, nome: e.razao_social }))
  const responsaveis = (membros ?? []).map(m => {
    const profile = profileById.get(m.user_id)
    return { id: m.user_id, nome: profile?.nome || profile?.email || m.role }
  })

  return (
    <div className="space-y-5">
      <Link href="/obrigacoes" className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Voltar para obrigações
      </Link>

      <div>
        <div className="mb-2 flex flex-wrap gap-2">
          <Pill className="bg-ink-100 text-ink-700 ring-ink-200">{departamentoLabel(obrigacao.departamento)}</Pill>
          <Pill className={obrigacao.ativa ? 'bg-emerald-100 text-emerald-900 ring-emerald-300' : 'bg-ink-100 text-ink-500 ring-ink-200'}>
            {obrigacao.ativa ? 'Ativa' : 'Inativa'}
          </Pill>
        </div>
        <h1 className="text-2xl font-semibold text-ink-900">{obrigacao.nome}</h1>
        <p className="mt-1 text-sm text-ink-500">{obrigacao.codigo} · {obrigacao.periodicidade.replace('_', ' ')} · dia legal {obrigacao.dia_legal ?? '—'}</p>
      </div>

      <Card>
        <CardHeader title="Vincular empresa" subtitle="Adicione esta obrigação a uma empresa atendida" icon={Building2} />
        {empresasDisponiveis.length === 0 ? (
          <p className="text-sm text-ink-400">Todas as empresas ativas já estão vinculadas ou não há empresas cadastradas.</p>
        ) : (
          <VincularEmpresaForm token={session.access_token} obrigacaoId={obrigacao.id} empresas={empresasDisponiveis} responsaveis={responsaveis} />
        )}
      </Card>

      <Card>
        <CardHeader title="Empresas vinculadas" subtitle={`${vinculos?.length ?? 0} vínculo${vinculos?.length === 1 ? '' : 's'} ativo${vinculos?.length === 1 ? '' : 's'}`} icon={ClipboardList} />
        {!vinculos || vinculos.length === 0 ? (
          <Empty icon={ClipboardList} title="Nenhuma empresa vinculada" description="Use o formulário acima para vincular a primeira empresa." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Empresa</th>
                  <th className="px-4 py-3 text-left font-semibold">CNPJ</th>
                  <th className="px-4 py-3 text-left font-semibold">Responsável</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {vinculos.map(v => {
                  const empresa = Array.isArray((v as any).empresas) ? (v as any).empresas[0] : (v as any).empresas
                  const resp = Array.isArray((v as any).profiles) ? (v as any).profiles[0] : (v as any).profiles
                  return (
                    <tr key={v.id}>
                      <td className="px-4 py-3 font-medium text-ink-900">{empresa?.razao_social ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-500">{empresa?.cnpj ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-700">{resp?.nome ?? resp?.email ?? 'Sem responsável'}</td>
                      <td className="px-4 py-3 text-right">
                        <DesvincularButton token={session.access_token} vinculoId={v.id} />
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
