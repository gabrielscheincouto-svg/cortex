import { Award } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { Card, CardHeader, Empty, Pill, Stat } from '@/components/ui'

const nivelPill: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-900 ring-amber-300',
  prata: 'bg-ink-100 text-ink-700 ring-ink-200',
  ouro: 'bg-gold-50 text-gold-700 ring-gold-100',
  platina: 'bg-blue-100 text-blue-900 ring-blue-300',
}

export default async function ConquistasAdminPage() {
  const supabase = createServerClient()
  const { data: conquistas } = await supabase
    .from('conquistas_catalogo')
    .select('id, codigo, nome, descricao, nivel, pontos_bonus, criterio_codigo, publicada, ordem')
    .is('org_id', null)
    .order('ordem')

  const total = conquistas?.length ?? 0
  const publicadas = conquistas?.filter(c => c.publicada).length ?? 0
  const pontos = conquistas?.reduce((acc, c) => acc + Number(c.pontos_bonus ?? 0), 0) ?? 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Conquistas globais</h1>
        <p className="mt-1 text-sm text-ink-500">Catálogo base de gamificação para todos os escritórios.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Conquistas" value={total.toString()} sub="Globais" accent="brand" />
        <Stat label="Publicadas" value={publicadas.toString()} sub="Visíveis nas orgs" accent="gold" />
        <Stat label="Pontos bônus" value={pontos.toLocaleString('pt-BR')} sub="Soma do catálogo" />
      </div>
      <Card>
        <CardHeader title="Catálogo" subtitle="Itens globais com org_id vazio" />
        {!conquistas || conquistas.length === 0 ? (
          <Empty icon={Award} title="Nenhuma conquista global" description="Crie conquistas globais para habilitar a vitrine dos usuários." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-black/10">
                {conquistas.map(c => (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900">{c.nome}</p>
                      <p className="text-xs text-ink-500">{c.codigo} · {c.criterio_codigo}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{c.pontos_bonus} pts</td>
                    <td className="px-4 py-3"><Pill className={nivelPill[c.nivel] ?? 'bg-ink-100 text-ink-700 ring-ink-200'}>{c.nivel}</Pill></td>
                    <td className="px-4 py-3"><Pill className={c.publicada ? 'bg-emerald-100 text-emerald-900 ring-emerald-300' : 'bg-ink-100 text-ink-500 ring-ink-200'}>{c.publicada ? 'Publicada' : 'Rascunho'}</Pill></td>
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
