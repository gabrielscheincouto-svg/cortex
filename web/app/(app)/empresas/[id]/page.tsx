import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, CalendarClock, ClipboardList, FileText, Mail, Phone, Users, type LucideIcon } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Avatar, Card, CardHeader, Empty, Pill, Stat } from '@/components/ui'
import { brl, dateBR, departamentoLabel, entregaStatusBadge } from '@/lib/utils'

const empresaStatusPill: Record<string, string> = {
  ativa: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  baixada: 'bg-ink-100 text-ink-500 ring-ink-200',
  suspensa: 'bg-rose-100 text-rose-900 ring-rose-300',
  em_analise: 'bg-amber-100 text-amber-900 ring-amber-300',
}

const solicitacaoStatusPill: Record<string, string> = {
  nova: 'bg-amber-100 text-amber-900 ring-amber-300',
  em_atendimento: 'bg-blue-100 text-blue-900 ring-blue-300',
  aguardando_cliente: 'bg-purple-100 text-purple-900 ring-purple-300',
  resolvida: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  fechada: 'bg-ink-100 text-ink-500 ring-ink-200',
  cancelada: 'bg-ink-100 text-ink-500 ring-ink-200',
}

const prioridadePill: Record<string, string> = {
  baixa: 'bg-ink-100 text-ink-700 ring-ink-200',
  media: 'bg-blue-100 text-blue-900 ring-blue-300',
  alta: 'bg-amber-100 text-amber-900 ring-amber-300',
  muito_alta: 'bg-rose-100 text-rose-900 ring-rose-300',
}

export default async function EmpresaDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const { data: empresa } = await supabase
    .from('empresas')
    .select(`
      id, org_id, codigo_interno, razao_social, nome_fantasia, cnpj, cpf,
      inscricao_estadual, inscricao_municipal, regime_tributario, cnae_principal,
      data_abertura, data_inicio_servico, email, telefone, whatsapp,
      endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro,
      cidade, estado, cep, honorario_mensal_cents, status, tags, observacoes, created_at
    `)
    .eq('org_id', ctx.org_id)
    .eq('id', params.id)
    .maybeSingle()

  if (!empresa) return notFound()

  const competenciaAtual = new Date().toISOString().slice(0, 7)

  const [
    { data: responsaveis },
    { data: obrigacoes },
    { data: entregas },
    { count: entregasMesCount },
    { data: solicitacoes },
  ] = await Promise.all([
    supabase
      .from('empresa_responsaveis')
      .select('id, user_id, departamento, principal, desde')
      .eq('org_id', ctx.org_id)
      .eq('empresa_id', empresa.id)
      .order('principal', { ascending: false })
      .order('departamento'),
    supabase
      .from('obrigacao_empresa')
      .select(`
        id, ativa, responsavel_id, inicio_vigencia, fim_vigencia,
        obrigacoes_catalogo(id, nome, codigo, departamento, periodicidade, dia_legal)
      `)
      .eq('org_id', ctx.org_id)
      .eq('empresa_id', empresa.id)
      .eq('ativa', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('entregas')
      .select('id, obrigacao_empresa_id, obrigacao_id, competencia, prazo_legal, status, entregue_em')
      .eq('org_id', ctx.org_id)
      .eq('empresa_id', empresa.id)
      .order('competencia', { ascending: false })
      .limit(120),
    supabase
      .from('entregas')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', ctx.org_id)
      .eq('empresa_id', empresa.id)
      .eq('competencia', competenciaAtual),
    supabase
      .from('solicitacoes')
      .select('id, assunto, descricao, prioridade, status, created_at, avaliacao_estrelas, responsavel_id')
      .eq('org_id', ctx.org_id)
      .eq('empresa_id', empresa.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const profileIds = Array.from(new Set([
    ...(responsaveis ?? []).map(r => r.user_id),
    ...(solicitacoes ?? []).map(s => s.responsavel_id),
  ].filter(Boolean))) as string[]
  const { data: profiles } = profileIds.length
    ? await supabase.from('profiles').select('id, nome, email, avatar_url').in('id', profileIds)
    : { data: [] as any[] }
  const profileById = new Map((profiles ?? []).map(p => [p.id, p]))

  const entregasRecentes = entregas ?? []
  const entregasDoMes = entregasRecentes.filter(e => e.competencia === competenciaAtual)
  const entregasEntreguesNoMes = entregasDoMes.filter(e => e.status === 'entregue' && e.entregue_em)
  const entregasNoPrazo = entregasEntreguesNoMes.filter(e => {
    const entregueEm = new Date(e.entregue_em as string)
    const fimPrazo = new Date(`${e.prazo_legal}T23:59:59`)
    return entregueEm <= fimPrazo
  })
  const percentualNoPrazo = entregasEntreguesNoMes.length
    ? Math.round((entregasNoPrazo.length / entregasEntreguesNoMes.length) * 100)
    : null
  const avaliacoes = (solicitacoes ?? []).filter(s => typeof s.avaliacao_estrelas === 'number')
  const npsMedio = avaliacoes.length
    ? (avaliacoes.reduce((acc, s) => acc + Number(s.avaliacao_estrelas), 0) / avaliacoes.length).toFixed(1)
    : null
  const ultimaEntregaPorVinculo = new Map<string, any>()
  entregasRecentes.forEach(e => {
    if (!ultimaEntregaPorVinculo.has(e.obrigacao_empresa_id)) {
      ultimaEntregaPorVinculo.set(e.obrigacao_empresa_id, e)
    }
  })
  const documento = empresa.cnpj ?? empresa.cpf ?? '—'
  const nomeExibicao = empresa.nome_fantasia ?? empresa.razao_social

  return (
    <div className="space-y-6">
      <Link href="/empresas" className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Voltar para empresas
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: ctx.cor_primaria }}
          >
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">{empresa.razao_social}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {empresa.nome_fantasia ? `${empresa.nome_fantasia} · ` : ''}
              <span className="font-mono">{documento}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill className={empresaStatusPill[empresa.status] ?? 'bg-ink-100 text-ink-700 ring-ink-200'}>
                {empresa.status.replace('_', ' ')}
              </Pill>
              <Pill className="bg-ink-100 text-ink-700 ring-ink-200">{brl(empresa.honorario_mensal_cents)}</Pill>
              {empresa.codigo_interno && <Pill className="bg-white text-ink-600 ring-black/10">Código {empresa.codigo_interno}</Pill>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Obrigações ativas" value={(obrigacoes?.length ?? 0).toString()} sub="Vinculadas à empresa" accent="brand" />
        <Stat label="Entregas no mês" value={(entregasMesCount ?? 0).toString()} sub={competenciaAtual} accent="gold" />
        <Stat label="% no prazo" value={percentualNoPrazo === null ? '—' : `${percentualNoPrazo}%`} sub="Entregas concluídas no mês" />
        <Stat label="NPS médio" value={npsMedio ? `${npsMedio}/5` : '—'} sub="Solicitações avaliadas" accent="brand" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Detalhes cadastrais" subtitle="Dados fiscais, contato e endereço" />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Row icon={Building2} label="Nome fantasia" value={empresa.nome_fantasia ?? '—'} />
            <Row icon={FileText} label={empresa.cnpj ? 'CNPJ' : 'CPF'} value={documento} mono />
            <Row label="Regime tributário" value={empresa.regime_tributario?.replace('_', ' ') ?? '—'} />
            <Row label="CNAE principal" value={empresa.cnae_principal ?? '—'} />
            <Row label="Inscrição estadual" value={empresa.inscricao_estadual ?? '—'} />
            <Row label="Inscrição municipal" value={empresa.inscricao_municipal ?? '—'} />
            <Row icon={Mail} label="Email" value={empresa.email ?? '—'} />
            <Row icon={Phone} label="Telefone / WhatsApp" value={[empresa.telefone, empresa.whatsapp].filter(Boolean).join(' / ') || '—'} />
            <Row label="Data de abertura" value={empresa.data_abertura ? dateBR(empresa.data_abertura) : '—'} />
            <Row label="Início do serviço" value={empresa.data_inicio_servico ? dateBR(empresa.data_inicio_servico) : '—'} />
            <Row label="Cidade / UF" value={[empresa.cidade, empresa.estado].filter(Boolean).join(' / ') || '—'} />
            <Row label="Endereço" value={enderecoEmpresa(empresa)} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Observações" subtitle="Anotações internas do cadastro" />
          {empresa.observacoes ? (
            <p className="whitespace-pre-line text-sm leading-6 text-ink-700">{empresa.observacoes}</p>
          ) : (
            <p className="text-sm text-ink-400">Nenhuma observação cadastrada.</p>
          )}
          {empresa.tags && empresa.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {empresa.tags.map((tag: string) => (
                <Pill key={tag} className="bg-ink-100 text-ink-700 ring-ink-200">{tag}</Pill>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Responsáveis" subtitle="Colaboradores vinculados por departamento" icon={Users} />
        {!responsaveis || responsaveis.length === 0 ? (
          <Empty icon={Users} title="Nenhum responsável vinculado" description="Vincule colaboradores por departamento para acompanhar a carteira." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Colaborador</th>
                  <th className="px-4 py-3 text-left font-semibold">Departamento</th>
                  <th className="px-4 py-3 text-left font-semibold">Função</th>
                  <th className="px-4 py-3 text-left font-semibold">Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {responsaveis.map(r => {
                  const profile = profileById.get(r.user_id)
                  const nome = profile?.nome || profile?.email || 'Colaborador'
                  return (
                    <tr key={r.id} className="hover:bg-ink-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar nome={nome} src={profile?.avatar_url} />
                          <div>
                            <p className="font-medium text-ink-900">{nome}</p>
                            {profile?.email && <p className="text-xs text-ink-500">{profile.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-700">{departamentoLabel(r.departamento)}</td>
                      <td className="px-4 py-3">
                        <Pill className={r.principal ? 'bg-emerald-100 text-emerald-900 ring-emerald-300' : 'bg-ink-100 text-ink-700 ring-ink-200'}>
                          {r.principal ? 'Principal' : 'Auxiliar'}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-500">{dateBR(r.desde)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Obrigações vinculadas" subtitle="Catálogo ativo para esta empresa" icon={ClipboardList} />
        {!obrigacoes || obrigacoes.length === 0 ? (
          <Empty icon={ClipboardList} title="Nenhuma obrigação vinculada" description="Ative obrigações do catálogo para gerar entregas recorrentes." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Obrigação</th>
                  <th className="px-4 py-3 text-left font-semibold">Departamento</th>
                  <th className="px-4 py-3 text-left font-semibold">Periodicidade</th>
                  <th className="px-4 py-3 text-left font-semibold">Última entrega</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {obrigacoes.map(vinculo => {
                  const obrigacao = Array.isArray((vinculo as any).obrigacoes_catalogo)
                    ? (vinculo as any).obrigacoes_catalogo[0]
                    : (vinculo as any).obrigacoes_catalogo
                  const ultimaEntrega = ultimaEntregaPorVinculo.get(vinculo.id)
                  const badge = ultimaEntrega ? entregaStatusBadge(ultimaEntrega.status) : null
                  return (
                    <tr key={vinculo.id} className="hover:bg-ink-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-900">{obrigacao?.nome ?? '—'}</p>
                        {obrigacao?.codigo && <p className="text-xs text-ink-500">{obrigacao.codigo}</p>}
                      </td>
                      <td className="px-4 py-3 text-ink-700">{departamentoLabel(obrigacao?.departamento ?? 'outro')}</td>
                      <td className="px-4 py-3 text-xs text-ink-500">{obrigacao?.periodicidade?.replace('_', ' ') ?? '—'}</td>
                      <td className="px-4 py-3">
                        {ultimaEntrega ? (
                          <div className="text-xs">
                            <p className="font-mono text-ink-900">{ultimaEntrega.competencia}</p>
                            <p className="text-ink-500">Prazo {dateBR(ultimaEntrega.prazo_legal)}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-400">Sem entregas</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {badge ? <Pill className={badge.classes}>{badge.label}</Pill> : <Pill className="bg-ink-100 text-ink-500 ring-ink-200">Pendente de geração</Pill>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Solicitações recentes" subtitle={`Últimos tickets de ${nomeExibicao}`} icon={CalendarClock} />
        {!solicitacoes || solicitacoes.length === 0 ? (
          <Empty icon={CalendarClock} title="Nenhuma solicitação recente" description="Quando esta empresa abrir um chamado, ele aparece aqui." />
        ) : (
          <ul className="divide-y divide-black/5">
            {solicitacoes.map(s => {
              const resp = s.responsavel_id ? profileById.get(s.responsavel_id) : null
              return (
                <li key={s.id} className="py-4 first:pt-0 last:pb-0">
                  <Link href={`/solicitacoes/${s.id}`} className="block rounded-lg px-2 py-1 hover:bg-ink-50/70">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <p className="font-medium text-ink-900">{s.assunto}</p>
                          <Pill className={solicitacaoStatusPill[s.status]}>{s.status.replace('_', ' ')}</Pill>
                          <Pill className={prioridadePill[s.prioridade]}>{s.prioridade.replace('_', ' ')}</Pill>
                        </div>
                        <p className="text-xs text-ink-500">
                          {dateBR(s.created_at)} · responsável {resp?.nome ?? 'sem atribuição'}
                        </p>
                        {s.descricao && <p className="mt-1.5 line-clamp-2 text-sm text-ink-700">{s.descricao}</p>}
                      </div>
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

function enderecoEmpresa(empresa: any): string {
  const linha = [
    empresa.endereco_logradouro,
    empresa.endereco_numero,
    empresa.endereco_complemento,
  ].filter(Boolean).join(', ')
  const bairroCidade = [
    empresa.endereco_bairro,
    [empresa.cidade, empresa.estado].filter(Boolean).join(' / '),
  ].filter(Boolean).join(' - ')
  return [linha, bairroCidade, empresa.cep].filter(Boolean).join(' · ') || '—'
}
