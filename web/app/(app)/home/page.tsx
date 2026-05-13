/**
 * Home — paridade operacional com o legado cecopel-gestao.
 *
 * Layout:
 *   - Saudação + data + atalhos rápidos
 *   - 4 KPIs reais (Pendentes / Atrasadas / Em andamento / Msgs não lidas)
 *   - Calendário do mês (entregas marcadas) + Minhas Tarefas (lado a lado)
 *   - Mural + Chat preview (abaixo)
 *
 * Foco: densidade de informação, decisão em 1 olhada. Sem orb decorativo no topo.
 */

import Link from 'next/link'
import { Bell, Newspaper, MessagesSquare, AlertTriangle, Sparkles } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, Avatar, Pill, Button, Empty } from '@/components/ui'
import { saudacao, dateLongBR, ago } from '@/lib/utils'
import { CalendarioMes, type DiaEntregas } from '@/components/home/calendario-mes'
import { MinhasTarefas, type MinhasTarefasItem } from '@/components/home/minhas-tarefas'

export const revalidate = 30

export default async function HomePage() {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const { data: profile } = await supabase
    .from('profiles').select('nome, avatar_url').eq('id', userId).single()
  const nome = profile?.nome ?? ''

  // ── Mês corrente ──
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = agora.getMonth() + 1   // 1-12
  const mesInicio = new Date(ano, mes - 1, 1).toISOString()
  const mesFim    = new Date(ano, mes, 0, 23, 59, 59).toISOString()
  const hojeIso   = agora.toISOString().slice(0, 10)

  // ── Queries em paralelo (4 KPIs + entregas do mês pro calendário + tarefas) ──
  const [
    { count: kpiPendentes },
    { count: kpiAtrasadas },
    { count: kpiEmAndamento },
    { count: kpiMsgsNaoLidas },
    { data: entregasMes },
    { data: minhasTarefas },
    { data: muralPosts },
    { data: chatCanais },
  ] = await Promise.all([
    supabase.from('entregas').select('*', { count: 'exact', head: true })
      .eq('org_id', ctx.org_id).eq('responsavel_id', userId).eq('status', 'pendente'),
    supabase.from('entregas').select('*', { count: 'exact', head: true })
      .eq('org_id', ctx.org_id).eq('responsavel_id', userId).eq('status', 'atrasada'),
    supabase.from('entregas').select('*', { count: 'exact', head: true })
      .eq('org_id', ctx.org_id).eq('responsavel_id', userId).eq('status', 'em_andamento'),
    supabase.from('chat_membros').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).gt('updated_at', new Date(Date.now() - 86400000).toISOString()),

    supabase.from('entregas')
      .select('id, prazo_legal, status')
      .eq('org_id', ctx.org_id)
      .gte('prazo_legal', mesInicio.slice(0, 10))
      .lte('prazo_legal', mesFim.slice(0, 10)),

    supabase.from('kanban_tarefas')
      .select(`
        id, titulo, departamento, prazo, status::text,
        empresas!empresa_id(razao_social, nome_fantasia)
      `)
      .eq('org_id', ctx.org_id)
      .eq('responsavel_id', userId)
      .in('status', ['a_fazer','em_andamento'])
      .order('prazo', { ascending: true, nullsFirst: false })
      .limit(8),

    supabase.from('mural_posts')
      .select('id, autor_tipo, autor_nome, categoria, titulo, conteudo, fixado, created_at, autor_id, profiles!autor_id(nome)')
      .eq('org_id', ctx.org_id).is('deleted_at', null)
      .order('fixado', { ascending: false }).order('created_at', { ascending: false }).limit(3),

    supabase.from('chat_canais')
      .select('id, tipo, nome, ultima_mensagem_em')
      .eq('org_id', ctx.org_id)
      .order('ultima_mensagem_em', { ascending: false, nullsFirst: false }).limit(5),
  ])

  // Agrupa entregas por dia pro calendário
  const mapDias = new Map<string, DiaEntregas>()
  for (const e of (entregasMes ?? [])) {
    if (!e.prazo_legal) continue
    const dataIso = String(e.prazo_legal)
    let d = mapDias.get(dataIso)
    if (!d) { d = { data: dataIso, atrasadas:0, hoje:0, no_prazo:0, pendentes:0, outras:0 }; mapDias.set(dataIso, d) }
    if (e.status === 'atrasada') d.atrasadas++
    else if (dataIso === hojeIso && e.status !== 'entregue') d.hoje++
    else if (e.status === 'entregue') d.no_prazo++
    else if (e.status === 'pendente' || e.status === 'em_andamento') d.pendentes++
    else d.outras++
  }
  const diasComDados = Array.from(mapDias.values())

  const tarefasMap: MinhasTarefasItem[] = (minhasTarefas ?? []).map((t: any) => {
    const emp = Array.isArray(t.empresas) ? t.empresas[0] : t.empresas
    return {
      id: t.id,
      titulo: t.titulo,
      cliente: emp ? (emp.nome_fantasia || emp.razao_social) : null,
      departamento: t.departamento,
      prazo: t.prazo,
      status: t.status,
    }
  })

  return (
    <div className="space-y-5">
      {/* ── Header denso: saudação + ações ── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            {dateLongBR(agora)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">
            {saudacao()}, {nome.split(' ')[0] || 'colaborador'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={Sparkles} className="ring-1 ring-mind-200">
            Cmd+K
          </Button>
          <Button size="sm" variant="ghost" icon={Bell} aria-label="Notificações" />
        </div>
      </div>

      {/* ── 4 KPIs reais ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Pendentes"      valor={kpiPendentes ?? 0}      tone="neutral" />
        <KPI label="Atrasadas"      valor={kpiAtrasadas ?? 0}      tone="danger" />
        <KPI label="Em andamento"   valor={kpiEmAndamento ?? 0}    tone="info" />
        <KPI label="Msgs não lidas" valor={kpiMsgsNaoLidas ?? 0}   tone="neutral" />
      </div>

      {/* ── Calendário + Tarefas (paridade legado) ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CalendarioMes ano={ano} mes={mes} diasComDados={diasComDados} />
        <MinhasTarefas tarefas={tarefasMap} />
      </div>

      {/* ── Mural + Chat (linha de baixo) ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Newspaper size={18} className="text-ink-700" />
              <p className="font-semibold text-sm text-ink-900">Mural interno</p>
            </div>
            <Link href="/mural" prefetch={false} className="text-xs font-medium text-mind-700 hover:text-mind-900">
              Ver tudo →
            </Link>
          </div>
          <div className="divide-y divide-black/5 px-5">
            {(!muralPosts || muralPosts.length === 0) ? (
              <Empty icon={Newspaper} title="Sem posts" description="Quando alguém postar, aparece aqui." />
            ) : (
              muralPosts.map((p: any) => {
                const autorRel = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles
                const autorNome = p.autor_tipo === 'sistema' ? 'Sistema' : (p.autor_nome ?? autorRel?.nome ?? '—')
                return (
                  <div key={p.id} className="py-3.5">
                    <div className="mb-1 flex items-center gap-2.5">
                      <Avatar nome={autorNome} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-900 truncate">{autorNome}</p>
                        <p className="text-[11px] text-ink-400">{ago(p.created_at)}{p.fixado && ' · fixado'}</p>
                      </div>
                      {p.categoria === 'importante' && (
                        <Pill className="bg-gold-50 text-gold-700 ring-gold-100"><AlertTriangle size={10} className="mr-1 inline" /> Importante</Pill>
                      )}
                    </div>
                    {p.titulo && <p className="text-sm font-medium text-ink-900">{p.titulo}</p>}
                    <p className="text-sm leading-snug text-ink-700 line-clamp-2">{p.conteudo}</p>
                  </div>
                )
              })
            )}
          </div>
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <MessagesSquare size={18} className="text-ink-700" />
              <p className="font-semibold text-sm text-ink-900">Chat</p>
            </div>
            <Link href="/chat" prefetch={false} className="text-xs font-medium text-mind-700 hover:text-mind-900">
              Abrir →
            </Link>
          </div>
          <div className="divide-y divide-black/5 px-5">
            {(!chatCanais || chatCanais.length === 0) ? (
              <Empty icon={MessagesSquare} title="Sem conversas" description="Os canais que você participa aparecem aqui." />
            ) : (
              chatCanais.map((c: any) => (
                <Link
                  key={c.id}
                  href={`/chat/${c.id}`}
                  prefetch={false}
                  className="flex items-center justify-between py-3 hover:bg-ink-50/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900 truncate">{c.nome ?? c.tipo}</p>
                    <p className="text-[11px] text-ink-400">{c.ultima_mensagem_em ? ago(c.ultima_mensagem_em) : 'sem mensagens'}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── KPI compacto ──
function KPI({
  label, valor, tone,
}: {
  label: string
  valor: number
  tone: 'neutral' | 'danger' | 'info'
}) {
  const ring = {
    neutral: 'ring-black/5',
    danger:  'ring-rose-200 bg-rose-50/40',
    info:    'ring-sky-200 bg-sky-50/30',
  }[tone]
  const valorColor = {
    neutral: 'text-ink-900',
    danger:  'text-rose-700',
    info:    'text-sky-800',
  }[tone]
  return (
    <div className={`rounded-xl bg-white p-5 ring-1 ring-inset ${ring}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${valorColor}`}>{valor}</p>
    </div>
  )
}
