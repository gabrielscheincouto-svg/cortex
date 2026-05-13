import { ShieldAlert } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { Card, CardHeader, Empty, Pill, Stat } from '@/components/ui'
import { dateBR } from '@/lib/utils'

const sev: Record<string, string> = {
  debug: 'bg-ink-100 text-ink-500 ring-ink-200',
  info: 'bg-blue-100 text-blue-900 ring-blue-300',
  aviso: 'bg-amber-100 text-amber-900 ring-amber-300',
  erro: 'bg-rose-100 text-rose-900 ring-rose-300',
  critico: 'bg-rose-600 text-white ring-rose-600',
}

export default async function AuditoriaPage({ searchParams }: { searchParams: { severidade?: string; acao?: string } }) {
  const supabase = createServerClient()
  let query = supabase.from('audit_log').select('id, org_id, user_email, acao, entidade_tipo, descricao, severidade, created_at, orgs(nome)').order('created_at', { ascending: false }).limit(100)
  if (searchParams.severidade) query = query.eq('severidade', searchParams.severidade)
  if (searchParams.acao) query = query.eq('acao', searchParams.acao)
  const { data } = await query
  const criticos = data?.filter(a => ['erro', 'critico'].includes(a.severidade)).length ?? 0

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold text-ink-900">Auditoria</h1><p className="mt-1 text-sm text-ink-500">Ações sensíveis registradas na plataforma.</p></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Stat label="Eventos" value={(data?.length ?? 0).toString()} sub="Últimos 100" accent="brand" /><Stat label="Erros/críticos" value={criticos.toString()} sub="Na listagem" accent="rose" /><Stat label="Filtro" value={searchParams.severidade ?? searchParams.acao ?? 'Todos'} sub="Atual" /></div>
      <Card>
        <CardHeader title="Audit log" subtitle="Filtros via ?acao= e ?severidade=" />
        {!data || data.length === 0 ? <Empty icon={ShieldAlert} title="Nenhum evento" description="A auditoria aparecerá aqui quando houver registros." /> : (
          <div className="overflow-hidden rounded-lg border border-black/10"><table className="w-full text-sm"><tbody className="divide-y divide-black/10">
            {data.map(a => {
              const org = Array.isArray((a as any).orgs) ? (a as any).orgs[0] : (a as any).orgs
              return <tr key={a.id}><td className="px-4 py-3"><p className="font-medium text-ink-900">{a.descricao ?? a.acao}</p><p className="text-xs text-ink-500">{org?.nome ?? 'Global'} · {a.user_email ?? 'sistema'}</p></td><td className="px-4 py-3 text-ink-600">{a.entidade_tipo ?? '—'}</td><td className="px-4 py-3"><Pill className={sev[a.severidade] ?? sev.info}>{a.severidade}</Pill></td><td className="px-4 py-3 text-right text-xs text-ink-500">{dateBR(a.created_at)}</td></tr>
            })}
          </tbody></table></div>
        )}
      </Card>
    </div>
  )
}
