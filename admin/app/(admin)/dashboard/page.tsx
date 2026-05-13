import { createServerClient } from '@/lib/supabase'
import { Card, CardHeader, Stat } from '@/components/ui'
import { brl, dateBR } from '@/lib/utils'

// KPIs lidos diretamente do banco via Supabase (mais simples que ir pela API Go neste caso).
// Em telas de operação real, usamos apiServer() — aqui é só leitura agregada.
export default async function DashboardPage() {
  const supabase = createServerClient()

  // Último snapshot diário da plataforma
  const { data: snap } = await supabase
    .from('platform_telemetria_dia')
    .select('*')
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Quantos escritórios temos por status (agregado em tempo real)
  const { count: orgsTotal } = await supabase.from('orgs').select('*', { count: 'exact', head: true })
  const { count: orgsTrial } = await supabase.from('orgs').select('*', { count: 'exact', head: true }).eq('status', 'trial')
  const { count: orgsAtivo } = await supabase.from('orgs').select('*', { count: 'exact', head: true }).eq('status', 'ativo')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Visão geral da plataforma</h1>
        <p className="mt-1 text-sm text-ink-500">
          Snapshot do dia {snap?.data ? dateBR(snap.data) : 'sem dados ainda'} · atualizado pelo job diário 03:00 BRT
        </p>
      </div>

      {/* Linha 1 — KPIs principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="MRR"
          value={brl(snap?.mrr_total_cents ?? 0)}
          sub="Receita recorrente mensal"
          accent="brand"
        />
        <Stat
          label="Escritórios pagantes"
          value={(snap?.orgs_pagantes ?? 0).toString()}
          sub={`${orgsAtivo ?? 0} ativos · ${orgsTrial ?? 0} em trial`}
          accent="gold"
        />
        <Stat
          label="Churn 30d"
          value={snap?.churn_30d ? `${snap.churn_30d.toFixed(1)}%` : '—'}
          sub="Cancelamentos último mês"
          accent="rose"
        />
        <Stat
          label="Activations 30d"
          value={(snap?.activations_30d ?? 0).toString()}
          sub="Trials → pagantes"
          accent="brand"
        />
      </div>

      {/* Linha 2 — Operacional */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Entregas /dia"     value={(snap?.entregas_total_dia ?? 0).toString()} sub="Processadas ontem" />
        <Stat label="Robôs ativos"      value={(snap?.robos_ativos ?? 0).toString()}       sub="Hosts Tauri online" />
        <Stat label="API p95"           value={snap?.api_p95_ms ? `${snap.api_p95_ms} ms` : '—'} sub="Latência (p95)" />
        <Stat label="Erros 5xx /dia"    value={(snap?.api_erros_5xx_dia ?? 0).toString()}  sub="Últimas 24h" />
      </div>

      {/* Tabela ou nota */}
      <Card>
        <CardHeader
          title="Próximas tarefas operacionais"
          subtitle="Itens que precisam da sua atenção esta semana"
        />
        <ul className="divide-y divide-black/10 text-sm">
          <li className="flex items-center justify-between py-3">
            <span>Aplicar migrations 001-016 no projeto Supabase</span>
            <span className="text-xs font-medium text-amber-700">pendente</span>
          </li>
          <li className="flex items-center justify-between py-3">
            <span>Deployar a API Go no Fly.io (região gru)</span>
            <span className="text-xs font-medium text-amber-700">pendente</span>
          </li>
          <li className="flex items-center justify-between py-3">
            <span>Configurar Stripe + webhook de assinaturas</span>
            <span className="text-xs font-medium text-ink-400">backlog</span>
          </li>
          <li className="flex items-center justify-between py-3">
            <span>Importar catálogo de 194 obrigações do Acessórias</span>
            <span className="text-xs font-medium text-ink-400">backlog</span>
          </li>
        </ul>
      </Card>

      <p className="text-xs text-ink-400">
        Total de {orgsTotal ?? 0} escritórios cadastrados na plataforma.
      </p>
    </div>
  )
}
