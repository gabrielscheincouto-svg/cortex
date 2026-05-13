import Link from 'next/link'
import { Receipt, ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, Pill, Empty } from '@/components/ui'
import { brl, dateBR } from '@/lib/utils'
import { exercicioAtual, formatCPF, statusBadge, statusLabel, type IrpfStatus } from '@/lib/irpf'

const STATUSES: IrpfStatus[] = [
  'a_iniciar', 'coletando', 'em_processamento', 'aguardando_cliente',
  'entregue', 'em_malha', 'retificada', 'cancelada',
]

export default async function IrpfDeclaracoesPage({ searchParams }: { searchParams: { exercicio?: string; status?: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const exercicio = Number(searchParams.exercicio) || exercicioAtual()
  const status = searchParams.status

  let qry = supabase
    .from('irpf_declaracoes')
    .select(`
      id, exercicio, ano_calendario, status, saldo_cents, situacao_final,
      imposto_devido_cents, imposto_retido_cents, transmitida_em, updated_at,
      irpf_declarantes!declarante_id(nome_completo, cpf)
    `)
    .eq('org_id', ctx.org_id)
    .eq('exercicio', exercicio)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (status && STATUSES.includes(status as IrpfStatus)) {
    qry = qry.eq('status', status)
  }

  const { data: declaracoes } = await qry

  return (
    <div className="space-y-5">
      <Link href="/irpf" className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Voltar para IRPF
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Declarações · exercício {exercicio}</h1>
        <p className="mt-1 text-sm text-ink-500">{declaracoes?.length ?? 0} declaração(ões) listada(s)</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/irpf/declaracoes?exercicio=${exercicio}`}
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs ring-1 ring-inset ${
            !status ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-700 ring-black/10 hover:bg-ink-50'
          }`}
        >
          Todas
        </Link>
        {STATUSES.map(s => (
          <Link
            key={s}
            href={`/irpf/declaracoes?exercicio=${exercicio}&status=${s}`}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs ring-1 ring-inset ${
              status === s ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-700 ring-black/10 hover:bg-ink-50'
            }`}
          >
            {statusLabel[s]}
          </Link>
        ))}
      </div>

      <Card>
        {(!declaracoes || declaracoes.length === 0) ? (
          <Empty
            icon={Receipt}
            title="Nenhuma declaração"
            description={status ? 'Tente outro status' : 'Crie a primeira declaração do exercício.'}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Declarante</th>
                  <th className="px-4 py-3 text-left font-semibold">CPF</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                  <th className="px-4 py-3 text-left font-semibold">Última atualização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {declaracoes.map(d => {
                  const dec = Array.isArray(d.irpf_declarantes) ? d.irpf_declarantes[0] : (d as any).irpf_declarantes
                  return (
                    <tr key={d.id} className="hover:bg-ink-50/60">
                      <td className="px-4 py-3">
                        <Link href={`/irpf/declaracoes/${d.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                          {dec?.nome_completo ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-500 font-mono text-xs">{dec?.cpf ? formatCPF(dec.cpf) : '—'}</td>
                      <td className="px-4 py-3">
                        <Pill className={statusBadge[d.status as IrpfStatus]}>{statusLabel[d.status as IrpfStatus]}</Pill>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {d.saldo_cents < 0 ? (
                          <span className="text-emerald-700">{brl(-d.saldo_cents)} restituir</span>
                        ) : d.saldo_cents > 0 ? (
                          <span className="text-rose-700">{brl(d.saldo_cents)} a pagar</span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-500">{dateBR(d.updated_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
