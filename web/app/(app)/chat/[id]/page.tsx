import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Hash, MessageCircle, Users } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, Pill } from '@/components/ui'
import { departamentoLabel } from '@/lib/utils'
import { ChatThread, type ChatMessageView } from './thread'

const tipoIcon = {
  dm: MessageCircle,
  grupo: Users,
  departamento: Hash,
  entrega: Hash,
  empresa: Hash,
  geral: Hash,
}

export default async function ChatCanalPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const { data: { user } } = await supabase.auth.getUser()
  const { data: { session } } = await supabase.auth.getSession()
  if (!user || !session?.access_token) return null

  const { data: canal } = await supabase
    .from('chat_canais')
    .select('id, org_id, tipo, nome, descricao, departamento, entrega_id, empresa_id, ultima_mensagem_em, created_at')
    .eq('org_id', ctx.org_id)
    .eq('id', params.id)
    .maybeSingle()

  if (!canal) return notFound()

  const { data: mensagensDesc } = await supabase
    .from('chat_mensagens')
    .select('id, org_id, canal_id, autor_id, autor_nome, conteudo, mencoes, replied_to_id, criada_em')
    .eq('org_id', ctx.org_id)
    .eq('canal_id', canal.id)
    .is('deletada_em', null)
    .order('criada_em', { ascending: false })
    .limit(100)

  const mensagensBase = [...(mensagensDesc ?? [])].reverse()
  const mensagemIds = mensagensBase.map(m => m.id)
  const autorIds = Array.from(new Set(mensagensBase.map(m => m.autor_id).filter(Boolean))) as string[]

  const [{ data: anexos }, { data: autores }] = await Promise.all([
    mensagemIds.length
      ? supabase
          .from('chat_anexos')
          .select('id, mensagem_id, storage_path, nome_original, mime_type, tamanho_bytes, criado_em')
          .in('mensagem_id', mensagemIds)
          .order('criado_em')
      : Promise.resolve({ data: [] as any[] }),
    autorIds.length
      ? supabase
          .from('profiles')
          .select('id, nome, email, avatar_url')
          .in('id', autorIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const anexosPorMensagem = new Map<string, any[]>()
  ;(anexos ?? []).forEach(a => {
    const atuais = anexosPorMensagem.get(a.mensagem_id) ?? []
    atuais.push(a)
    anexosPorMensagem.set(a.mensagem_id, atuais)
  })
  const autorPorId = new Map((autores ?? []).map(a => [a.id, a]))
  const mensagens: ChatMessageView[] = mensagensBase.map(m => {
    const autor = m.autor_id ? autorPorId.get(m.autor_id) : null
    return {
      id: m.id,
      org_id: m.org_id,
      canal_id: m.canal_id,
      autor_id: m.autor_id ?? undefined,
      autor_nome: autor?.nome || m.autor_nome || autor?.email || 'Sistema',
      autor_email: autor?.email ?? undefined,
      avatar_url: autor?.avatar_url ?? undefined,
      conteudo: m.conteudo,
      mencoes: m.mencoes ?? [],
      replied_to_id: m.replied_to_id ?? undefined,
      criada_em: m.criada_em,
      anexos: anexosPorMensagem.get(m.id) ?? [],
    }
  })

  const Icon = tipoIcon[canal.tipo as keyof typeof tipoIcon] ?? MessageCircle
  const titulo = canal.tipo === 'dm'
    ? 'Conversa direta'
    : canal.tipo === 'departamento' ? `#dept-${canal.departamento ?? ''}`
    : canal.nome ?? `#${canal.tipo}`
  const subtitulo = canal.descricao
    || (canal.tipo === 'departamento' && canal.departamento ? `Canal do departamento ${departamentoLabel(canal.departamento)}` : null)
    || 'Canal interno do escritório'

  return (
    <div className="space-y-5">
      <Link href="/chat" className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Voltar para chat
      </Link>

      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-900 text-white">
          <Icon size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold text-ink-900">{titulo}</h1>
            <Pill className="bg-ink-100 text-ink-700 ring-ink-200">{canal.tipo}</Pill>
          </div>
          <p className="mt-1 text-sm text-ink-500">{subtitulo}</p>
        </div>
      </div>

      <Card className="p-0">
        <ChatThread
          canalId={canal.id}
          currentUserId={user.id}
          token={session.access_token}
          initialMessages={mensagens}
        />
      </Card>
    </div>
  )
}
