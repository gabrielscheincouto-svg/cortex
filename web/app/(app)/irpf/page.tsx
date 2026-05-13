import Link from 'next/link'
import { Receipt, Users, ListChecks, ArrowRight } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, CardHeader, Stat, Pill, Empty } from '@/components/ui'
import { brl, ago } from '@/lib/utils'
import { exercicioAtual, statusBadge, statusLabel, type IrpfDeclaracao, type IrpfStatus } from '@/lib/irpf'

export default async function IrpfDashboardPage({ searchParams }: { searchParams: { exercicio?: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const exercicio = Number(searchParams.exercicio) || exercicioAtual()
  const exercicios = [exercicio + 1, exercicio, exercicio - 1, exercicio - 2]

  // Dashboard agregado — Server Component consulta direto via Supabase (RLS aplica)
  const { data: linhas } = await supabase
    .from('irpf_declaracoes')
    .select('status, saldo_cents, imposto_retido_cents')
    .eq('org_id', ctx.org_id)
    .eq('exercicio', exercicio)

  const contagem: Record<IrpfStatus, number> = {
    a_iniciar: 0, coletando: 0, em_processamento: 0, aguardando_cliente: 0,
    entregue: 0, em_malha: 0, retificada: 0, cancelada: 0,
  }
  let total = 0, totalARestituir = 0, totalAPagar = 0, totalRetido = 0
  for (const r of linhas ?? []) {
    total++
    contagem[r.status as IrpfStatus]++
    if (r.saldo_cents < 0) totalARestituir += -r.saldo_cents
    if (r.saldo_cents > 0) totalAPagar += r.saldo_cents
    totalRetido += r.imposto_retido_cents
  }

  // Top 5 declarações recentes
  const { data: recentes } = await supabase
    .from('irpf_declaracoes')
    .select(`
      id, status, exercicio, saldo_cents, situacao_final, updated_at,
      irpf_declarantes!declarante_id(nome_completo, cpf)
    `)
    .eq('org_id', ctx.org_id)
    .eq('exercicio', exercicio)
    .order('updated_at', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Imposto de Renda Pessoa Física</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">IRPF · exercício {exercicio}</h1>
          <p className="mt-1 text-sm text-ink-500">
            Ano-calendário {exercicio - 1}. Coleta, processamento e transmissão das declarações.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {exercicios.map(ex => (
            <Link
              key={ex}
              href={`/irpf?exercicio=${ex}`}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs ring-1 ring-inset ${
                ex === exercicio
                  ? 'bg-ink-900 text-white ring-ink-900'
                  : 'bg-white text-ink-700 ring-black/10 hover:bg-ink-50'
              }`}
            >
              {ex}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total de declarações" value={total.toString()} sub={`exercício ${exercicio}`} accent="brand" />
        <Stat label="A restituir" value={brl(totalARestituir)} sub="soma dos saldos negativos" valueColor="text-emerald-700" />
        <Stat label="A pagar" value={brl(totalAPagar)} sub="soma dos saldos positivos" valueColor="text-rose-700" />
        <Stat label="Imposto retido" value={brl(totalRetido)} sub="já recolhido na fonte" />
      </div>

      <Card>
        <CardHeader icon={ListChecks} title="Progresso da campanha" subtitle={`Status agregado das ${total} declarações deste exercício`} />
        {total === 0 ? (
          <Empty
            icon={Receipt}
            title="Nenhuma declaração ainda neste exercício"
            description="Cadastre declarantes e abra declarações para começar a campanha."
          />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(contagem) as IrpfStatus[]).map(s => (
              <div key={s} className="rounded-lg border border-black/10 p-3">
                <Pill className={statusBadge[s]}>{statusLabel[s]}</Pill>
                <p className="mt-2 text-2xl font-semibold text-ink-900">{contagem[s]}</p>
                <p className="text-xs text-ink-500">
                  {total > 0 ? `${Math.round((contagem[s] / total) * 100)}%` : '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader icon={Users} title="Declarantes" subtitle="Carteira de pessoas físicas atendidas" />
          <p className="mb-4 text-sm text-ink-500">
            Cadastre e edite os declarantes. Cada declarante pode ter uma declaração por exercício.
          </p>
          <Link href="/irpf/declarantes" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-900">
            Abrir declarantes <ArrowRight size={14} />
          </Link>
        </Card>

        <Card>
          <CardHeader icon={Receipt} title="Declarações" subtitle="Lista completa por exercício e status" />
          <p className="mb-4 text-sm text-ink-500">
            Filtre por status, abra cada declaração para lançamentos e cálculo.
          </p>
          <Link href={`/irpf/declaracoes?exercicio=${exercicio}`} className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-900">
            Abrir declarações <ArrowRight size={14} />
          </Link>
        </Card>

        <Card>
          <CardHeader icon={ListChecks} title="Memória do exercício" subtitle="Tabela e regras da Receita" />
          <p className="text-sm text-ink-500">
            Cortex usa a tabela progressiva oficial do ano-calendário {exercicio - 1} para todos os cálculos.
            A atualização é anual.
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Atualizações recentes" subtitle={`Últimas declarações modificadas no exercício ${exercicio}`} />
        {(!recentes || recentes.length === 0) ? (
          <Empty icon={Receipt} title="Sem atualizações" description="Quando uma declaração mudar, ela aparece aqui." />
        ) : (
          <ul className="divide-y divide-black/5">
            {recentes.map((r) => {
              const dec = Array.isArray(r.irpf_declarantes) ? r.irpf_declarantes[0] : (r as any).irpf_declarantes
              return (
                <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                  <Link href={`/irpf/declaracoes/${r.id}`} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{dec?.nome_completo ?? '—'}</p>
                      <p className="text-xs text-ink-500">CPF {dec?.cpf ?? '—'} · atualizado {ago(r.updated_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Pill className={statusBadge[r.status as IrpfStatus]}>{statusLabel[r.status as IrpfStatus]}</Pill>
                      {r.saldo_cents !== 0 && (
                        <span className={`text-sm font-medium ${r.saldo_cents < 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {r.saldo_cents < 0 ? brl(-r.saldo_cents) + ' restituir' : brl(r.saldo_cents) + ' a pagar'}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
