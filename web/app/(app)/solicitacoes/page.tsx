import Link from 'next/link'
import { MessageSquareText, Star, AlertCircle } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, Pill, Empty, Avatar } from '@/components/ui'
import { ago } from '@/lib/utils'

const prioridadePill: Record<string, string> = {
  baixa:      'bg-ink-100 text-ink-700 ring-ink-200',
  media:      'bg-blue-100 text-blue-900 ring-blue-300',
  alta:       'bg-amber-100 text-amber-900 ring-amber-300',
  muito_alta: 'bg-rose-100 text-rose-900 ring-rose-300',
}
const statusPill: Record<string, string> = {
  nova:                'bg-amber-100 text-amber-900 ring-amber-300',
  em_atendimento:      'bg-blue-100 text-blue-900 ring-blue-300',
  aguardando_cliente:  'bg-purple-100 text-purple-900 ring-purple-300',
  resolvida:           'bg-emerald-100 text-emerald-900 ring-emerald-300',
  fechada:             'bg-ink-100 text-ink-500 ring-ink-200',
  cancelada:           'bg-ink-100 text-ink-500 ring-ink-200',
}

export default async function SolicitacoesPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  let qy = supabase
    .from('solicitacoes')
    .select(`
      id, assunto, descricao, prioridade, status, prazo_resposta_horas:sla_resposta_horas, created_at, resolvida_em,
      avaliacao_estrelas, criada_por_nome,
      empresas(razao_social),
      profiles!responsavel_id(nome)
    `)
    .eq('org_id', ctx.org_id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (searchParams.status && searchParams.status !== 'todos') {
    qy = qy.eq('status', searchParams.status)
  }

  const { data: solicitacoes } = await qy

  const tabs = [
    { key: 'nova',                label: 'Novas' },
    { key: 'em_atendimento',      label: 'Em atendimento' },
    { key: 'aguardando_cliente',  label: 'Aguardando cliente' },
    { key: 'resolvida',           label: 'Resolvidas' },
    { key: 'todos',               label: 'Todas' },
  ]
  const statusAtivo = searchParams.status ?? 'todos'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Solicitações</h1>
        <p className="mt-1 text-sm text-ink-500">Tickets enviados pelos clientes pelo app, portal ou email.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={`/solicitacoes?status=${t.key}`}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ring-inset transition-colors ${
              t.key === statusAtivo
                ? 'bg-ink-900 text-white ring-ink-900'
                : 'bg-white text-ink-700 ring-black/10 hover:bg-ink-50'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card className="p-0">
        {(!solicitacoes || solicitacoes.length === 0) ? (
          <div className="p-5">
            <Empty
              icon={MessageSquareText}
              title="Nenhuma solicitação"
              description="Quando um cliente abrir um chamado no app, ele cai aqui."
            />
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {solicitacoes.map(s => {
              const emp = Array.isArray(s.empresas) ? s.empresas[0] : (s as any).empresas
              const resp = Array.isArray(s.profiles) ? s.profiles[0] : (s as any).profiles
              return (
                <li key={s.id} className="px-5 py-4 hover:bg-ink-50/60">
                  <Link href={`/solicitacoes/${s.id}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <p className="truncate font-medium text-ink-900">{s.assunto}</p>
                          <Pill className={statusPill[s.status]}>{s.status.replace('_', ' ')}</Pill>
                          <Pill className={prioridadePill[s.prioridade]}>{s.prioridade.replace('_', ' ')}</Pill>
                        </div>
                        <p className="text-xs text-ink-500">
                          {emp?.razao_social ?? s.criada_por_nome ?? '—'} · há {ago(s.created_at)} · responsável {resp?.nome ?? 'sem atribuição'}
                        </p>
                        {s.descricao && <p className="mt-1.5 line-clamp-2 text-sm text-ink-700">{s.descricao}</p>}
                      </div>
                      {s.avaliacao_estrelas && (
                        <div className="flex items-center gap-1 text-gold-500">
                          {Array.from({ length: s.avaliacao_estrelas }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                        </div>
                      )}
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
