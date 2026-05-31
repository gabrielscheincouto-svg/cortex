/**
 * Ctrl Contábil — Matriz mensal empresa × mês × status (paridade legado).
 *
 * Cada célula mostra a situação do mês:
 *   C    = Conciliado            (verde escuro)
 *   C/D  = Conc. aguardando doc  (verde claro)
 *   L    = Lançado               (amarelo)
 *   D    = Doc recebido          (azul)
 *   S    = Suspensa              (cinza)
 *   N    = Não receberá          (cinza tracejado)
 *   —    = pendente              (vazio)
 *
 * Inline edit: click na célula abre dropdown. Lock por mês = cadeado.
 */

import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { MatrizControle } from './matriz'

export const revalidate = 15

export default async function CtrlContabilPage({ searchParams }: { searchParams: { ano?: string; resp?: string; q?: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const ano = Number(searchParams.ano) || new Date().getFullYear()
  const respFilter = searchParams.resp || ''
  const q = (searchParams.q || '').trim().toLowerCase()

  // Empresas + responsável (do obrigacao_empresa contábil) + tributação
  const { data: empresas } = await supabase
    .from('empresas')
    .select(`
      id, razao_social, nome_fantasia, cnpj, regime_tributario,
      obrigacao_empresa!empresa_id(responsavel_id, profiles!responsavel_id(id, nome, avatar_url))
    `)
    .eq('org_id', ctx.org_id)
    .eq('status', 'ativa')
    .order('razao_social')

  // Células do ano
  const { data: celulas } = await supabase
    .from('controle_contabil_celulas')
    .select('id, empresa_id, ano, mes, status, observacoes')
    .eq('org_id', ctx.org_id)
    .eq('ano', ano)

  // Meses fechados (cadeado)
  const { data: mesesFechados } = await supabase
    .from('controle_contabil_meses_fechados')
    .select('mes')
    .eq('org_id', ctx.org_id)
    .eq('ano', ano)

  // Responsáveis únicos pro filtro
  const responsaveisMap = new Map<string, { id: string; nome: string }>()
  for (const e of empresas ?? []) {
    const oe = (e as any).obrigacao_empresa as any[]
    for (const link of oe ?? []) {
      const p = Array.isArray(link.profiles) ? link.profiles[0] : link.profiles
      if (p?.id && !responsaveisMap.has(p.id)) responsaveisMap.set(p.id, { id: p.id, nome: p.nome || 'sem nome' })
    }
  }
  const responsaveis = Array.from(responsaveisMap.values()).sort((a, b) => a.nome.localeCompare(b.nome))

  // Filtragem das empresas
  const linhas = (empresas ?? [])
    .map(e => {
      const oe = ((e as any).obrigacao_empresa as any[]) ?? []
      const primeiroResp = oe[0]
      const respObj = primeiroResp?.profiles
      const resp = Array.isArray(respObj) ? respObj[0] : respObj
      return {
        id: e.id,
        razao_social: e.razao_social,
        nome_fantasia: e.nome_fantasia,
        cnpj: e.cnpj,
        regime: e.regime_tributario,
        responsavel: resp ? { id: resp.id, nome: resp.nome } : null,
      }
    })
    .filter(l => {
      if (q) {
        const hay = `${l.razao_social} ${l.nome_fantasia || ''} ${l.cnpj || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (respFilter && respFilter !== 'todos') {
        if (l.responsavel?.id !== respFilter) return false
      }
      return true
    })

  // Map de células
  const celulaMap = new Map<string, { id: string; status: string }>()
  for (const c of celulas ?? []) {
    celulaMap.set(`${c.empresa_id}|${c.mes}`, { id: c.id, status: c.status })
  }
  const fechados = new Set((mesesFechados ?? []).map(m => m.mes))

  // KPI contagem por status no mês corrente
  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const ehAnoAtual = hoje.getFullYear() === ano
  const mesParaKpi = ehAnoAtual ? mesAtual : 12
  const kpiContagem: Record<string, number> = { c: 0, c_d: 0, l: 0, d: 0, s: 0, n: 0, pendente: 0 }
  for (const linha of linhas) {
    const c = celulaMap.get(`${linha.id}|${mesParaKpi}`)
    const st = c?.status ?? 'pendente'
    kpiContagem[st] = (kpiContagem[st] ?? 0) + 1
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Controle de Contabilidade {ano}</h1>
          <p className="mt-1 text-xs text-ink-500 leading-relaxed">
            C = Conciliado · C/D = Conc. aguardando doc · L = Lançado (não conciliado) · D = Doc recebido · S = Suspensa · N = Não receberá doc
          </p>
        </div>
        <div className="flex gap-2">
          <YearChip ano={ano - 1} ativo={false} />
          <YearChip ano={ano}     ativo />
          <YearChip ano={ano + 1} ativo={false} />
        </div>
      </div>

      {/* KPIs status do mês corrente */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
        <KPIChip label="Conciliado"    valor={kpiContagem.c}        cor="bg-emerald-600 text-white" />
        <KPIChip label="Conc. Ag. Doc" valor={kpiContagem.c_d}      cor="bg-emerald-300 text-emerald-950" />
        <KPIChip label="Lançado"       valor={kpiContagem.l}        cor="bg-amber-400 text-amber-950" />
        <KPIChip label="Doc Recebido"  valor={kpiContagem.d}        cor="bg-sky-500 text-white" />
        <KPIChip label="Suspensa"      valor={kpiContagem.s}        cor="bg-ink-200 text-ink-700" />
        <KPIChip label="Pendentes"     valor={kpiContagem.pendente} cor="bg-rose-100 text-rose-800 ring-1 ring-rose-300" />
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap items-center gap-2" action="">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar empresa…"
          className="w-64 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mind-500"
        />
        <select
          name="resp"
          defaultValue={respFilter || 'todos'}
          className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mind-500"
        >
          <option value="todos">Todos responsáveis</option>
          {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <input type="hidden" name="ano" value={ano} />
        <button
          type="submit"
          className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
        >
          Filtrar
        </button>
      </form>

      {/* Matriz */}
      <MatrizControle
        ano={ano}
        linhas={linhas}
        celulaMap={Object.fromEntries(celulaMap)}
        fechados={Array.from(fechados)}
      />

      <p className="text-xs text-ink-400">
        {linhas.length} {linhas.length === 1 ? 'empresa' : 'empresas'} listadas
        {q && <> · busca: <strong>{q}</strong></>}
        {respFilter && respFilter !== 'todos' && <> · responsável: <strong>{responsaveisMap.get(respFilter)?.nome}</strong></>}
      </p>
    </div>
  )
}

function YearChip({ ano, ativo }: { ano: number; ativo: boolean }) {
  return (
    <a
      href={`/balancete?ano=${ano}`}
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${
        ativo
          ? 'bg-ink-900 text-white ring-ink-900'
          : 'bg-white text-ink-700 ring-black/10 hover:bg-ink-50'
      }`}
    >
      {ano}
    </a>
  )
}

function KPIChip({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${cor}`}>
      <span className="text-[11px] font-medium">{label}</span>
      <span className="text-base font-semibold">{valor}</span>
    </div>
  )
}
