/**
 * Premiações — cálculo Salário × Score × Nível × Bônus (paridade legado).
 * Score = pontos do mês ÷ meta_mensal × 100
 * Níveis (BRONZE / PRATA / OURO) e %Bônus configurados em premiacoes_regras_org.
 * Valor = salário_base × %bônus do nível.
 */

import Link from 'next/link'
import { Award, FileText, Settings2, AlertTriangle } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { brl } from '@/lib/utils'

export const revalidate = 30

const NIVEL_BADGE: Record<string, string> = {
  ouro:      'bg-amber-100 text-amber-900 ring-amber-300',
  prata:     'bg-ink-100 text-ink-700 ring-ink-300',
  bronze:    'bg-orange-100 text-orange-900 ring-orange-300',
  sem_nivel: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const NIVEL_LABEL: Record<string, string> = {
  ouro:      'OURO',
  prata:     'PRATA',
  bronze:    'BRONZE',
  sem_nivel: 'Sem nível',
}

export default async function PremiacoesPage() {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  // Linhas calculadas pela view
  const { data: linhas } = await supabase
    .from('premiacao_mensal_view')
    .select('user_id, funcionario, setor, cargo, salario_base_cents, pontos_mes, score_perc, nivel, bonus_perc, valor_bonus_cents')
    .eq('org_id', ctx.org_id)
    .order('valor_bonus_cents', { ascending: false })

  const totalBonus = (linhas ?? []).reduce((s, l) => s + (l.valor_bonus_cents ?? 0), 0)
  const contagem = (linhas ?? []).reduce<Record<string, number>>((acc, l) => {
    acc[l.nivel] = (acc[l.nivel] ?? 0) + 1
    return acc
  }, {})
  const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-mind-700">
            <Award size={12} className="mr-1 inline" /> Premiação
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">
            Cálculo do mês — {mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1)}
          </h1>
          <p className="mt-1 text-xs text-ink-500">
            Score = pontos do mês ÷ meta · Bônus = salário-base × % do nível alcançado.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/premiacoes/regras" prefetch={false}>
            <button className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-ink-700 ring-1 ring-inset ring-black/10 hover:bg-ink-50">
              <Settings2 size={14} /> Metodologia
            </button>
          </Link>
          <button className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2 text-xs font-medium text-white hover:bg-ink-800">
            <FileText size={14} /> Gerar Termo
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <KPIBig label="Funcionários"  valor={(linhas ?? []).length.toString()} sub="ativos" />
        <KPIBig label="OURO"          valor={(contagem.ouro      ?? 0).toString()} sub="atingiram 95%+" cor="text-amber-700" />
        <KPIBig label="PRATA"         valor={(contagem.prata     ?? 0).toString()} sub="entre 80% e 95%" cor="text-ink-700" />
        <KPIBig label="BRONZE"        valor={(contagem.bronze    ?? 0).toString()} sub="entre 60% e 80%" cor="text-orange-700" />
        <KPIBig label="Total bônus"   valor={brl(totalBonus)} sub="mês atual" cor="text-emerald-700" />
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              <th className="px-4 py-3">Funcionário</th>
              <th className="px-4 py-3">Setor</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3 text-right">Salário</th>
              <th className="px-4 py-3 text-right">Pontos</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3">Nível</th>
              <th className="px-4 py-3 text-right">% Bônus</th>
              <th className="px-4 py-3 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {(!linhas || linhas.length === 0) ? (
              <tr>
                <td colSpan={9} className="px-6 py-10 text-center text-sm text-ink-400">
                  Nenhum funcionário ativo encontrado. Cadastre membros em <Link href="/configuracoes" className="text-mind-700">/configuracoes</Link>.
                </td>
              </tr>
            ) : linhas.map((l) => {
              const semSalario = !l.salario_base_cents || l.salario_base_cents === 0
              return (
                <tr key={l.user_id} className="hover:bg-ink-50/40">
                  <td className="px-4 py-3 font-medium text-ink-900">{l.funcionario}</td>
                  <td className="px-4 py-3 text-xs text-ink-600">{l.setor}</td>
                  <td className="px-4 py-3 text-xs text-ink-600">{l.cargo}</td>
                  <td className="px-4 py-3 text-right text-xs text-ink-700">
                    {semSalario ? (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <AlertTriangle size={11} /> definir
                      </span>
                    ) : brl(l.salario_base_cents)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-ink-700">{l.pontos_mes ?? 0}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-ink-900">
                    {l.score_perc ?? 0}%
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${NIVEL_BADGE[l.nivel] ?? NIVEL_BADGE.sem_nivel}`}>
                      {NIVEL_LABEL[l.nivel] ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-medium text-ink-700">{l.bonus_perc ?? 0}%</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">
                    {semSalario ? '—' : brl(l.valor_bonus_cents ?? 0)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {linhas && linhas.length > 0 && (
            <tfoot>
              <tr className="bg-ink-50 text-sm font-semibold text-ink-900">
                <td colSpan={8} className="px-4 py-3 text-right">Total a pagar</td>
                <td className="px-4 py-3 text-right text-emerald-700">{brl(totalBonus)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-[11px] text-ink-400">
        Defina salário-base de cada membro em <Link href="/configuracoes" className="text-mind-700 hover:underline">Configurações → Equipe</Link>. Os parâmetros de nível (Bronze/Prata/Ouro), meta mensal e % de bônus ficam em <Link href="/premiacoes/regras" className="text-mind-700 hover:underline">Metodologia</Link>.
      </p>
    </div>
  )
}

function KPIBig({ label, valor, sub, cor = 'text-ink-900' }: { label: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-black/5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${cor}`}>{valor}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-400">{sub}</p>}
    </div>
  )
}
