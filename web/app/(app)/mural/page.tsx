import { Newspaper, Pin, Check, MessageSquare } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, Avatar, Pill, Empty, Button } from '@/components/ui'
import { ago } from '@/lib/utils'

const categoriaPill: Record<string, string> = {
  aviso:       'bg-blue-100 text-blue-900 ring-blue-300',
  importante:  'bg-gold-50 text-gold-700 ring-gold-100',
  celebracao:  'bg-rose-soft text-rose ring-rose/30',
  documento:   'bg-purple-100 text-purple-900 ring-purple-300',
  sistema:     'bg-ink-100 text-ink-600 ring-ink-200',
}

export default async function MuralPage() {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const { data: posts } = await supabase
    .from('mural_posts')
    .select(`
      id, autor_tipo, autor_id, autor_nome, categoria, titulo, conteudo, fixado, created_at,
      profiles!autor_id(nome, avatar_url),
      mural_reacoes(tipo)
    `)
    .eq('org_id', ctx.org_id)
    .is('deleted_at', null)
    .order('fixado', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Mural interno</h1>
          <p className="mt-1 text-sm text-ink-500">Comunicação corporativa do escritório.</p>
        </div>
        <Button variant="primary">Novo post</Button>
      </div>

      {(!posts || posts.length === 0) ? (
        <Card>
          <Empty icon={Newspaper} title="Mural vazio" description="Seja o primeiro a postar um aviso ou comunicado." />
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map(p => {
            const autorRel = Array.isArray(p.profiles) ? p.profiles[0] : (p as any).profiles
            const autorNome = p.autor_tipo === 'sistema' ? 'Sistema' : (p.autor_nome ?? autorRel?.nome ?? '—')
            const reacoes = (p.mural_reacoes as { tipo: string }[] | undefined) ?? []
            const confirmados = reacoes.filter(r => r.tipo === 'confirmou_leitura').length

            return (
              <Card key={p.id} className={p.fixado ? 'border-l-4 border-l-gold-500' : ''}>
                <div className="mb-3 flex items-start gap-3">
                  <Avatar nome={autorNome} src={autorRel?.avatar_url} size="md" />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink-900">{autorNome}</p>
                      {p.fixado && <Pin size={12} className="text-gold-500" />}
                      <Pill className={categoriaPill[p.categoria] ?? 'bg-ink-100 text-ink-700 ring-ink-200'}>
                        {p.categoria}
                      </Pill>
                    </div>
                    <p className="text-xs text-ink-400">{ago(p.created_at)}</p>
                  </div>
                </div>
                {p.titulo && <p className="mb-1.5 text-base font-semibold text-ink-900">{p.titulo}</p>}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{p.conteudo}</p>

                <div className="mt-4 flex items-center gap-4 border-t border-black/5 pt-3">
                  <button className="inline-flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-900">
                    <Check size={14} /> {confirmados} confirmaram
                  </button>
                  <button className="inline-flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-900">
                    <MessageSquare size={14} /> Comentar
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
