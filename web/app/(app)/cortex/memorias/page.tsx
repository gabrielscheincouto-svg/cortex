/**
 * Cortex › Memórias.
 * Painel onde a pessoa vê tudo que o Cortex aprendeu sobre ela e sobre a org,
 * pode editar/arquivar individualmente ou apertar "Esquecer tudo".
 */

import { BrainCircuit, Shield } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, CardHeader, Empty, Pill } from '@/components/ui'
import { ago } from '@/lib/utils'
import { MemoriasClient, EsquecerTudoBlock } from './client'

export const dynamic = 'force-dynamic'

const TIPO_LABELS: Record<string, { label: string; cor: string; descricao: string }> = {
  fato_user:           { label: 'Sobre você',         cor: 'bg-mind-100 text-mind-800',    descricao: 'Quem é, função, responsabilidades' },
  preferencia:         { label: 'Preferência',        cor: 'bg-indigo-100 text-indigo-800', descricao: 'Filtros, layouts, ordens preferidas' },
  rotina:              { label: 'Rotina',             cor: 'bg-amber-100 text-amber-800',   descricao: 'O que faz com frequência, quando' },
  terminologia:        { label: 'Termo usado',        cor: 'bg-sky-100 text-sky-800',       descricao: 'Vocabulário próprio do escritório' },
  fato_org:            { label: 'Sobre o escritório', cor: 'bg-emerald-100 text-emerald-800', descricao: 'Perfil da empresa, especialidades' },
  cliente_chave:       { label: 'Cliente-chave',      cor: 'bg-rose-100 text-rose-800',     descricao: 'Clientes importantes ou sensíveis' },
  contexto_temporario: { label: 'Temporário',         cor: 'bg-ink-200 text-ink-700',       descricao: 'Férias, situações pontuais' },
}

export default async function CortexMemoriasPage() {
  const ctx = await loadOrgContext()
  if (!ctx) return null

  const supabase = createServerClient()
  const { data: memorias } = await supabase
    .from('cortex_memorias')
    .select('id, user_id, tipo, fato, confianca, expira_em, revisada_em, arquivada, created_at, updated_at')
    .eq('org_id', ctx.org_id)
    .eq('arquivada', false)
    .order('confianca', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(200)

  // Agrupar por tipo p/ exibir em seções
  const grupos = new Map<string, typeof memorias>()
  for (const m of memorias ?? []) {
    const arr = grupos.get(m.tipo) ?? []
    arr.push(m)
    grupos.set(m.tipo, arr)
  }

  const ordemTipos = ['fato_user', 'preferencia', 'rotina', 'terminologia', 'fato_org', 'cliente_chave', 'contexto_temporario']

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-mind-700">Cortex · memórias</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900">O que o Cortex sabe sobre você</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          O Cortex aprende fatos importantes ao longo das conversas. Aqui você revisa,
          edita ou arquiva o que ele guardou. Memórias com escopo <em>org</em> valem
          para toda a equipe; as demais são privadas.
        </p>
      </div>

      <Card className="border-mind-300 bg-mind-50/40">
        <CardHeader
          icon={Shield}
          title="Privacidade da memória"
          subtitle="Como o Cortex usa o que aprende"
        />
        <ul className="ml-5 list-disc space-y-1 text-sm text-ink-700">
          <li>Cada memória é injetada como contexto no <strong>próprio prompt</strong> da sua próxima conversa — não vai pra LLM externa permanente.</li>
          <li>Você pode <strong>arquivar individualmente</strong> ou apertar <strong>Esquecer tudo</strong>.</li>
          <li>Memórias com escopo <em>org</em> só admin/gerente cria — todo mundo lê.</li>
          <li>Memórias com <strong>expira em</strong> somem da injeção depois da data.</li>
        </ul>
      </Card>

      {(!memorias || memorias.length === 0) ? (
        <Card>
          <Empty
            icon={BrainCircuit}
            title="Sem memórias ainda"
            description="Comece dizendo no Cortex: 'lembre que eu prefiro ver Contábil primeiro' ou 'anote que Aquarela é cliente premium'."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {ordemTipos.map(tipo => {
            const itens = grupos.get(tipo)
            if (!itens || itens.length === 0) return null
            const meta = TIPO_LABELS[tipo] ?? { label: tipo, cor: 'bg-ink-100 text-ink-700', descricao: '' }
            return (
              <Card key={tipo}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Pill className={meta.cor}>{meta.label}</Pill>
                      <span className="text-xs text-ink-500">{itens.length} {itens.length === 1 ? 'memória' : 'memórias'}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">{meta.descricao}</p>
                  </div>
                </div>

                <MemoriasClient
                  itens={itens.map(m => ({
                    id: m.id,
                    user_id: m.user_id,
                    tipo: m.tipo,
                    fato: m.fato,
                    confianca: Number(m.confianca),
                    expira_em: m.expira_em,
                    revisada_em: m.revisada_em,
                    atualizado_em: m.updated_at,
                    atualizado_em_label: ago(m.updated_at),
                  }))}
                />
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <CardHeader title="Zona de risco" subtitle="Arquive todas as suas memórias de uma vez (não afeta memórias da org)" />
        <EsquecerTudoBlock />
      </Card>
    </div>
  )
}
