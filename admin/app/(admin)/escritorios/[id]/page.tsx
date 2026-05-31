import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, Users, Building, FileText, type LucideIcon } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { Card, CardHeader, Stat, Pill } from '@/components/ui'
import { brl, dateBR, orgStatusBadge } from '@/lib/utils'

export default async function EscritorioDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()

  const { data: org } = await supabase
    .from('orgs')
    .select(`
      id, slug, nome, cnpj, razao_social, cidade, estado, email_contato,
      cor_primaria, status, trial_ends_at, onboarding_completo, created_at,
      planos(nome, codigo, preco_mensal_cents, limite_usuarios, limite_empresas, limite_storage_gb)
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (!org) return notFound()

  const [
    { count: membrosCount },
    { count: empresasCount },
    { count: entregasMesCount },
    { data: ultimaTelemetria },
    { data: modulos },
  ] = await Promise.all([
    supabase.from('org_membros').select('*', { count: 'exact', head: true }).eq('org_id', org.id).eq('status', 'ativo'),
    supabase.from('empresas').select('*', { count: 'exact', head: true }).eq('org_id', org.id).eq('status', 'ativa'),
    supabase.from('entregas').select('*', { count: 'exact', head: true }).eq('org_id', org.id).gte('created_at', new Date(new Date().setDate(1)).toISOString()),
    supabase.from('org_telemetria_dia').select('*').eq('org_id', org.id).order('data', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('org_modulos').select('modulo, ativo').eq('org_id', org.id),
  ])

  const plano = Array.isArray(org.planos) ? org.planos[0] : org.planos
  const badge = orgStatusBadge(org.status)
  const ativosCount = modulos?.filter(m => m.ativo).length ?? 0

  return (
    <div className="space-y-6">
      <Link href="/escritorios" className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Voltar para escritórios
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: org.cor_primaria }}
          >
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">{org.nome}</h1>
            <p className="mt-1 text-sm text-ink-500">
              <span className="font-mono">{org.slug}.usecortex.com.br</span> · criado em {dateBR(org.created_at)}
            </p>
            <div className="mt-2 flex gap-2">
              <Pill className={badge.classes}>{badge.label}</Pill>
              <Pill className="bg-ink-100 text-ink-700 ring-ink-200">{plano?.nome ?? 'Sem plano'}</Pill>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Membros ativos" value={(membrosCount ?? 0).toString()} sub={plano?.limite_usuarios ? `de ${plano.limite_usuarios}` : 'ilimitado'} accent="brand" />
        <Stat label="Empresas atendidas" value={(empresasCount ?? 0).toString()} sub={plano?.limite_empresas ? `de ${plano.limite_empresas}` : 'ilimitado'} accent="gold" />
        <Stat label="Entregas no mês" value={(entregasMesCount ?? 0).toString()} sub="Processadas + manuais" />
        <Stat label="Plano" value={plano ? brl(plano.preco_mensal_cents) : '—'} sub={`${ativosCount} módulos ativos`} accent="brand" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Detalhes" subtitle="Dados cadastrais e contato" />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Row icon={Building} label="Razão social" value={org.razao_social ?? '—'} />
            <Row icon={FileText} label="CNPJ" value={org.cnpj ?? '—'} mono />
            <Row icon={Users} label="Contato" value={org.email_contato ?? '—'} />
            <Row label="Cidade / UF" value={[org.cidade, org.estado].filter(Boolean).join(' / ') || '—'} />
            <Row label="Status onboarding" value={org.onboarding_completo ? 'Completo' : 'Pendente'} />
            <Row label="Trial expira em" value={org.trial_ends_at ? dateBR(org.trial_ends_at) : '—'} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Telemetria de ontem" subtitle="Snapshot do job diário" />
          {ultimaTelemetria ? (
            <dl className="space-y-2 text-sm">
              <Mini label="Usuários ativos 7d" value={ultimaTelemetria.usuarios_ativos_7d?.toString() ?? '—'} />
              <Mini label="% entregas no prazo" value={ultimaTelemetria.entregas_no_prazo_dia && ultimaTelemetria.entregas_processadas_dia
                ? `${Math.round(ultimaTelemetria.entregas_no_prazo_dia / ultimaTelemetria.entregas_processadas_dia * 100)}%`
                : '—'} />
              <Mini label="Solicitações abertas" value={ultimaTelemetria.solicitacoes_abertas?.toString() ?? '—'} />
              <Mini label="NPS médio 30d" value={ultimaTelemetria.nps_medio_30d?.toFixed(1) ?? '—'} />
              <Mini label="Arquivos via robô" value={ultimaTelemetria.arquivos_via_robo_dia?.toString() ?? '—'} />
            </dl>
          ) : (
            <p className="text-sm text-ink-400">Sem dados ainda — o job de telemetria roda diariamente 03:00 BRT.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Módulos habilitados" subtitle="Overrides explícitos sobre o que o plano libera por padrão" />
        {modulos && modulos.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {modulos.map(m => (
              <Pill key={m.modulo} className={m.ativo ? 'bg-emerald-100 text-emerald-900 ring-emerald-300' : 'bg-ink-100 text-ink-500 ring-ink-200'}>
                {m.modulo}{!m.ativo && ' (desativado)'}
              </Pill>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-400">Nenhum override — herda os módulos do plano <strong>{plano?.nome}</strong>.</p>
        )}
      </Card>
    </div>
  )
}

function Row({ icon: Icon, label, value, mono }: { icon?: LucideIcon; label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-b border-black/5 pb-3 last:border-0 last:pb-0">
      <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        {Icon && <Icon size={12} />} {label}
      </dt>
      <dd className={`mt-1 text-ink-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  )
}
