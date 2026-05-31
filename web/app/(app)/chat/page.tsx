import Link from 'next/link'
import { MessagesSquare, Plus, Hash, MessageCircle, Users } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, Avatar, Empty, Button } from '@/components/ui'
import { ago } from '@/lib/utils'

const tipoIcon = {
  dm: MessageCircle,
  grupo: Users,
  departamento: Hash,
  entrega: Hash,
  empresa: Hash,
  geral: Hash,
}

export default async function ChatPage() {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const { data: { user } } = await supabase.auth.getUser()

  // Canais em que o user é membro
  const { data: canaisDoUser } = await supabase
    .from('chat_membros')
    .select(`
      ultima_leitura_at,
      chat_canais(id, tipo, nome, descricao, departamento, entrega_id, empresa_id, ultima_mensagem_em)
    `)
    .eq('user_id', user!.id)
    .eq('org_id', ctx.org_id)

  const canais = (canaisDoUser ?? [])
    .map(c => ({
      ...(Array.isArray(c.chat_canais) ? c.chat_canais[0] : c.chat_canais),
      ultima_leitura_at: c.ultima_leitura_at,
    }))
    .filter(c => c?.id)
    .sort((a: any, b: any) => {
      const ta = a.ultima_mensagem_em ? new Date(a.ultima_mensagem_em).getTime() : 0
      const tb = b.ultima_mensagem_em ? new Date(b.ultima_mensagem_em).getTime() : 0
      return tb - ta
    })

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Chat interno</h1>
          <p className="mt-1 text-sm text-ink-500">
            Conversas diretas, canais por departamento e discussões vinculadas a entregas e empresas.
          </p>
        </div>
        <Button variant="primary" icon={Plus}>Nova conversa</Button>
      </div>

      <Card className="p-2">
        {canais.length === 0 ? (
          <Empty
            icon={MessagesSquare}
            title="Sem conversas ainda"
            description="Comece uma DM com um colega, entre num canal de departamento, ou crie um canal vinculado a uma entrega."
            action={<Button variant="primary" icon={Plus}>Iniciar conversa</Button>}
          />
        ) : (
          <ul className="divide-y divide-black/5">
            {canais.map((c: any) => {
              const Icon = tipoIcon[c.tipo as keyof typeof tipoIcon] ?? MessageCircle
              const titulo = c.tipo === 'dm'
                ? '(conversa direta)'
                : c.tipo === 'departamento' ? `#dept-${c.departamento ?? ''}`
                : c.nome ?? `#${c.tipo}`
              const naoLido = c.ultima_mensagem_em && c.ultima_leitura_at && new Date(c.ultima_mensagem_em) > new Date(c.ultima_leitura_at)
              return (
                <li key={c.id}>
                  <Link href={`/chat/${c.id}`} className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-ink-50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink-900">
                        <span className="truncate">{titulo}</span>
                        <span className="text-xs font-normal text-ink-400">
                          {c.ultima_mensagem_em ? ago(c.ultima_mensagem_em) : 'sem mensagens'}
                        </span>
                      </p>
                      {c.descricao && <p className="truncate text-xs text-ink-500">{c.descricao}</p>}
                    </div>
                    {naoLido && <span className="h-2 w-2 rounded-full bg-brand-500" />}
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
