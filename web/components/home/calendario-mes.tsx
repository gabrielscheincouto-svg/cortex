/**
 * Calendário do mês com marcadores de entregas (paridade legado).
 *
 * Cada dia mostra até 4 bolinhas coloridas que representam status de entregas:
 *   vermelho  → atrasada
 *   amarelo   → prazo hoje
 *   verde     → entregue / no prazo
 *   azul      → pendente
 *   roxo      → suspensa / informação
 *
 * Dia atual destacado em violeta cheio. Domingos em ink-400.
 * Click no dia → filtra entregas em /entregas?data=YYYY-MM-DD.
 */
'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export type DiaEntregas = {
  data: string         // 'YYYY-MM-DD'
  atrasadas: number
  hoje: number
  no_prazo: number
  pendentes: number
  outras: number
}

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_PT  = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB']

export function CalendarioMes({
  ano, mes, diasComDados,
}: {
  ano: number
  mes: number         // 1-12
  diasComDados: DiaEntregas[]
}) {
  const primeiro = new Date(ano, mes - 1, 1)
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const diaInicial = primeiro.getDay() // 0..6
  const hoje = new Date()
  const ehMesAtual = hoje.getFullYear() === ano && hoje.getMonth() === mes - 1
  const diaHoje = ehMesAtual ? hoje.getDate() : -1

  const mapa = new Map(diasComDados.map(d => [d.data, d]))

  // Monta grid: começa em domingo
  const cells: (number | null)[] = []
  for (let i = 0; i < diaInicial; i++) cells.push(null)
  for (let d = 1; d <= ultimoDia; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-lg font-semibold text-ink-900">
          {MESES_PT[mes - 1]} {ano}
        </h3>
        <div className="flex items-center gap-2 text-[10px] text-ink-500">
          <Bolinha cor="bg-rose-500"   label="Atrasada" />
          <Bolinha cor="bg-amber-500"  label="Hoje" />
          <Bolinha cor="bg-emerald-500" label="No prazo" />
          <Bolinha cor="bg-sky-500"    label="Pendente" />
          <Bolinha cor="bg-mind-500"   label="Outras" />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS_PT.map(d => (
          <div key={d} className="pb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {d}
          </div>
        ))}

        {cells.map((dia, idx) => {
          if (dia === null) return <div key={idx} />
          const dataIso = `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
          const dados = mapa.get(dataIso)
          const ehHoje = dia === diaHoje
          const ehDomingo = idx % 7 === 0

          return (
            <Link
              key={idx}
              href={`/entregas?data=${dataIso}`}
              prefetch={false}
              className={cn(
                'group relative flex h-14 flex-col items-center justify-center rounded-lg text-sm transition-colors',
                ehHoje
                  ? 'bg-mind-500 font-semibold text-white hover:bg-mind-600'
                  : ehDomingo
                    ? 'text-ink-400 hover:bg-ink-50'
                    : 'text-ink-700 hover:bg-ink-50'
              )}
            >
              <span>{dia}</span>
              {dados && (
                <div className="absolute bottom-1.5 flex gap-0.5">
                  {dados.atrasadas > 0 && <Dot color="bg-rose-500"   ehHoje={ehHoje} />}
                  {dados.hoje      > 0 && <Dot color="bg-amber-500"  ehHoje={ehHoje} />}
                  {dados.no_prazo  > 0 && <Dot color="bg-emerald-500" ehHoje={ehHoje} />}
                  {dados.pendentes > 0 && <Dot color="bg-sky-500"    ehHoje={ehHoje} />}
                  {dados.outras    > 0 && <Dot color="bg-mind-500"   ehHoje={ehHoje} />}
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function Dot({ color, ehHoje }: { color: string; ehHoje: boolean }) {
  return <span className={cn('h-1.5 w-1.5 rounded-full', ehHoje ? 'bg-white/90' : color)} />
}

function Bolinha({ cor, label }: { cor: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('h-1.5 w-1.5 rounded-full', cor)} />
      <span>{label}</span>
    </span>
  )
}
