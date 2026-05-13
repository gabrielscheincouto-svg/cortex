'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { apiBrowser, type Balancete, type BalanceteConta, type BalanceteComparativoLinha } from '@/lib/api'
import { calcularIndicadores } from '@/lib/balancete'
import { Button, Input, Pill, Stat } from '@/components/ui'
import { brl } from '@/lib/utils'

function pct(v?: number) {
  if (v == null || Number.isNaN(v)) return '-'
  return `${(v * 100).toFixed(1)}%`
}

function mesAnterior(competencia: string) {
  const [ano, mes] = competencia.split('-').map(Number)
  const data = new Date(ano, mes - 2, 1)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

export function BalanceteEmpresaClient({
  token, empresaId, balancetes, contasPorBalancete,
}: {
  token: string
  empresaId: string
  balancetes: Balancete[]
  contasPorBalancete: Record<string, BalanceteConta[]>
}) {
  const router = useRouter()
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7))
  const [comparativo, setComparativo] = useState<BalanceteComparativoLinha[]>([])
  const atual = balancetes[0]
  const indicadores = useMemo(() => calcularIndicadores(atual ? (contasPorBalancete[atual.id] ?? []) : []), [atual, contasPorBalancete])

  async function criar() {
    if (!competencia) return
    await apiBrowser(token).createBalancete({ empresa_id: empresaId, competencia })
    router.refresh()
  }

  async function carregarComparativo(baseCompetencia: string) {
    const anterior = mesAnterior(baseCompetencia)
    const data = await apiBrowser(token).getBalanceteComparativo(empresaId, [anterior, baseCompetencia])
    setComparativo(data.linhas)
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <Stat label="Liquidez corrente" value={indicadores.liquidezCorrente.toFixed(2)} sub="AC / PC" accent="brand" />
        <Stat label="Endividamento" value={pct(indicadores.endividamento)} sub="PC + PNC / ativo total" accent="rose" />
        <Stat label="Margem líquida" value={pct(indicadores.margemLiquida)} sub="Resultado / receita bruta" accent="gold" />
        <Stat label="Resultado" value={brl(Math.round(indicadores.resultado * 100))} sub="DRE classificado" />
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Linha do tempo</h2>
            <p className="mt-1 text-sm text-ink-500">Últimos 12 meses com status e volume de contas.</p>
          </div>
          <div className="flex gap-2">
            <Input type="month" value={competencia} onChange={event => setCompetencia(event.target.value)} className="w-40" />
            <Button type="button" variant="primary" icon={Plus} onClick={() => void criar()}>Criar</Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {balancetes.map(b => (
            <Link key={b.id} href={`/balancete/${empresaId}/${b.competencia}`} className="rounded-lg border border-black/10 p-3 transition hover:bg-ink-50">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-ink-900">{b.competencia}</p>
                <Pill className={b.fechado ? 'bg-emerald-100 text-emerald-900 ring-emerald-300' : 'bg-amber-100 text-amber-900 ring-amber-300'}>
                  {b.fechado ? 'Fechado' : 'Aberto'}
                </Pill>
              </div>
              <p className="mt-2 text-xs text-ink-500">{b.contas_count} conta{b.contas_count === 1 ? '' : 's'}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Comparativo mês a mês</h2>
            <p className="mt-1 text-sm text-ink-500">Variações acima de 20% ficam destacadas.</p>
          </div>
          {atual && <Button type="button" onClick={() => void carregarComparativo(atual.competencia)}>Comparar {mesAnterior(atual.competencia)} × {atual.competencia}</Button>}
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-black/10">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-3 py-2 text-left">Conta</th>
                <th className="px-3 py-2 text-right">Variação</th>
                <th className="px-3 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {comparativo.slice(0, 80).map(linha => {
                const forte = Math.abs(linha.variacao_perc ?? 0) > 0.2
                return (
                  <tr key={linha.codigo} className={forte ? (linha.variacao > 0 ? 'bg-emerald-50' : 'bg-rose-50') : undefined}>
                    <td className="px-3 py-2"><span className="font-mono text-xs text-ink-500">{linha.codigo}</span> {linha.descricao}</td>
                    <td className="px-3 py-2 text-right font-medium">{brl(Math.round(linha.variacao * 100))}</td>
                    <td className="px-3 py-2 text-right">{pct(linha.variacao_perc)}</td>
                  </tr>
                )
              })}
              {comparativo.length === 0 && <tr><td colSpan={3} className="px-3 py-8 text-center text-sm text-ink-500">Selecione um mês para Cortex comparar os saldos.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
