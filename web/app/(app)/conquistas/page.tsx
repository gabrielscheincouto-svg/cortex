import { Award, Medal, ShieldCheck, Star, Trophy } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, Empty, Pill, Stat } from '@/components/ui'
import { dateBR } from '@/lib/utils'

const nivelPill: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-900 ring-amber-300',
  prata: 'bg-ink-100 text-ink-700 ring-ink-200',
  ouro: 'bg-gold-50 text-gold-700 ring-gold-100',
  platina: 'bg-blue-100 text-blue-900 ring-blue-300',
}

const nivelIcon: Record<string, any> = {
  bronze: Medal,
  prata: ShieldCheck,
  ouro: Trophy,
  platina: Star,
}

const nivelClasses: Record<string, string> = {
  bronze: 'bg-amber-50 text-amber-700',
  prata: 'bg-ink-100 text-ink-600',
  ouro: 'bg-gold-50 text-gold-700',
  platina: 'bg-blue-50 text-blue-700',
}

export default async function ConquistasPage() {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: catalogo }, { data: minhas }] = await Promise.all([
    supabase
      .from('conquistas_catalogo')
      .select('id, codigo, nome, descricao, icone, cor_ramp, nivel, pontos_bonus, criterio_codigo, publicada, ordem, org_id')
      .or(`org_id.is.null,org_id.eq.${ctx.org_id}`)
      .eq('publicada', true)
      .order('ordem')
      .order('nivel'),
    supabase
      .from('conquistas_usuario')
      .select('conquista_id, desbloqueada_em, payload')
      .eq('org_id', ctx.org_id)
      .eq('user_id', user.id),
  ])

  const unlocked = new Map((minhas ?? []).map(c => [c.conquista_id, c]))
  const total = catalogo?.length ?? 0
  const totalUnlocked = (catalogo ?? []).filter(c => unlocked.has(c.id)).length
  const pontosBonus = (catalogo ?? []).filter(c => unlocked.has(c.id)).reduce((acc, c) => acc + Number(c.pontos_bonus ?? 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Conquistas</h1>
        <p className="mt-1 text-sm text-ink-500">Você desbloqueou {totalUnlocked} de {total} conquistas disponíveis.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Desbloqueadas" value={`${totalUnlocked}/${total}`} sub="Catálogo ativo" accent="gold" />
        <Stat label="Pontos bônus" value={pontosBonus.toLocaleString('pt-BR')} sub="Conquistas obtidas" />
        <Stat label="Próximas" value={Math.max(total - totalUnlocked, 0).toString()} sub="Progresso inicial" accent="brand" />
        <Stat label="Nível mais alto" value={nivelMaisAlto(catalogo ?? [], unlocked) ?? '—'} sub="Na vitrine atual" />
      </div>

      {!catalogo || catalogo.length === 0 ? (
        <Card>
          <Empty icon={Award} title="Nenhuma conquista publicada" description="Quando o catálogo global ou da org tiver conquistas, elas aparecerão aqui." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalogo.map(conquista => {
            const obtida = unlocked.get(conquista.id)
            const Icon = nivelIcon[conquista.nivel] ?? Award
            return (
              <Card key={conquista.id} className={obtida ? 'border-emerald-200 ring-1 ring-emerald-100' : ''}>
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${nivelClasses[conquista.nivel] ?? 'bg-ink-100 text-ink-600'}`}>
                    <Icon size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-ink-900">{conquista.nome}</h2>
                      <Pill className={nivelPill[conquista.nivel] ?? 'bg-ink-100 text-ink-700 ring-ink-200'}>{nivelLabel(conquista.nivel)}</Pill>
                    </div>
                    <p className="text-sm leading-6 text-ink-600">{conquista.descricao}</p>
                    <p className="mt-3 text-xs text-ink-500">{conquista.pontos_bonus} pontos bônus</p>
                  </div>
                </div>

                {obtida ? (
                  <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    Desbloqueada em {dateBR(obtida.desbloqueada_em)}
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-ink-500">
                      <span>Progresso</span>
                      <span>0%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-gold-500" style={{ width: '0%' }} />
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function nivelLabel(nivel: string) {
  return {
    bronze: 'Bronze',
    prata: 'Prata',
    ouro: 'Ouro',
    platina: 'Platina',
  }[nivel] ?? nivel
}

function nivelMaisAlto(catalogo: any[], unlocked: Map<string, any>) {
  const ordem = ['bronze', 'prata', 'ouro', 'platina']
  const niveis = catalogo.filter(c => unlocked.has(c.id)).map(c => c.nivel)
  const melhor = niveis.sort((a, b) => ordem.indexOf(b) - ordem.indexOf(a))[0]
  return melhor ? nivelLabel(melhor) : null
}
