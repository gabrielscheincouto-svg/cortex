import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, Clock, FileText, MessageSquareText, Paperclip, Star, UserRound, type LucideIcon } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Avatar, Card, CardHeader, Empty, Pill } from '@/components/ui'
import { ago, dateBR, timeBR } from '@/lib/utils'
import { MensagemComposer, SolicitacaoActions } from './actions'

const prioridadePill: Record<string, string> = {
  baixa: 'bg-ink-100 text-ink-700 ring-ink-200',
  media: 'bg-blue-100 text-blue-900 ring-blue-300',
  alta: 'bg-amber-100 text-amber-900 ring-amber-300',
  muito_alta: 'bg-rose-100 text-rose-900 ring-rose-300',
}

const statusPill: Record<string, string> = {
  nova: 'bg-amber-100 text-amber-900 ring-amber-300',
  em_atendimento: 'bg-blue-100 text-blue-900 ring-blue-300',
  aguardando_cliente: 'bg-purple-100 text-purple-900 ring-purple-300',
  resolvida: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  fechada: 'bg-ink-100 text-ink-500 ring-ink-200',
  cancelada: 'bg-ink-100 text-ink-500 ring-ink-200',
}

export default async function SolicitacaoDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  const { data: solicitacao } = await supabase
    .from('solicitacoes')
    .select(`
      id, org_id, empresa_id, entrega_id, assunto, descricao, prioridade, status,
      origem, departamento_sugerido, criada_por_user_id, criada_por_nome, criada_por_email,
      responsavel_id, atribuida_em, sla_resposta_horas, sla_resolucao_horas,
      primeira_resposta_em, resolvida_em, fechada_em, avaliacao_estrelas,
      avaliacao_comentario, avaliacao_em, created_at, updated_at,
      empresas(id, razao_social, nome_fantasia, cnpj)
    `)
    .eq('org_id', ctx.org_id)
    .eq('id', params.id)
    .maybeSingle()

  if (!solicitacao) return notFound()

  const [{ data: mensagens }, { data: anexos }, { data: membros }, { data: responsavel }] = await Promise.all([
    supabase
      .from('solicitacao_mensagens')
      .select('id, solicitacao_id, autor_id, autor_tipo, autor_nome, conteudo, interna, criado_em')
      .eq('org_id', ctx.org_id)
      .eq('solicitacao_id', solicitacao.id)
      .order('criado_em', { ascending: true }),
    supabase
      .from('solicitacao_anexos')
      .select('id, solicitacao_id, mensagem_id, nome_original, storage_path, mime_type, tamanho_bytes, criado_em')
      .eq('org_id', ctx.org_id)
      .eq('solicitacao_id', solicitacao.id)
      .order('criado_em', { ascending: true }),
    supabase
      .from('org_membros')
      .select('user_id, role')
      .eq('org_id', ctx.org_id)
      .eq('status', 'ativo')
      .order('role'),
    solicitacao.responsavel_id
      ? supabase.from('profiles').select('id, nome, email, avatar_url').eq('id', solicitacao.responsavel_id).maybeSingle()
      : Promise.resolve({ data: null as any }),
  ])

  const membroIds = Array.from(new Set((membros ?? []).map(m => m.user_id).filter(Boolean))) as string[]
  const { data: profiles } = membroIds.length
    ? await supabase.from('profiles').select('id, nome, email, avatar_url').in('id', membroIds)
    : { data: [] as any[] }
  const profileById = new Map((profiles ?? []).map(p => [p.id, p]))
  const membrosOptions = (membros ?? []).map(m => {
    const profile = profileById.get(m.user_id)
    return {
      id: m.user_id,
      nome: profile?.nome || profile?.email || 'Colaborador',
      role: m.role,
    }
  })

  const anexosPorMensagem = new Map<string, any[]>()
  ;(anexos ?? []).forEach(a => {
    if (!a.mensagem_id) return
    const atuais = anexosPorMensagem.get(a.mensagem_id) ?? []
    atuais.push(a)
    anexosPorMensagem.set(a.mensagem_id, atuais)
  })
  const anexosDoTicket = (anexos ?? []).filter(a => !a.mensagem_id)
  const empresa = Array.isArray((solicitacao as any).empresas) ? (solicitacao as any).empresas[0] : (solicitacao as any).empresas

  return (
    <div className="space-y-6">
      <Link href="/solicitacoes" className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Voltar para solicitações
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Pill className={statusPill[solicitacao.status]}>{solicitacao.status.replace('_', ' ')}</Pill>
            <Pill className={prioridadePill[solicitacao.prioridade]}>{solicitacao.prioridade.replace('_', ' ')}</Pill>
            <span className="text-xs text-ink-500">Aberta {ago(solicitacao.created_at)}</span>
          </div>
          <h1 className="text-2xl font-semibold text-ink-900">{solicitacao.assunto}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {empresa?.razao_social ?? solicitacao.criada_por_nome ?? 'Solicitante sem empresa'} · origem {solicitacao.origem.replace('_', ' ')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Conversa" subtitle="Mensagens públicas e notas internas" icon={MessageSquareText} />
            {solicitacao.descricao && (
              <div className="mb-5 rounded-lg border border-black/10 bg-ink-50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Descrição inicial</p>
                <p className="whitespace-pre-line text-sm leading-6 text-ink-800">{solicitacao.descricao}</p>
              </div>
            )}

            {!mensagens || mensagens.length === 0 ? (
              <Empty icon={MessageSquareText} title="Ainda não há mensagens" description="A primeira resposta do escritório aparecerá aqui." />
            ) : (
              <div className="space-y-4">
                {mensagens.map(m => (
                  <MessageItem key={m.id} mensagem={m} anexos={anexosPorMensagem.get(m.id) ?? []} />
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Adicionar mensagem" subtitle="Responda ao cliente ou registre uma nota privada" />
            <MensagemComposer id={solicitacao.id} token={session.access_token} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Atendimento" subtitle="Status, prioridade e responsável" />
            <SolicitacaoActions
              id={solicitacao.id}
              token={session.access_token}
              status={solicitacao.status}
              prioridade={solicitacao.prioridade}
              responsavelId={solicitacao.responsavel_id}
              membros={membrosOptions}
            />
          </Card>

          <Card>
            <CardHeader title="Detalhes" subtitle="Contexto do chamado" />
            <dl className="space-y-3 text-sm">
              <Mini icon={Building2} label="Empresa" value={empresa?.razao_social ?? '—'} />
              <Mini icon={FileText} label="CNPJ" value={empresa?.cnpj ?? '—'} mono />
              <Mini icon={UserRound} label="Solicitante" value={solicitacao.criada_por_nome ?? solicitacao.criada_por_email ?? '—'} />
              <Mini icon={Clock} label="Aberta em" value={`${dateBR(solicitacao.created_at)} às ${timeBR(solicitacao.created_at)}`} />
              <Mini icon={Clock} label="Primeira resposta" value={solicitacao.primeira_resposta_em ? dateBR(solicitacao.primeira_resposta_em) : '—'} />
            </dl>
            {responsavel && (
              <div className="mt-4 flex items-center gap-3 rounded-lg bg-ink-50 p-3">
                <Avatar nome={responsavel.nome || responsavel.email || 'Responsável'} src={responsavel.avatar_url} />
                <div>
                  <p className="text-sm font-medium text-ink-900">{responsavel.nome || responsavel.email}</p>
                  <p className="text-xs text-ink-500">Responsável atual</p>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Avaliação" subtitle="NPS ao fim do atendimento" icon={Star} />
            {solicitacao.avaliacao_estrelas ? (
              <div>
                <div className="mb-2 flex gap-1 text-gold-500">
                  {Array.from({ length: solicitacao.avaliacao_estrelas }).map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </div>
                {solicitacao.avaliacao_comentario && (
                  <p className="text-sm leading-6 text-ink-700">{solicitacao.avaliacao_comentario}</p>
                )}
                {solicitacao.avaliacao_em && <p className="mt-2 text-xs text-ink-500">Avaliado em {dateBR(solicitacao.avaliacao_em)}</p>}
              </div>
            ) : (
              <p className="text-sm text-ink-400">Sem avaliação registrada ainda.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Anexos" subtitle="Arquivos enviados no ticket" icon={Paperclip} />
            {anexosDoTicket.length === 0 ? (
              <p className="text-sm text-ink-400">Nenhum anexo avulso.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {anexosDoTicket.map(a => (
                  <li key={a.id} className="flex items-center gap-2 text-ink-700">
                    <Paperclip size={14} /> {a.nome_original}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function MessageItem({ mensagem, anexos }: { mensagem: any; anexos: any[] }) {
  const isCliente = mensagem.autor_tipo === 'cliente'
  const isInterna = mensagem.interna
  const nome = mensagem.autor_nome || (isCliente ? 'Cliente' : mensagem.autor_tipo === 'sistema' ? 'Sistema' : 'Escritório')
  return (
    <article className={`rounded-lg border p-4 ${
      isInterna
        ? 'border-amber-200 bg-amber-50'
        : isCliente
          ? 'border-black/10 bg-white'
          : 'border-blue-100 bg-blue-50/50'
    }`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar nome={nome} />
          <div>
            <p className="text-sm font-medium text-ink-900">{nome}</p>
            <p className="text-xs text-ink-500">{dateBR(mensagem.criado_em)} às {timeBR(mensagem.criado_em)}</p>
          </div>
        </div>
        {isInterna && <Pill className="bg-amber-100 text-amber-900 ring-amber-300">Nota interna</Pill>}
      </div>
      <p className="whitespace-pre-line text-sm leading-6 text-ink-800">{mensagem.conteudo}</p>
      {anexos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {anexos.map(a => (
            <Pill key={a.id} className="bg-white text-ink-700 ring-black/10">
              <Paperclip size={12} className="mr-1" /> {a.nome_original}
            </Pill>
          ))}
        </div>
      )}
    </article>
  )
}

function Mini({ icon: Icon, label, value, mono }: { icon: LucideIcon; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="mt-0.5 text-ink-400" />
      <div>
        <dt className="text-xs text-ink-500">{label}</dt>
        <dd className={`text-ink-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
      </div>
    </div>
  )
}
