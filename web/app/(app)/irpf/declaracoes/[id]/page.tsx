import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FileText, User, Calendar } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, CardHeader, Stat, Pill, Empty } from '@/components/ui'
import { brl, dateBR } from '@/lib/utils'
import {
  statusBadge, statusLabel, tipoLabel, formatCPF,
  type IrpfDeclaracaoDetalhe, type IrpfLancamentoTipo, type IrpfStatus, type IrpfLancamento,
} from '@/lib/irpf'
import { CalcularButton, MudarStatusButton, NovoLancamentoButton, ExcluirLancamentoButton } from './actions'

// Agrupa lançamentos por categoria visual
const GRUPOS: { titulo: string; tipos: IrpfLancamentoTipo[] }[] = [
  { titulo: 'Rendimentos', tipos: ['rendimento_tributavel', 'rendimento_isento', 'rendimento_exclusivo'] },
  { titulo: 'Deduções', tipos: ['deducao_medica', 'deducao_educacao', 'deducao_previdencia', 'deducao_pensao'] },
  { titulo: 'Dependentes', tipos: ['dependente'] },
  { titulo: 'Bens e dívidas', tipos: ['bem_direito', 'divida'] },
]

export default async function IrpfDeclaracaoDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  // Buscamos declaração + declarante + lançamentos em queries paralelas direto do Supabase
  const [decRes, lancRes] = await Promise.all([
    supabase
      .from('irpf_declaracoes')
      .select(`
        id, org_id, exercicio, ano_calendario, status, responsavel_id,
        rendimentos_total_cents, deducoes_total_cents, imposto_devido_cents,
        imposto_retido_cents, saldo_cents, situacao_final, recibo_url,
        transmitida_em, observacoes, created_at, updated_at, declarante_id,
        irpf_declarantes!declarante_id(id, cpf, nome_completo, email, telefone, data_nascimento),
        profiles!responsavel_id(nome)
      `)
      .eq('id', params.id)
      .eq('org_id', ctx.org_id)
      .maybeSingle(),
    supabase
      .from('irpf_lancamentos')
      .select('id, tipo, fonte_pagadora, fonte_cnpj, descricao, valor_cents, imposto_retido_cents, created_at')
      .eq('declaracao_id', params.id)
      .eq('org_id', ctx.org_id)
      .order('created_at'),
  ])

  if (!decRes.data) return notFound()
  const d = decRes.data
  const declarante = Array.isArray(d.irpf_declarantes) ? d.irpf_declarantes[0] : (d as any).irpf_declarantes
  const responsavel = Array.isArray(d.profiles) ? d.profiles[0] : (d as any).profiles
  const lancamentos = (lancRes.data ?? []) as unknown as IrpfLancamento[]

  // Agrupa lançamentos por tipo
  const porTipo = new Map<IrpfLancamentoTipo, IrpfLancamento[]>()
  for (const l of lancamentos) {
    const arr = porTipo.get(l.tipo as IrpfLancamentoTipo) ?? []
    arr.push(l)
    porTipo.set(l.tipo as IrpfLancamentoTipo, arr)
  }

  return (
    <div className="space-y-6">
      <Link href="/irpf/declaracoes" className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Voltar para declarações
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            Exercício {d.exercicio} · Ano-calendário {d.ano_calendario}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">{declarante?.nome_completo ?? '—'}</h1>
          <p className="mt-1 text-sm text-ink-500">
            CPF <span className="font-mono">{declarante?.cpf ? formatCPF(declarante.cpf) : '—'}</span>
            {responsavel?.nome && <> · responsável {responsavel.nome}</>}
            {d.transmitida_em && <> · transmitida em {dateBR(d.transmitida_em)}</>}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill className={statusBadge[d.status as IrpfStatus]}>{statusLabel[d.status as IrpfStatus]}</Pill>
            {d.situacao_final && (
              <Pill className={d.situacao_final === 'a_restituir' ? 'bg-emerald-100 text-emerald-900 ring-emerald-300'
                : d.situacao_final === 'a_pagar' ? 'bg-rose-100 text-rose-900 ring-rose-300'
                : 'bg-ink-100 text-ink-700 ring-ink-200'}>
                {d.situacao_final === 'a_restituir' ? 'A restituir' : d.situacao_final === 'a_pagar' ? 'A pagar' : 'Sem imposto'}
              </Pill>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CalcularButton declaracaoId={d.id} />
            <MudarStatusButton declaracaoId={d.id} statusAtual={d.status} />
          </div>
        </div>
      </div>

      {/* Resumo de cálculo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Rendimentos" value={brl(d.rendimentos_total_cents)} accent="brand" />
        <Stat label="Deduções" value={brl(d.deducoes_total_cents)} accent="gold" />
        <Stat label="Imposto devido" value={brl(d.imposto_devido_cents)} />
        <Stat label="Imposto retido" value={brl(d.imposto_retido_cents)} />
        <Stat
          label="Saldo"
          value={d.saldo_cents === 0 ? '—' : brl(Math.abs(d.saldo_cents))}
          sub={d.saldo_cents < 0 ? 'a restituir' : d.saldo_cents > 0 ? 'a pagar' : 'sem imposto'}
          valueColor={d.saldo_cents < 0 ? 'text-emerald-700' : d.saldo_cents > 0 ? 'text-rose-700' : undefined}
        />
      </div>

      {/* Identificação */}
      <Card>
        <CardHeader icon={User} title="Identificação do declarante" />
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Row icon={User} label="Nome completo" value={declarante?.nome_completo ?? '—'} />
          <Row label="CPF" value={declarante?.cpf ? formatCPF(declarante.cpf) : '—'} mono />
          <Row icon={Calendar} label="Data de nascimento" value={declarante?.data_nascimento ? dateBR(declarante.data_nascimento) : '—'} />
          <Row label="Email" value={declarante?.email ?? '—'} />
          <Row label="Telefone" value={declarante?.telefone ?? '—'} />
          <Row label="Exercício" value={`${d.exercicio} (ano-calendário ${d.ano_calendario})`} />
        </dl>
      </Card>

      {/* Lançamentos por grupo */}
      {GRUPOS.map(grupo => {
        const itens: IrpfLancamento[] = grupo.tipos.flatMap(t => porTipo.get(t) ?? [])
        const soma = itens.reduce((acc, it) => acc + it.valor_cents, 0)
        return (
          <Card key={grupo.titulo}>
            <CardHeader
              icon={FileText}
              title={grupo.titulo}
              subtitle={itens.length === 0 ? 'Sem lançamentos' : `${itens.length} item(ns) · total ${brl(soma)}`}
              action={<NovoLancamentoButton declaracaoId={d.id} tipo={grupo.tipos[0]} />}
            />
            {itens.length === 0 ? (
              <Empty
                icon={FileText}
                title={`Sem ${grupo.titulo.toLowerCase()}`}
                description="Adicione lançamentos para o Cortex calcular automaticamente."
              />
            ) : (
              <ul className="divide-y divide-black/5">
                {itens.map(l => (
                  <li key={l.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Pill className="bg-ink-100 text-ink-700 ring-ink-200">{tipoLabel[l.tipo as IrpfLancamentoTipo]}</Pill>
                        {l.fonte_pagadora && <span className="text-sm text-ink-900">{l.fonte_pagadora}</span>}
                      </div>
                      {l.descricao && <p className="mt-1 text-xs text-ink-500">{l.descricao}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-ink-900">{brl(l.valor_cents)}</p>
                        {l.imposto_retido_cents > 0 && (
                          <p className="text-xs text-ink-500">IR retido {brl(l.imposto_retido_cents)}</p>
                        )}
                      </div>
                      <ExcluirLancamentoButton lancamentoId={l.id} declaracaoId={d.id} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      })}

      {d.observacoes && (
        <Card>
          <CardHeader title="Observações" />
          <p className="whitespace-pre-line text-sm text-ink-700">{d.observacoes}</p>
        </Card>
      )}

      <p className="text-center text-xs text-ink-400">
        Cálculo usa a tabela progressiva oficial da Receita Federal para o ano-calendário {d.ano_calendario}.
      </p>
    </div>
  )
}

function Row({ icon: Icon, label, value, mono }: { icon?: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-b border-black/5 pb-2.5 last:border-0 last:pb-0">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        {Icon && <Icon size={12} />} {label}
      </dt>
      <dd className={`mt-1 text-ink-900 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</dd>
    </div>
  )
}
