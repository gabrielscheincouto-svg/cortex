import { Bot } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { Card, CardHeader, Empty, Pill, Stat } from '@/components/ui'
import { ago, dateBR } from '@/lib/utils'

export default async function RobosPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createServerClient()
  const { data: hosts } = await supabase
    .from('robo_hosts')
    .select('id, hostname, sistema_operacional, versao_app, ultimo_heartbeat_at, arquivos_enviados, ativo, orgs(nome)')
    .order('ultimo_heartbeat_at', { ascending: false })
    .limit(150)
  const filtrados = (hosts ?? []).filter(h => searchParams.status === 'offline' ? !isOnline(h.ultimo_heartbeat_at) : searchParams.status === 'online' ? isOnline(h.ultimo_heartbeat_at) : true)
  const online = (hosts ?? []).filter(h => isOnline(h.ultimo_heartbeat_at)).length

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold text-ink-900">Robôs</h1><p className="mt-1 text-sm text-ink-500">Hosts Tauri ativos e últimos arquivos enviados.</p></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Stat label="Hosts" value={(hosts?.length ?? 0).toString()} sub="Registrados" accent="brand" /><Stat label="Online" value={online.toString()} sub="Heartbeat 5 min" accent="gold" /><Stat label="Arquivos" value={(hosts ?? []).reduce((a, h) => a + Number(h.arquivos_enviados ?? 0), 0).toString()} sub="Total reportado" /></div>
      <Card>
        <CardHeader title="Hosts Tauri" subtitle="Use ?status=online ou ?status=offline para filtrar" />
        {filtrados.length === 0 ? <Empty icon={Bot} title="Nenhum robô encontrado" description="Quando um host fizer heartbeat, ele aparece aqui." /> : (
          <div className="overflow-hidden rounded-lg border border-black/10"><table className="w-full text-sm"><tbody className="divide-y divide-black/10">
            {filtrados.map(h => {
              const org = Array.isArray((h as any).orgs) ? (h as any).orgs[0] : (h as any).orgs
              return <tr key={h.id}><td className="px-4 py-3"><p className="font-medium text-ink-900">{h.hostname}</p><p className="text-xs text-ink-500">{org?.nome ?? '—'}</p></td><td className="px-4 py-3 text-ink-500">{h.sistema_operacional ?? '—'} · {h.versao_app ?? 'sem versão'}</td><td className="px-4 py-3"><Pill className={isOnline(h.ultimo_heartbeat_at) ? 'bg-emerald-100 text-emerald-900 ring-emerald-300' : 'bg-ink-100 text-ink-500 ring-ink-200'}>{isOnline(h.ultimo_heartbeat_at) ? 'Online' : 'Offline'}</Pill></td><td className="px-4 py-3 text-right text-xs text-ink-500">{h.ultimo_heartbeat_at ? `${ago(h.ultimo_heartbeat_at)} · ${dateBR(h.ultimo_heartbeat_at)}` : '—'}</td></tr>
            })}
          </tbody></table></div>
        )}
      </Card>
    </div>
  )
}

function isOnline(iso?: string | null) {
  return iso ? Date.now() - new Date(iso).getTime() < 5 * 60_000 : false
}
