import Link from 'next/link'
import { ArrowRight, CreditCard, Palette, SlidersHorizontal, Sparkles, Users } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Avatar, Card, CardHeader, Pill, Stat } from '@/components/ui'
import { brl } from '@/lib/utils'
import { ConfigTabs, ConvidarMembroForm, EmpresasShortcut, MembroActions, TabPanel, WhiteLabelForm } from './actions'

const eventos = [
  'entrega_no_prazo',
  'entrega_antecipada',
  'entrega_atrasada',
  'nps_alto',
  'nps_baixo',
  'ajudou_colega',
  'mentoria',
  'ajuste_manual',
]

export default async function ConfiguracoesPage() {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  const [{ data: org }, { data: membros }, { count: empresasCount }, { data: regras }] = await Promise.all([
    supabase
      .from('orgs')
      .select('id, nome, cor_primaria, logo_url, tv_token, planos(nome, codigo, preco_mensal_cents, limite_usuarios, limite_empresas, limite_storage_gb)')
      .eq('id', ctx.org_id)
      .single(),
    supabase
      .from('org_membros')
      .select('id, user_id, role, status, profiles!user_id(id, nome, email, avatar_url)')
      .eq('org_id', ctx.org_id)
      .order('status')
      .order('role'),
    supabase
      .from('empresas')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', ctx.org_id)
      .eq('status', 'ativa'),
    supabase
      .from('regras_pontuacao_org')
      .select('evento, pontos, ativo')
      .eq('org_id', ctx.org_id),
  ])

  const plano = Array.isArray((org as any)?.planos) ? (org as any).planos[0] : (org as any)?.planos
  const membrosAtivos = (membros ?? []).filter(m => m.status === 'ativo')
  const regrasMap = new Map((regras ?? []).map(r => [r.evento, r]))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Configurações</h1>
        <p className="mt-1 text-sm text-ink-500">Equipe, empresas, white-label, plano e regras de pontuação.</p>
      </div>

      <Link
        href="/configuracoes/cortex"
        className="flex items-center justify-between gap-3 rounded-lg border border-mind-300 bg-gradient-to-r from-mind-50 to-white px-4 py-3 transition hover:border-mind-500 hover:shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-mind-100 p-2">
            <Sparkles size={16} className="text-mind-700" />
          </div>
          <div>
            <p className="text-sm font-medium text-ink-900">Permissões do Cortex</p>
            <p className="text-xs text-ink-500">Controle quais ações o agente pode propor para cada role.</p>
          </div>
        </div>
        <ArrowRight size={16} className="text-mind-500" />
      </Link>

      <ConfigTabs>
        <TabPanel tab="equipe">
          <Card>
            <CardHeader title="Equipe" subtitle={`${membrosAtivos.length} membro${membrosAtivos.length === 1 ? '' : 's'} ativo${membrosAtivos.length === 1 ? '' : 's'}`} icon={Users} />
            <ConvidarMembroForm token={session.access_token} />
            <div className="mt-4 overflow-hidden rounded-lg border border-black/10">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-black/10">
                  {(membros ?? []).map(m => {
                    const profile = Array.isArray((m as any).profiles) ? (m as any).profiles[0] : (m as any).profiles
                    const nome = profile?.nome || profile?.email || 'Colaborador'
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar nome={nome} src={profile?.avatar_url} />
                            <div>
                              <p className="font-medium text-ink-900">{nome}</p>
                              <p className="text-xs text-ink-500">{profile?.email ?? '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><Pill className="bg-ink-100 text-ink-700 ring-ink-200">{m.status}</Pill></td>
                        <td className="px-4 py-3 text-right"><MembroActions token={session.access_token} membroId={m.id} role={m.role} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabPanel>

        <TabPanel tab="empresas">
          <Card>
            <CardHeader title="Empresas" subtitle="Cadastro de clientes atendidos pela org" />
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-ink-600">{empresasCount ?? 0} empresa{empresasCount === 1 ? '' : 's'} ativa{empresasCount === 1 ? '' : 's'}.</p>
              <EmpresasShortcut />
            </div>
          </Card>
        </TabPanel>

        <TabPanel tab="white-label">
          <Card>
            <CardHeader title="White-label" subtitle="Identidade visual aplicada ao escritório" icon={Palette} />
            <WhiteLabelForm token={session.access_token} cor={org?.cor_primaria ?? '#10B981'} logo={org?.logo_url} />
            {org?.tv_token && (
              <div className="mt-4 rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
                Modo TV: <span className="font-mono">/tv?token={org.tv_token}</span>
              </div>
            )}
          </Card>
        </TabPanel>

        <TabPanel tab="plano">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Stat label="Plano atual" value={plano?.nome ?? '—'} sub={plano?.codigo ?? 'sem código'} accent="brand" />
            <Stat label="Valor mensal" value={plano ? brl(plano.preco_mensal_cents) : '—'} sub="Cobrança externa" accent="gold" />
            <Stat label="Empresas" value={`${empresasCount ?? 0}/${plano?.limite_empresas ?? '∞'}`} sub="Uso do limite" />
          </div>
          <Card className="mt-4">
            <CardHeader title="Upgrade" subtitle="Cobrança Stripe/Pagar.me entra em iteração posterior" icon={CreditCard} />
            <p className="text-sm text-ink-500">O link de upgrade fica como placeholder até o módulo financeiro definitivo ser ativado.</p>
          </Card>
        </TabPanel>

        <TabPanel tab="pontuacao">
          <Card>
            <CardHeader title="Regras de pontuação" subtitle="Overrides da org; eventos sem registro usam padrão global do backend" icon={SlidersHorizontal} />
            <div className="mb-3">
              <Link href="/configuracoes/departamentos" className="text-sm font-medium text-brand-700 hover:text-brand-900">Configurar departamentos e premiações</Link>
            </div>
            <div className="overflow-hidden rounded-lg border border-black/10">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
                  <tr><th className="px-4 py-3 text-left">Evento</th><th className="px-4 py-3 text-right">Pontos</th><th className="px-4 py-3 text-left">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {eventos.map(evento => {
                    const regra = regrasMap.get(evento)
                    return (
                      <tr key={evento}>
                        <td className="px-4 py-3 font-mono text-xs text-ink-700">{evento}</td>
                        <td className="px-4 py-3 text-right text-ink-900">{regra?.pontos ?? 'Padrão'}</td>
                        <td className="px-4 py-3"><Pill className={regra?.ativo === false ? 'bg-ink-100 text-ink-500 ring-ink-200' : 'bg-emerald-100 text-emerald-900 ring-emerald-300'}>{regra ? (regra.ativo ? 'Ativo' : 'Inativo') : 'Global'}</Pill></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabPanel>
      </ConfigTabs>
    </div>
  )
}
