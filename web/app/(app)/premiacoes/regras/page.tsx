/**
 * Premiações — Metodologia / Regras configuráveis.
 *
 * Admin/gerente edita:
 *   - eventos pontuáveis (entrega_no_prazo, _antecipada, _atrasada, etc) + valor
 *   - níveis (score_minimo, bonus_perc, meta_mensal_pts) BRONZE/PRATA/OURO
 *   - departamentos: ativa/desativa modo automático
 *
 * Tudo persiste em regras_pontuacao_org, premiacoes_regras_org, org_departamentos.
 */

import { redirect } from 'next/navigation'
import { Award, AlertTriangle, Settings2 } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { RegrasEditor } from './editor'

export const revalidate = 0   // configuração — sempre fresh

export default async function PremiacoesRegrasPage() {
  const ctx = await loadOrgContext()
  if (!ctx) return null
  if (!['admin', 'gerente'].includes(ctx.my_role)) redirect('/premiacoes')

  const supabase = createServerClient()

  const [
    { data: regrasEventos },
    { data: niveis },
    { data: deptos },
  ] = await Promise.all([
    supabase
      .from('regras_pontuacao_org')
      .select('id, evento, pontos, ativo')
      .eq('org_id', ctx.org_id)
      .order('evento'),
    supabase
      .from('premiacoes_regras_org')
      .select('id, nivel, score_minimo, bonus_perc, meta_mensal_pts')
      .eq('org_id', ctx.org_id)
      .order('score_minimo'),
    supabase
      .from('org_departamentos')
      .select('id, codigo, nome, premiacao_modo, meta_perc_no_prazo')
      .eq('org_id', ctx.org_id)
      .order('codigo'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-mind-700">
          <Settings2 size={12} className="mr-1 inline" /> Premiações · Metodologia
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900">Regras de pontuação e bônus</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-500 leading-relaxed">
          Quando uma entrega muda para <strong className="text-emerald-700">entregue</strong>, o sistema soma
          pontos automaticamente segundo as regras abaixo. No fim do mês, esses pontos viram <em>score</em>,
          que classifica o nível (Bronze/Prata/Ouro) e calcula o bônus sobre o salário-base.
        </p>
      </div>

      <RegrasEditor
        regrasEventos={regrasEventos ?? []}
        niveis={niveis ?? []}
        departamentos={deptos ?? []}
      />

      <div className="rounded-xl bg-mind-50/50 p-4 ring-1 ring-mind-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-mind-800">
          <AlertTriangle size={12} className="mr-1 inline" /> Como funciona o cálculo
        </p>
        <ol className="ml-5 mt-2 list-decimal space-y-1 text-sm text-ink-700">
          <li>Cada entrega marcada como <strong>entregue</strong> gera pontos automáticos (se o departamento estiver em modo automático).</li>
          <li>No fim do mês: <code className="rounded bg-white px-1 py-0.5 text-xs">Score = pontos do mês ÷ meta mensal × 100</code></li>
          <li>Nível alcançado pela faixa de score mínimo (Bronze, Prata, Ouro).</li>
          <li><code className="rounded bg-white px-1 py-0.5 text-xs">Bônus = salário-base × % do nível</code></li>
          <li>Departamentos em modo <strong>manual</strong> não geram pontos automáticos — gerente lança no fim do mês.</li>
        </ol>
      </div>
    </div>
  )
}
