/**
 * Detalhe da Solicitação — conversa cliente ↔ escritório.
 *
 * Mostra os dados do formulário enviado, status, responsável e a conversa
 * cronológica (apenas mensagens não-internas — RLS 042 garante).
 *
 * Cliente pode enviar nova mensagem; vai como autor_tipo='cliente' e RLS 049
 * exige isso no INSERT.
 */
import { useState, useEffect, useRef, type FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, MessagesSquare, Send, Loader2, AlertTriangle, FileText, Clock, CheckCircle2,
} from 'lucide-react'
import { Card, CardHeader, Empty, Pill, Spinner, Button, Textarea, Avatar } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import {
  useSolicitacaoDetalhe, useSolicitacaoMensagens, useEnviarMensagem,
  type SolicitacaoStatus, type SolicitacaoMensagem,
} from '@/lib/queries'
import { ago, dateLongBR, cn } from '@/lib/utils'

const STATUS_LABEL: Record<SolicitacaoStatus, string> = {
  nova: 'Nova',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguardando você',
  resolvida: 'Resolvida',
  fechada: 'Fechada',
  cancelada: 'Cancelada',
}

const STATUS_PILL: Record<SolicitacaoStatus, string> = {
  nova: 'bg-mind-100 text-mind-800 ring-mind-200',
  em_atendimento: 'bg-gold-100 text-gold-800 ring-gold-200',
  aguardando_cliente: 'bg-rose-50 text-rose-800 ring-rose-200',
  resolvida: 'bg-brand-50 text-brand-800 ring-brand-200',
  fechada: 'bg-ink-100 text-ink-600 ring-black/10',
  cancelada: 'bg-ink-100 text-ink-500 ring-black/10',
}

export function SolicitacaoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, empresa } = useAuth()
  const solicitacao = useSolicitacaoDetalhe(id)
  const mensagens = useSolicitacaoMensagens(id)
  const enviar = useEnviarMensagem()
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const fimRef = useRef<HTMLDivElement>(null)

  // Auto-scroll pra última mensagem
  useEffect(() => {
    if (mensagens.data && mensagens.data.length > 0) {
      fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [mensagens.data?.length])

  if (solicitacao.isPending) {
    return <div className="flex items-center justify-center py-16"><Spinner size={24} /></div>
  }
  if (solicitacao.isError) {
    return (
      <Card>
        <Empty
          icon={AlertTriangle}
          title="Erro ao carregar a solicitação"
          description="Tente atualizar a página em alguns segundos."
          action={<Button variant="secondary" onClick={() => navigate('/solicitacoes')}>Voltar</Button>}
        />
      </Card>
    )
  }
  if (!solicitacao.data) {
    return (
      <Card>
        <Empty
          icon={MessagesSquare}
          title="Solicitação não encontrada"
          description="Pode ter sido removida ou você não tem permissão para vê-la."
          action={<Link to="/solicitacoes"><Button variant="secondary">Voltar</Button></Link>}
        />
      </Card>
    )
  }

  const sol = solicitacao.data
  const podeResponder = sol.status !== 'fechada' && sol.status !== 'cancelada'

  async function handleEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    if (texto.trim().length < 2 || !id) return
    try {
      await enviar.mutateAsync({
        solicitacaoId: id,
        orgId: sol.org_id,
        autorNome: empresa?.nome ?? user?.email ?? null,
        conteudo: texto.trim(),
      })
      setTexto('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'erro ao enviar')
    }
  }

  const dadosForm = Object.entries(sol.dados_form).filter(([, v]) =>
    v !== null && v !== undefined && v !== '' && v !== false,
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link
          to="/solicitacoes"
          className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-mind-700 hover:text-mind-900"
        >
          <ChevronLeft size={12} /> Voltar para solicitações
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Pill className={STATUS_PILL[sol.status]}>{STATUS_LABEL[sol.status]}</Pill>
              {sol.tipo_codigo && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  {sol.tipo_codigo.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">{sol.assunto}</h1>
            <p className="mt-1 text-sm text-ink-500">
              Aberta em {dateLongBR(sol.criada_em)}
              {sol.responsavel_nome && (
                <> · com <strong className="text-ink-700">{sol.responsavel_nome}</strong></>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Dados do formulário */}
      {dadosForm.length > 0 && (
        <Card className="p-0">
          <div className="px-5 pt-5">
            <CardHeader
              icon={FileText}
              title="Dados enviados"
              subtitle="Informações preenchidas no formulário"
            />
          </div>
          <div className="border-t border-black/5 px-5 py-4">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {dadosForm.map(([campo, valor]) => (
                <div key={campo}>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    {formatarLabel(campo)}
                  </dt>
                  <dd className="mt-0.5 text-sm text-ink-800">
                    {typeof valor === 'boolean' ? (valor ? 'Sim' : 'Não') : String(valor)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
      )}

      {/* Conversa */}
      <Card className="p-0">
        <div className="border-b border-black/5 px-5 py-3.5">
          <p className="text-sm font-semibold text-ink-900">Conversa</p>
        </div>
        <div className="space-y-4 px-5 py-5">
          {mensagens.isPending ? (
            <div className="flex justify-center py-8"><Spinner size={18} /></div>
          ) : mensagens.isError ? (
            <Empty icon={AlertTriangle} title="Erro ao carregar mensagens" />
          ) : (mensagens.data ?? []).length === 0 ? (
            <Empty
              icon={MessagesSquare}
              title="Sem respostas ainda"
              description={`O escritório responde em até ${sol.sla_resposta_horas}h. Você também pode adicionar informações abaixo.`}
            />
          ) : (
            mensagens.data!.map(m => <MensagemBubble key={m.id} mensagem={m} />)
          )}
          <div ref={fimRef} />
        </div>

        {/* Composer */}
        {podeResponder ? (
          <form onSubmit={handleEnviar} className="border-t border-black/5 px-5 py-4">
            <Textarea
              rows={3}
              placeholder="Adicione uma resposta ou informação extra…"
              value={texto}
              onChange={e => setTexto(e.target.value)}
              disabled={enviar.isPending}
            />
            {erro && (
              <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
                {erro}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[11px] text-ink-500">
                <Clock size={10} className="-mt-0.5 mr-1 inline" />
                Resposta em até {sol.sla_resposta_horas}h em dias úteis
              </p>
              <Button
                type="submit"
                variant="primary"
                icon={enviar.isPending ? Loader2 : Send}
                disabled={texto.trim().length < 2 || enviar.isPending}
              >
                {enviar.isPending ? 'Enviando…' : 'Enviar resposta'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="border-t border-black/5 bg-ink-50 px-5 py-4">
            <p className="flex items-center gap-2 text-sm text-ink-600">
              <CheckCircle2 size={14} className="text-brand-600" />
              Esta solicitação foi {sol.status === 'fechada' ? 'fechada' : 'cancelada'} e não aceita mais respostas.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Bubble de mensagem ──────────────────────────────────────────────────

function MensagemBubble({ mensagem }: { mensagem: SolicitacaoMensagem }) {
  const isCliente = mensagem.autor_tipo === 'cliente'
  const isSistema = mensagem.autor_tipo === 'sistema'
  const autor = mensagem.autor_nome ?? (isCliente ? 'Você' : isSistema ? 'Sistema' : 'Escritório')

  return (
    <div className={cn('flex gap-2.5', isCliente && 'flex-row-reverse')}>
      <Avatar nome={autor} size="sm" />
      <div className={cn('min-w-0 max-w-[80%]', isCliente && 'text-right')}>
        <p className="mb-1 text-[11px] text-ink-500">
          <span className="font-medium text-ink-700">{autor}</span>
          <span className="mx-1">·</span>
          {ago(mensagem.criado_em)}
        </p>
        <div className={cn(
          'inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm',
          isCliente
            ? 'bg-mind-600 text-white rounded-tr-md'
            : isSistema
            ? 'bg-ink-100 text-ink-700 italic rounded-tl-md'
            : 'bg-ink-50 text-ink-900 ring-1 ring-inset ring-ink-100 rounded-tl-md',
        )}>
          {mensagem.conteudo}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** "colaborador_nome" → "Colaborador Nome" */
function formatarLabel(s: string): string {
  return s
    .split('_')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}
