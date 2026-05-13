import { CreditCard } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { Card, CardHeader, Empty, Pill, Stat } from '@/components/ui'
import { brl, dateBR } from '@/lib/utils'

export default async function FaturamentoPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createServerClient()
  let query = supabase
    .from('assinaturas')
    .select('id, status, valor_mensal_cents, current_period_end, orgs(nome, slug), planos(nome, codigo)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (searchParams.status && searchParams.status !== 'todos') query = query.eq('status', searchParams.status)

  const [{ data: assinaturas }, { data: faturas }] = await Promise.all([
    query,
    supabase.from('faturas').select('id, valor_cents, status, vencimento, orgs(nome)').order('vencimento', { ascending: false }).limit(100),
  ])
  const mrr = (assinaturas ?? []).filter(a => ['ativa', 'trial', 'pendente_pagamento'].includes(a.status)).reduce((acc, a) => acc + Number(a.valor_mensal_cents ?? 0), 0)
  const abertas = faturas?.filter(f => ['aberta', 'atrasada'].includes(f.status)).length ?? 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Faturamento</h1>
        <p className="mt-1 text-sm text-ink-500">Assinaturas, faturas e MRR consolidado.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="MRR" value={brl(mrr)} sub="Assinaturas ativas/trial" accent="brand" />
        <Stat label="Assinaturas" value={(assinaturas?.length ?? 0).toString()} sub="Na listagem atual" />
        <Stat label="Faturas abertas" value={abertas.toString()} sub="Abertas ou atrasadas" accent="gold" />
      </div>
      <Card>
        <CardHeader title="Assinaturas" subtitle="Filtro por status via ?status=" />
        {!assinaturas || assinaturas.length === 0 ? <Empty icon={CreditCard} title="Nenhuma assinatura" description="Quando houver assinaturas, elas aparecem aqui." /> : (
          <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm"><tbody className="divide-y divide-black/10">
              {assinaturas.map(a => {
                const org = Array.isArray((a as any).orgs) ? (a as any).orgs[0] : (a as any).orgs
                const plano = Array.isArray((a as any).planos) ? (a as any).planos[0] : (a as any).planos
                return <tr key={a.id}><td className="px-4 py-3 font-medium text-ink-900">{org?.nome ?? '—'}</td><td className="px-4 py-3 text-ink-500">{plano?.nome ?? '—'}</td><td className="px-4 py-3">{brl(a.valor_mensal_cents)}</td><td className="px-4 py-3"><Pill className="bg-ink-100 text-ink-700 ring-ink-200">{a.status}</Pill></td><td className="px-4 py-3 text-right text-xs text-ink-500">{a.current_period_end ? dateBR(a.current_period_end) : '—'}</td></tr>
              })}
            </tbody></table>
          </div>
        )}
      </Card>
    </div>
  )
}
