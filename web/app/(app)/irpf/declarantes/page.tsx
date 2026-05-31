import Link from 'next/link'
import { Users, Search, ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, Input, Button, Empty, Avatar } from '@/components/ui'
import { dateBR } from '@/lib/utils'
import { formatCPF } from '@/lib/irpf'
import { NovoDeclaranteButton } from './actions'

export default async function IrpfDeclarantesPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const q = searchParams.q?.trim()
  let qry = supabase
    .from('irpf_declarantes')
    .select('id, cpf, nome_completo, email, telefone, data_nascimento, created_at, updated_at')
    .eq('org_id', ctx.org_id)
    .order('nome_completo')
    .limit(200)

  if (q) {
    qry = qry.or(`nome_completo.ilike.%${q}%,cpf.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data: declarantes, error } = await qry

  return (
    <div className="space-y-5">
      <Link href="/irpf" className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Voltar para IRPF
      </Link>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Declarantes</h1>
          <p className="mt-1 text-sm text-ink-500">
            {declarantes?.length ?? 0} pessoa{declarantes?.length === 1 ? '' : 's'} física{declarantes?.length === 1 ? '' : 's'} cadastrada{declarantes?.length === 1 ? '' : 's'}.
          </p>
        </div>
        <NovoDeclaranteButton />
      </div>

      <Card>
        <form className="mb-4 flex gap-2" action="/irpf/declarantes" method="GET">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-ink-400" />
            <Input name="q" placeholder="Buscar por nome, CPF ou email" defaultValue={q ?? ''} className="pl-9" />
          </div>
          <Button type="submit" variant="secondary">Buscar</Button>
        </form>

        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">Erro: {error.message}</p>}

        {!error && (!declarantes || declarantes.length === 0) ? (
          <Empty
            icon={Users}
            title={q ? 'Nenhum declarante encontrado' : 'Ainda não há declarantes'}
            description={q ? 'Tente outros termos' : 'Cadastre o primeiro declarante para começar.'}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Nome</th>
                  <th className="px-4 py-3 text-left font-semibold">CPF</th>
                  <th className="px-4 py-3 text-left font-semibold">Contato</th>
                  <th className="px-4 py-3 text-left font-semibold">Nascimento</th>
                  <th className="px-4 py-3 text-left font-semibold">Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {declarantes?.map(d => (
                  <tr key={d.id} className="hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar nome={d.nome_completo} size="sm" />
                        <span className="font-medium text-ink-900">{d.nome_completo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-500 font-mono text-xs">{formatCPF(d.cpf)}</td>
                    <td className="px-4 py-3 text-xs text-ink-700">
                      {d.email ?? '—'}
                      {d.telefone && <div className="text-ink-500">{d.telefone}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">{d.data_nascimento ? dateBR(d.data_nascimento) : '—'}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{dateBR(d.created_at)}</td>
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
