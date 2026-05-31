import { BookOpen } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { Card, CardHeader, Empty, Pill, Stat } from '@/components/ui'

export default async function CatalogoGlobalPage() {
  const supabase = createServerClient()
  const { data: obrigacoes } = await supabase
    .from('obrigacoes_catalogo')
    .select('id, codigo, nome, departamento, periodicidade, dia_legal, robo_processa, ativa, publicada')
    .is('org_id', null)
    .order('departamento')
    .order('nome')

  const total = obrigacoes?.length ?? 0
  const publicadas = obrigacoes?.filter(o => o.publicada).length ?? 0
  const robo = obrigacoes?.filter(o => o.robo_processa).length ?? 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Catálogo global</h1>
        <p className="mt-1 text-sm text-ink-500">Obrigações mantidas pelo Cortex e herdadas pelos escritórios.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Obrigações" value={total.toString()} sub="Globais" accent="brand" />
        <Stat label="Publicadas" value={publicadas.toString()} sub="Disponíveis para herança" accent="gold" />
        <Stat label="Robô processa" value={robo.toString()} sub="Elegíveis ao Tauri" />
      </div>

      <Card>
        <CardHeader title="Obrigatórias globais" subtitle="Itens com org_id vazio" />
        {!obrigacoes || obrigacoes.length === 0 ? (
          <Empty icon={BookOpen} title="Nenhuma obrigação global" description="Cadastre o catálogo inicial via seed ou API administrativa." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Obrigação</th>
                  <th className="px-4 py-3 text-left font-semibold">Depto</th>
                  <th className="px-4 py-3 text-left font-semibold">Periodicidade</th>
                  <th className="px-4 py-3 text-left font-semibold">Dia legal</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {obrigacoes.map(o => (
                  <tr key={o.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900">{o.nome}</p>
                      <p className="text-xs text-ink-500">{o.codigo}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{o.departamento}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{o.periodicidade}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{o.dia_legal ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Pill className={o.ativa ? 'bg-emerald-100 text-emerald-900 ring-emerald-300' : 'bg-ink-100 text-ink-500 ring-ink-200'}>{o.ativa ? 'Ativa' : 'Inativa'}</Pill>
                        <Pill className={o.publicada ? 'bg-blue-100 text-blue-900 ring-blue-300' : 'bg-ink-100 text-ink-500 ring-ink-200'}>{o.publicada ? 'Publicada' : 'Rascunho'}</Pill>
                      </div>
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
