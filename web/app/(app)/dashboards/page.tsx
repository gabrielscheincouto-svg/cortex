import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, CardHeader, Stat } from '@/components/ui'
import { DashboardsClient, type DashboardData } from './views'

export default async function DashboardsPage() {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  const competenciaAtual = hoje.toISOString().slice(0, 7)

  const [
    { data: entregas },
    { data: solicitacoes },
    { data: empresas },
    { data: tempos },
    { data: pontos },
  ] = await Promise.all([
    supabase
      .from('entregas')
      .select(`
        id, empresa_id, obrigacao_id, departamento, competencia, prazo_legal,
        status, responsavel_id, entregue_em, multa_aplicada, multa_valor_cents,
        empresas(razao_social, honorario_mensal_cents),
        obrigacoes_catalogo(nome, tempo_estimado_minutos),
        profiles!responsavel_id(nome)
      `)
      .eq('org_id', ctx.org_id)
      .gte('competencia', competenciaAtual.slice(0, 4) + '-01')
      .limit(1200),
    supabase
      .from('solicitacoes')
      .select('id, empresa_id, status, prioridade, created_at, primeira_resposta_em, resolvida_em, avaliacao_estrelas, empresas(razao_social)')
      .eq('org_id', ctx.org_id)
      .gte('created_at', inicioMes)
      .limit(800),
    supabase
      .from('empresas')
      .select('id, razao_social, honorario_mensal_cents, status')
      .eq('org_id', ctx.org_id)
      .eq('status', 'ativa')
      .limit(800),
    supabase
      .from('telemetria_tempo')
      .select('id, entrega_id, user_id, minutos, criado_em, profiles!user_id(nome)')
      .eq('org_id', ctx.org_id)
      .gte('criado_em', inicioMes)
      .limit(1200),
    supabase
      .from('pontos_eventos')
      .select('id, user_id, pontos, evento, created_at, profiles!user_id(nome)')
      .eq('org_id', ctx.org_id)
      .gte('created_at', inicioMes)
      .limit(1200),
  ])

  const data: DashboardData = {
    entregas: entregas ?? [],
    solicitacoes: solicitacoes ?? [],
    empresas: empresas ?? [],
    tempos: tempos ?? [],
    pontos: pontos ?? [],
  }

  const totalEntregas = data.entregas.length
  const entregues = data.entregas.filter(e => e.status === 'entregue')
  const noPrazo = entregues.filter(e => e.entregue_em && new Date(e.entregue_em) <= new Date(`${e.prazo_legal}T23:59:59`)).length
  const abertas = data.solicitacoes.filter(s => ['nova', 'em_atendimento', 'aguardando_cliente'].includes(s.status)).length
  const honorarios = data.empresas.reduce((acc, e) => acc + Number(e.honorario_mensal_cents ?? 0), 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Dashboards gerenciais</h1>
        <p className="mt-1 text-sm text-ink-500">Prazos, comunicação, rentabilidade e produtividade do escritório.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Entregas analisadas" value={totalEntregas.toString()} sub="Ano corrente" accent="brand" />
        <Stat label="% no prazo" value={entregues.length ? `${Math.round((noPrazo / entregues.length) * 100)}%` : '—'} sub="Entre entregues" accent="gold" />
        <Stat label="Solicitações abertas" value={abertas.toString()} sub="Mês atual" />
        <Stat label="Honorários ativos" value={(honorarios / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} sub="Base mensal" accent="brand" />
      </div>

      <Card>
        <CardHeader title="Visões gerenciais" subtitle="Use as abas para alternar entre áreas de acompanhamento" />
        <DashboardsClient data={data} />
      </Card>
    </div>
  )
}
