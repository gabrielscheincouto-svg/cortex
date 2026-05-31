import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, Calendar, FileText, User, Paperclip, Activity, MessageCircle } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, CardHeader, Pill, Avatar, Empty } from '@/components/ui'
import { dateBR, entregaStatusBadge, ago, departamentoLabel } from '@/lib/utils'

const eventoIcon: Record<string, string> = {
  criada: 'Entrega criada',
  arquivo_anexado: 'Arquivo anexado',
  enviada_cliente: 'Notificação enviada ao cliente',
  visualizada_cliente: 'Cliente visualizou no app',
  baixada_cliente: 'Cliente baixou arquivo',
  confirmada_cliente: 'Cliente confirmou recebimento',
  atrasada: 'Marcada como atrasada',
  justificada: 'Justificada',
  dispensada: 'Dispensada',
  reaberta: 'Reaberta',
  comentario: 'Comentário',
  em_andamento: 'Em andamento',
}

export default async function EntregaDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const { data: entrega } = await supabase
    .from('entregas')
    .select(`
      *,
      empresas(id, razao_social, nome_fantasia, cnpj),
      obrigacoes_catalogo(nome, codigo, descricao, base_legal),
      profiles!responsavel_id(nome, avatar_url),
      co:profiles!co_responsavel_id(nome, avatar_url)
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (!entrega) return notFound()

  const [{ data: arquivos }, { data: eventos }] = await Promise.all([
    supabase.from('entrega_arquivos')
      .select('id, nome_original, tipo, tamanho_bytes, origem, created_at, enviado_por_id, profiles!enviado_por_id(nome)')
      .eq('entrega_id', entrega.id)
      .order('created_at', { ascending: false }),
    supabase.from('entrega_eventos')
      .select('id, tipo, ator_id, ator_descricao, payload, criado_em, profiles!ator_id(nome)')
      .eq('entrega_id', entrega.id)
      .order('criado_em', { ascending: false })
      .limit(50),
  ])

  const emp = Array.isArray(entrega.empresas) ? entrega.empresas[0] : entrega.empresas
  const obr = Array.isArray(entrega.obrigacoes_catalogo) ? entrega.obrigacoes_catalogo[0] : entrega.obrigacoes_catalogo
  const resp = Array.isArray(entrega.profiles) ? entrega.profiles[0] : entrega.profiles
  const co = Array.isArray((entrega as any).co) ? (entrega as any).co[0] : (entrega as any).co
  const badge = entregaStatusBadge(entrega.status)

  return (
    <div className="space-y-6">
      <Link href="/entregas" className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Voltar para entregas
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            {departamentoLabel(entrega.departamento)} · competência {entrega.competencia}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">{obr?.nome ?? '—'}</h1>
          <p className="mt-1 text-sm text-ink-500">{emp?.razao_social ?? '—'} · CNPJ {emp?.cnpj ?? '—'}</p>
        </div>
        <Pill className={`${badge.classes} px-3 py-1 text-sm`}>{badge.label}</Pill>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Detalhes da entrega" />
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Row icon={Calendar}    label="Prazo legal"   value={dateBR(entrega.prazo_legal)} />
              <Row icon={Calendar}    label="Prazo técnico" value={dateBR(entrega.prazo_tecnico)} />
              <Row icon={FileText}    label="Protocolo"     value={entrega.protocolo ?? '—'} mono />
              <Row icon={Building2}   label="Empresa"       value={emp?.razao_social ?? '—'} />
              <Row icon={User}        label="Responsável"   value={resp?.nome ?? 'sem responsável'} />
              <Row icon={User}        label="Auxiliar"      value={co?.nome ?? 'sem auxiliar'} />
              <Row icon={Calendar}    label="Entregue em"   value={entrega.entregue_em ? dateBR(entrega.entregue_em) : '—'} />
            </dl>
            {obr?.descricao && (
              <div className="mt-4 border-t border-black/5 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Sobre a obrigação</p>
                <p className="mt-1.5 text-sm text-ink-700">{obr.descricao}</p>
                {obr.base_legal && <p className="mt-1 text-xs text-ink-400">Base legal: {obr.base_legal}</p>}
              </div>
            )}
            {entrega.observacoes && (
              <div className="mt-4 border-t border-black/5 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Observações</p>
                <p className="mt-1.5 text-sm text-ink-700 whitespace-pre-wrap">{entrega.observacoes}</p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader icon={Paperclip} title="Arquivos" subtitle={`${arquivos?.length ?? 0} anexo(s)`} />
            {(!arquivos || arquivos.length === 0) ? (
              <Empty icon={Paperclip} title="Sem arquivos ainda" description="O robô anexa automaticamente quando identifica um arquivo na pasta monitorada." />
            ) : (
              <ul className="divide-y divide-black/5">
                {arquivos.map(a => {
                  const enviadoPor = Array.isArray(a.profiles) ? a.profiles[0] : (a as any).profiles
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText size={16} className="shrink-0 text-ink-400" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink-900">{a.nome_original}</p>
                          <p className="text-xs text-ink-500">
                            {a.tipo} · {(a.tamanho_bytes / 1024).toFixed(0)} KB · {a.origem === 'robo_tauri' ? 'via robô' : enviadoPor?.nome ?? 'manual'} · {ago(a.created_at)}
                          </p>
                        </div>
                      </div>
                      <Pill className="bg-ink-100 text-ink-700 ring-ink-200">{a.tipo}</Pill>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader icon={Activity} title="Timeline" />
            {(!eventos || eventos.length === 0) ? (
              <p className="text-sm text-ink-400">Sem eventos ainda.</p>
            ) : (
              <ol className="relative space-y-3 border-l border-black/10 pl-4">
                {eventos.map(ev => {
                  const ator = Array.isArray(ev.profiles) ? ev.profiles[0] : (ev as any).profiles
                  return (
                    <li key={ev.id} className="relative">
                      <span className="absolute -left-[21px] top-1 inline-block h-2 w-2 rounded-full bg-brand-500 ring-2 ring-white" />
                      <p className="text-sm text-ink-900">{eventoIcon[ev.tipo] ?? ev.tipo}</p>
                      <p className="text-xs text-ink-500">
                        {ator?.nome ?? ev.ator_descricao ?? 'sistema'} · {ago(ev.criado_em)}
                      </p>
                    </li>
                  )
                })}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader icon={MessageCircle} title="Conversa vinculada" subtitle="Discussão sobre esta entrega" />
            <p className="text-sm text-ink-400">
              Em breve — quando o módulo de chat ficar ativo, um canal <span className="font-mono text-xs">#entrega-{entrega.id.slice(0, 8)}</span> conecta aqui.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-b border-black/5 pb-2.5 last:border-0 last:pb-0">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        <Icon size={12} /> {label}
      </dt>
      <dd className={`mt-1 text-ink-900 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</dd>
    </div>
  )
}
