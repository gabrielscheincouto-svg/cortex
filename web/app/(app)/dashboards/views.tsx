'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { Pill } from '@/components/ui'
import { departamentoLabel } from '@/lib/utils'

type Rel<T> = T | T[] | null

export interface DashboardData {
  entregas: any[];
  solicitacoes: any[];
  empresas: any[];
  tempos: any[];
  pontos: any[];
}

const tabs = [
  { key: 'prazos', label: 'Prazos' },
  { key: 'comunicacao', label: 'Comunicação' },
  { key: 'rentabilidade', label: 'Rentabilidade' },
  { key: 'produtividade', label: 'Produtividade' },
] as const

export function DashboardsClient({ data }: { data: DashboardData }) {
  const [tab, setTab] = useState<(typeof tabs)[number]['key']>('prazos')
  const computed = useMemo(() => buildData(data), [data])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1 text-xs ring-1 ring-inset transition-colors ${
              tab === t.key ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-700 ring-black/10 hover:bg-ink-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'prazos' && <PrazosView data={computed} />}
      {tab === 'comunicacao' && <ComunicacaoView data={computed} />}
      {tab === 'rentabilidade' && <RentabilidadeView data={computed} />}
      {tab === 'produtividade' && <ProdutividadeView data={computed} />}
    </div>
  )
}

function PrazosView({ data }: { data: ReturnType<typeof buildData> }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Panel title="Heatmap por departamento" subtitle="Quantidade de entregas por dia legal">
        <div className="space-y-2">
          {data.heatmap.map(row => (
            <div key={row.departamento} className="grid grid-cols-[110px_1fr] items-center gap-3 text-xs">
              <span className="text-ink-600">{departamentoLabel(row.departamento)}</span>
              <div className="grid grid-cols-10 gap-1">
                {row.dias.map(dia => (
                  <span
                    key={dia.dia}
                    title={`${dia.dia}: ${dia.total} entrega(s)`}
                    className="h-7 rounded border border-black/5 text-center leading-7 text-[10px] text-ink-700"
                    style={{ backgroundColor: `rgba(16, 185, 129, ${Math.min(0.12 + dia.total * 0.12, 0.85)})` }}
                  >
                    {dia.dia}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Obrigações com mais atraso" subtitle="Top 10 no período analisado">
        <ChartEmpty empty={data.atrasosPorObrigacao.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.atrasosPorObrigacao}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="atrasadas" fill="#E11D48" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartEmpty>
      </Panel>
    </div>
  )
}

function ComunicacaoView({ data }: { data: ReturnType<typeof buildData> }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Panel title="Resposta média por dia" subtitle="Horas entre abertura e primeira resposta">
        <ChartEmpty empty={data.respostaPorDia.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.respostaPorDia}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="horas" stroke="#0F766E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartEmpty>
      </Panel>
      <Panel title="Clientes em risco" subtitle="Abertas, atrasadas ou baixa avaliação">
        <TableEmpty empty={data.clientesRisco.length === 0}>
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-ink-500">
              <tr><th className="py-2 text-left">Cliente</th><th className="py-2 text-right">Risco</th><th className="py-2 text-right">Tickets</th></tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {data.clientesRisco.map(c => (
                <tr key={c.nome}><td className="py-2 text-ink-900">{c.nome}</td><td className="py-2 text-right"><Pill className="bg-rose-100 text-rose-900 ring-rose-300">{c.risco}</Pill></td><td className="py-2 text-right text-ink-500">{c.tickets}</td></tr>
              ))}
            </tbody>
          </table>
        </TableEmpty>
      </Panel>
    </div>
  )
}

function RentabilidadeView({ data }: { data: ReturnType<typeof buildData> }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Panel title="Margem estimada por empresa" subtitle="Honorário menos custo de tempo estimado">
        <ChartEmpty empty={data.margemEmpresas.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="honorario" name="Honorário" unit="R$" />
              <YAxis dataKey="margem" name="Margem" unit="R$" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={data.margemEmpresas} fill="#0C447C" />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartEmpty>
      </Panel>
      <Panel title="Ranking de margem" subtitle="Top empresas por margem estimada">
        <TableEmpty empty={data.margemEmpresas.length === 0}>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-black/5">
              {data.margemEmpresas.slice(0, 10).map(e => (
                <tr key={e.nome}><td className="py-2 text-ink-900">{e.nome}</td><td className="py-2 text-right text-ink-500">{money(e.margem)}</td></tr>
              ))}
            </tbody>
          </table>
        </TableEmpty>
      </Panel>
    </div>
  )
}

function ProdutividadeView({ data }: { data: ReturnType<typeof buildData> }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Panel title="Entregas por colaborador" subtitle="Responsáveis no período">
        <ChartEmpty empty={data.produtividade.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.produtividade}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="entregas" fill="#0C447C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pontos" fill="#D97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartEmpty>
      </Panel>
      <Panel title="Retrabalho estimado" subtitle="Entregas reabertas, justificadas ou atrasadas">
        <TableEmpty empty={data.retrabalho.length === 0}>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-black/5">
              {data.retrabalho.map(r => (
                <tr key={r.nome}><td className="py-2 text-ink-900">{r.nome}</td><td className="py-2 text-right text-ink-500">{r.taxa}%</td></tr>
              ))}
            </tbody>
          </table>
        </TableEmpty>
      </Panel>
    </div>
  )
}

function buildData(data: DashboardData) {
  const entregaNome = (e: any) => one(e.obrigacoes_catalogo)?.nome ?? 'Obrigação'
  const empresaNome = (e: any) => one(e.empresas)?.razao_social ?? 'Sem empresa'
  const respNome = (e: any) => one(e.profiles)?.nome ?? 'Sem responsável'

  const heatmap = ['contabil', 'fiscal', 'pessoal', 'societario', 'comercial', 'rural', 'paralegal', 'outro'].map(departamento => ({
    departamento,
    dias: Array.from({ length: 10 }).map((_, idx) => {
      const inicio = idx * 3 + 1
      const fim = idx === 9 ? 31 : inicio + 2
      return { dia: `${inicio}-${fim}`, total: data.entregas.filter(e => e.departamento === departamento && day(e.prazo_legal) >= inicio && day(e.prazo_legal) <= fim).length }
    }),
  }))

  const atrasosPorObrigacao = top(group(data.entregas.filter(e => isLate(e)), entregaNome), 10, 'atrasadas')
  const respostaPorDia = Object.values(data.solicitacoes.reduce<Record<string, { dia: string; total: number; count: number }>>((acc, s) => {
    if (!s.primeira_resposta_em) return acc
    const dia = String(s.created_at).slice(5, 10)
    const horas = (new Date(s.primeira_resposta_em).getTime() - new Date(s.created_at).getTime()) / 36e5
    acc[dia] = acc[dia] ?? { dia, total: 0, count: 0 }
    acc[dia].total += Math.max(horas, 0)
    acc[dia].count += 1
    return acc
  }, {})).map(r => ({ dia: r.dia, horas: Number((r.total / r.count).toFixed(1)) }))

  const clientesRisco = top(data.solicitacoes.reduce<Record<string, { nome: string; risco: number; tickets: number }>>((acc, s) => {
    const nome = one(s.empresas)?.razao_social ?? 'Sem empresa'
    acc[nome] = acc[nome] ?? { nome, risco: 0, tickets: 0 }
    acc[nome].tickets += 1
    acc[nome].risco += ['nova', 'em_atendimento', 'aguardando_cliente'].includes(s.status) ? 2 : 0
    acc[nome].risco += s.prioridade === 'muito_alta' ? 3 : s.prioridade === 'alta' ? 2 : 0
    acc[nome].risco += s.avaliacao_estrelas && s.avaliacao_estrelas <= 2 ? 4 : 0
    return acc
  }, {}), 10, 'risco')

  const tempoPorEmpresa = data.entregas.reduce<Record<string, number>>((acc, e) => {
    const nome = empresaNome(e)
    const estimado = Number(one(e.obrigacoes_catalogo)?.tempo_estimado_minutos ?? 30)
    acc[nome] = (acc[nome] ?? 0) + estimado
    return acc
  }, {})
  const margemEmpresas = data.empresas.map(e => {
    const custo = (tempoPorEmpresa[e.razao_social] ?? 0) * 1.2
    const honorario = Number(e.honorario_mensal_cents ?? 0) / 100
    return { nome: e.razao_social, honorario, margem: Number((honorario - custo).toFixed(0)) }
  }).sort((a, b) => b.margem - a.margem)

  const entregasPorResp = data.entregas.reduce<Record<string, { nome: string; entregas: number; pontos: number }>>((acc, e) => {
    const nome = respNome(e)
    acc[nome] = acc[nome] ?? { nome, entregas: 0, pontos: 0 }
    acc[nome].entregas += 1
    return acc
  }, {})
  data.pontos.forEach(p => {
    const nome = one(p.profiles)?.nome ?? 'Sem responsável'
    entregasPorResp[nome] = entregasPorResp[nome] ?? { nome, entregas: 0, pontos: 0 }
    entregasPorResp[nome].pontos += Number(p.pontos ?? 0)
  })
  const produtividade = top(entregasPorResp, 12, 'entregas')
  const retrabalho = produtividade.map(p => ({
    nome: p.nome,
    taxa: data.entregas.filter(e => respNome(e) === p.nome && ['atrasada', 'justificada'].includes(e.status)).length,
  })).map(r => ({ ...r, taxa: Math.round((r.taxa / Math.max(data.entregas.filter(e => respNome(e) === r.nome).length, 1)) * 100) }))

  return { heatmap, atrasosPorObrigacao, respostaPorDia, clientesRisco, margemEmpresas, produtividade, retrabalho }
}

function one<T>(rel: Rel<T>): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel
}

function day(date: string) {
  return Number(String(date).slice(8, 10))
}

function isLate(e: any) {
  if (e.status === 'atrasada') return true
  if (['entregue', 'justificada', 'dispensada'].includes(e.status)) return false
  return new Date(e.prazo_legal) < new Date()
}

function group(rows: any[], getName: (row: any) => string) {
  return rows.reduce<Record<string, { nome: string; atrasadas: number }>>((acc, row) => {
    const nome = getName(row)
    acc[nome] = acc[nome] ?? { nome, atrasadas: 0 }
    acc[nome].atrasadas += 1
    return acc
  }, {})
}

function top<T extends Record<string, any>>(map: Record<string, T>, limit: number, key: keyof T) {
  return Object.values(map).sort((a, b) => Number(b[key]) - Number(a[key])).slice(0, limit)
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-black/10 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        <p className="text-xs text-ink-500">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

function ChartEmpty({ empty, children }: { empty: boolean; children: ReactNode }) {
  return empty ? <p className="py-12 text-center text-sm text-ink-400">Sem dados suficientes para esta visualização.</p> : children
}

function TableEmpty({ empty, children }: { empty: boolean; children: ReactNode }) {
  return empty ? <p className="py-8 text-center text-sm text-ink-400">Sem dados para listar.</p> : children
}
