import Link from 'next/link'
import {
  Flame, Award, Bell, Settings, ShieldCheck, AlertTriangle, Star, MessageCircle, Newspaper, MessagesSquare, Plus, Edit,
} from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, Stat, Avatar, Pill, Button, Empty } from '@/components/ui'
import { saudacao, dateLongBR, timeBR, ago } from '@/lib/utils'

// Mapa de ícones por código de conquista — ajuda dar consistência sem chamadas extras
const conquistaIcon: Record<string, { Icon: any; classes: string }> = {
  pontual_aco:        { Icon: ShieldCheck,    classes: 'bg-gold-50 text-gold-700' },
  pontual_prata:      { Icon: ShieldCheck,    classes: 'bg-ink-100 text-ink-600' },
  pontual_bronze:     { Icon: ShieldCheck,    classes: 'bg-gold-50 text-gold-700' },
  salvador_multa:     { Icon: AlertTriangle,  classes: 'bg-amber-50 text-amber-700' },
  mestre_tributarista:{ Icon: Award,          classes: 'bg-rose-50 text-rose-700' },
  comunicador:        { Icon: MessageCircle,  classes: 'bg-emerald-50 text-emerald-700' },
}
const fallbackIcon = { Icon: Award, classes: 'bg-ink-100 text-ink-600' }

export default async function HomePage() {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, avatar_url')
    .eq('id', userId)
    .single()
  const nome = profile?.nome ?? ''

  // KPIs pessoais — agregações simples (em produção, podemos cache em telemetria)
  const mesInicio = new Date()
  mesInicio.setDate(1); mesInicio.setHours(0, 0, 0, 0)

  const [
    { count: entregasMes },
    { count: entregasMesNoPrazo },
    { count: entregasPendentes },
    { data: pontosEvts },
    { data: rankingPos },
    { data: conquistasUser },
    { data: muralPosts },
    { data: chatCanais },
    { data: deptConfig },
  ] = await Promise.all([
    supabase.from('entregas').select('*', { count: 'exact', head: true }).eq('responsavel_id', userId).eq('org_id', ctx.org_id).gte('created_at', mesInicio.toISOString()),
    supabase.from('entregas').select('*', { count: 'exact', head: true }).eq('responsavel_id', userId).eq('org_id', ctx.org_id).gte('created_at', mesInicio.toISOString()).eq('status', 'entregue'),
    supabase.from('entregas').select('*', { count: 'exact', head: true }).eq('responsavel_id', userId).eq('org_id', ctx.org_id).in('status', ['pendente','em_andamento','aguardando_cliente']),
    supabase.from('pontos_eventos').select('pontos').eq('user_id', userId).eq('org_id', ctx.org_id).gte('created_at', mesInicio.toISOString()),
    supabase.from('ranking_periodos').select('posicao, pontos').eq('user_id', userId).eq('org_id', ctx.org_id).eq('tipo', 'semanal').order('calculado_em', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('conquistas_usuario').select('desbloqueada_em, conquistas_catalogo(codigo, nome)').eq('user_id', userId).eq('org_id', ctx.org_id).order('desbloqueada_em', { ascending: false }).limit(4),
    supabase.from('mural_posts').select('id, autor_tipo, autor_nome, categoria, titulo, conteudo, fixado, created_at, autor_id, profiles!autor_id(nome)').eq('org_id', ctx.org_id).is('deleted_at', null).order('fixado', { ascending: false }).order('created_at', { ascending: false }).limit(3),
    supabase.from('chat_canais').select('id, tipo, nome, ultima_mensagem_em, chat_mensagens(conteudo, autor_id, criada_em, profiles!autor_id(nome))').eq('org_id', ctx.org_id).order('ultima_mensagem_em', { ascending: false, nullsFirst: false }).limit(5),
    supabase.from('org_departamentos').select('premiacao_modo').eq('org_id', ctx.org_id).eq('codigo', ctx.my_role).maybeSingle(),
  ])

  const pontosMes = pontosEvts?.reduce((sum, p) => sum + p.pontos, 0) ?? 0
  const percNoPrazo = entregasMes && entregasMes > 0
    ? Math.round((entregasMesNoPrazo ?? 0) / entregasMes * 100)
    : null

  // Streak simulado: ainda não há tabela; calcular depois via SQL ou worker
  const streak = 0

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-500">{dateLongBR(new Date())} · {timeBR(new Date())}</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">{saudacao()}, {nome.split(' ')[0] || 'colaborador'}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" icon={Bell} size="sm" aria-label="Notificações" />
          <Button variant="ghost" icon={Settings} size="sm" aria-label="Configurações" />
        </div>
      </div>

      {/* Card de gamificação */}
      <Card className="border-l-4 border-l-gold-500 p-6">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar nome={nome} size="lg" src={profile?.avatar_url} />
          <div className="flex-1 min-w-[180px]">
            <p className="text-base font-semibold text-ink-900">{nome}</p>
            <p className="mt-0.5 text-sm text-ink-500">{rolePtBr(ctx.my_role)}</p>
            {deptConfig?.premiacao_modo && (
              <Pill className={deptConfig.premiacao_modo === 'automatico' ? 'mt-2 bg-emerald-100 text-emerald-900 ring-emerald-300' : 'mt-2 bg-amber-100 text-amber-900 ring-amber-300'}>
                {deptConfig.premiacao_modo === 'automatico' ? 'Pontos lançados automaticamente' : 'Aguardando fechamento manual do gerente'}
              </Pill>
            )}
          </div>

          <div className="flex items-center gap-6 border-l border-black/10 pl-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Sequência no prazo</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold text-gold-500">{streak}</span>
                <span className="text-xs text-ink-400">dias</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Pontos do mês</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-ink-900">{pontosMes.toLocaleString('pt-BR')}</span>
                <span className="text-xs text-ink-400">
                  {rankingPos?.posicao ? `${rankingPos.posicao}º lugar` : 'sem ranking ainda'}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="my-4 h-px bg-black/5" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Conquistas recentes</p>
            {conquistasUser && conquistasUser.length > 0 ? (
              <div className="flex gap-2">
                {conquistasUser.map((cu, i) => {
                  const cat = Array.isArray(cu.conquistas_catalogo) ? cu.conquistas_catalogo[0] : cu.conquistas_catalogo
                  const { Icon, classes } = conquistaIcon[cat?.codigo ?? ''] ?? fallbackIcon
                  return (
                    <span key={i} title={cat?.nome} className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${classes}`}>
                      <Icon size={16} />
                    </span>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-ink-400">Conquiste a primeira concluindo uma entrega</p>
            )}
          </div>

          <div className="min-w-[220px] max-w-[300px] flex-1">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs text-ink-400">Para a próxima conquista</span>
              <span className="text-xs font-medium text-ink-700">— / —</span>
            </div>
            <div className="h-1.5 rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-gold-500" style={{ width: '0%' }} />
            </div>
          </div>
        </div>
      </Card>

      {/* KPIs pessoais */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Entregas no mês" value={(entregasMes ?? 0).toString()} sub={`${entregasPendentes ?? 0} pendentes`} />
        <Stat label="No prazo" value={percNoPrazo != null ? `${percNoPrazo}%` : '—'} sub="Mês atual" valueColor="text-emerald-700" />
        <Stat label="Pontos do mês" value={pontosMes.toLocaleString('pt-BR')} sub="Acumulado" accent="gold" />
        <Stat label="Ranking" value={rankingPos?.posicao ? `${rankingPos.posicao}º` : '—'} sub="Semanal" />
      </div>

      {/* Mural + Chat lado-a-lado */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Mural */}
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Newspaper size={18} className="text-ink-700" />
              <p className="font-semibold text-sm text-ink-900">Mural interno</p>
            </div>
            <Link href="/mural"><Button size="sm" variant="ghost" icon={Plus}>Postar</Button></Link>
          </div>
          <div className="divide-y divide-black/5 px-5">
            {(!muralPosts || muralPosts.length === 0) ? (
              <Empty icon={Newspaper} title="Sem posts ainda" description="Quando alguém postar no mural, aparecerá aqui." />
            ) : (
              muralPosts.map(p => {
                const autorRel = Array.isArray(p.profiles) ? p.profiles[0] : (p as any).profiles
                const autorNome = p.autor_tipo === 'sistema' ? 'Sistema' : (p.autor_nome ?? autorRel?.nome ?? '—')
                return (
                  <div key={p.id} className="py-4">
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <Avatar nome={autorNome} size="sm" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-ink-900">{autorNome}</p>
                        <p className="text-[11px] text-ink-400">{ago(p.created_at)}{p.fixado && ' · fixado'}</p>
                      </div>
                      {p.categoria === 'importante' && (
                        <Pill className="bg-gold-50 text-gold-700 ring-gold-100">Importante</Pill>
                      )}
                    </div>
                    {p.titulo && <p className="text-sm font-medium text-ink-900">{p.titulo}</p>}
                    <p className="text-sm leading-relaxed text-ink-700 line-clamp-3">{p.conteudo}</p>
                  </div>
                )
              })
            )}
          </div>
        </Card>

        {/* Chat */}
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <MessagesSquare size={18} className="text-ink-700" />
              <p className="font-semibold text-sm text-ink-900">Chat interno</p>
            </div>
            <Link href="/chat"><Button size="sm" variant="ghost" icon={Edit}>Novo</Button></Link>
          </div>
          <div className="p-2">
            {(!chatCanais || chatCanais.length === 0) ? (
              <Empty icon={MessagesSquare} title="Sem conversas" description="Inicie uma conversa com um colega ou abra um canal de departamento." />
            ) : (
              chatCanais.map(c => {
                const ultMsg = (c.chat_mensagens as any[] | undefined)?.[0]
                const nomeCanal = c.tipo === 'dm' ? '(DM)' : (c.nome ?? `#${c.tipo}`)
                return (
                  <Link key={c.id} href={`/chat/${c.id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-ink-50">
                    <Avatar nome={nomeCanal} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink-900">
                        <span>{nomeCanal}</span>
                        <span className="text-[11px] font-normal text-ink-400">{c.ultima_mensagem_em ? ago(c.ultima_mensagem_em) : ''}</span>
                      </p>
                      <p className="truncate text-xs text-ink-500">{ultMsg?.conteudo ?? 'sem mensagens'}</p>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function rolePtBr(role: string): string {
  return {
    admin: 'Administrador do escritório',
    gerente: 'Gerente',
    contabil: 'Departamento Contábil',
    fiscal: 'Departamento Fiscal',
    pessoal: 'Departamento Pessoal',
    societario: 'Departamento Societário',
    comercial: 'Comercial / Financeiro',
    visualizador: 'Visualizador',
  }[role] ?? role
}
