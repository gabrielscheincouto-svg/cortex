import { API_BASE_URL } from '@/lib/api'

export const revalidate = 60

async function getTVData(token?: string) {
  if (!token) return null
  const res = await fetch(`${API_BASE_URL}/api/v1/tv?token=${encodeURIComponent(token)}`, { next: { revalidate: 60 } })
  if (!res.ok) return null
  return res.json()
}

export default async function TVPage({ searchParams }: { searchParams: { token?: string } }) {
  const data = await getTVData(searchParams.token)
  if (!data) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-xl font-semibold text-white">Token de TV inválido</main>
  }
  const cards = [
    ['Mural', data.mural, (i: any) => <><b>{i.titulo}</b><span>{i.conteudo}</span></>],
    ['Kanban', data.kanban, (i: any) => <><b>{i.status}</b><span>{i.total} tarefas</span></>],
    ['Vencendo', data.entregas, (i: any) => <><b>{i.empresa}</b><span>{i.obrigacao} · {String(i.prazo).slice(0,10)} · {i.status}</span></>],
    ['Ranking semanal', data.ranking, (i: any) => <><b>{i.posicao}º {i.nome}</b><span>{i.pontos} pontos</span></>],
    ['Solicitações', data.solicitacoes, (i: any) => <><b>{i.prioridade}</b><span>{i.total} abertas</span></>],
    ['KPIs do mês', data.kpis, (i: any) => <><b>{i.perc_no_prazo}% no prazo</b><span>{i.entregas_total} entregas · NPS {i.nps_medio}</span></>],
  ] as const

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">Cortex TV</p>
          <h1 className="mt-2 text-4xl font-bold">{data.org.nome}</h1>
        </div>
        <p className="text-lg text-slate-300">Atualiza a cada 60s</p>
      </header>
      <section className="grid min-h-[calc(100vh-140px)] grid-cols-1 gap-5 lg:grid-cols-3">
        {cards.map(([title, items, render]) => (
          <article key={title} className="rounded-lg border border-white/10 bg-white/10 p-5 shadow-2xl">
            <h2 className="text-2xl font-bold">{title}</h2>
            <div className="mt-4 space-y-3">
              {(items?.length ? items : [{}]).map((item: any, idx: number) => (
                <div key={idx} className="flex flex-col rounded-lg bg-slate-950/60 p-4 text-lg">
                  {items?.length ? render(item) : <span className="text-slate-400">Cortex ainda está aprendendo...</span>}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
