import { Activity } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { Card, CardHeader, Empty, Stat } from '@/components/ui'
import { brl, dateBR } from '@/lib/utils'

export default async function TelemetriaPage() {
  const supabase = createServerClient()
  const { data } = await supabase.from('platform_telemetria_dia').select('*').order('data', { ascending: false }).limit(90)
  const atual = data?.[0]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Telemetria</h1>
        <p className="mt-1 text-sm text-ink-500">Histórico agregado da plataforma.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="MRR" value={atual ? brl(atual.mrr_total_cents) : '—'} sub="Snapshot mais recente" accent="brand" />
        <Stat label="Orgs ativas" value={atual?.orgs_ativas?.toString() ?? '—'} sub={atual ? dateBR(atual.data) : 'Sem dados'} />
        <Stat label="Entregas/dia" value={atual?.entregas_total_dia?.toString() ?? '—'} sub="Uso diário" accent="gold" />
        <Stat label="Robôs ativos" value={atual?.robos_ativos?.toString() ?? '—'} sub="Últimas 24h" />
      </div>
      <Card>
        <CardHeader title="Linha do tempo" subtitle="Últimos 90 snapshots" />
        {!data || data.length === 0 ? <Empty icon={Activity} title="Sem telemetria ainda" description="O job diário ainda não populou platform_telemetria_dia." /> : (
          <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm"><thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500"><tr><th className="px-4 py-3 text-left">Data</th><th className="px-4 py-3 text-right">MRR</th><th className="px-4 py-3 text-right">Signups</th><th className="px-4 py-3 text-right">Entregas</th><th className="px-4 py-3 text-right">Robôs</th></tr></thead><tbody className="divide-y divide-black/10">
              {data.map(r => <tr key={r.id}><td className="px-4 py-3">{dateBR(r.data)}</td><td className="px-4 py-3 text-right">{brl(r.mrr_total_cents)}</td><td className="px-4 py-3 text-right">{r.novos_signups_dia}</td><td className="px-4 py-3 text-right">{r.entregas_total_dia}</td><td className="px-4 py-3 text-right">{r.robos_ativos}</td></tr>)}
            </tbody></table>
          </div>
        )}
      </Card>
    </div>
  )
}
