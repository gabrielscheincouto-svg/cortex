/**
 * Configurações > Cortex.
 * Admin/gerente define quais ferramentas de escrita o Cortex pode propor
 * para cada role. Por default todas vêm habilitadas via seed da migration 040.
 *
 * Auditabilidade: o user precisa confirmar cada ação via UI (card no drawer).
 * Esta página só controla "qual role pode confirmar quais tools".
 */

import { redirect } from 'next/navigation'
import { Sparkles, ShieldCheck } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card, CardHeader, Empty } from '@/components/ui'
import { PermissoesTable } from './client'

export const dynamic = 'force-dynamic'

const TODOS_ROLES = ['admin', 'gerente', 'contabil', 'fiscal', 'pessoal', 'societario', 'comercial', 'visualizador'] as const

export default async function CortexConfigPage() {
  const ctx = await loadOrgContext()
  if (!ctx) return null
  if (!['admin', 'gerente'].includes(ctx.my_role)) {
    redirect('/')
  }

  const supabase = createServerClient()
  const { data: permissoes } = await supabase
    .from('cortex_permissoes_org')
    .select('id, ferramenta, permitida, roles_permitidas')
    .eq('org_id', ctx.org_id)
    .order('ferramenta')

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-mind-700">Cortex · ferramentas</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900">Permissões do agente</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          O Cortex nunca executa uma ação de escrita sem que a pessoa confirme via card.
          Aqui você controla quais <em>tipos</em> de ações o Cortex pode propor, e para quais
          papéis (roles) da equipe.
        </p>
      </div>

      <Card className="border-mind-300 bg-mind-50/40">
        <CardHeader
          icon={ShieldCheck}
          title="Como funciona a confirmação"
          subtitle="Toda ação de escrita exige confirmação humana"
        />
        <ol className="ml-5 list-decimal space-y-1 text-sm text-ink-700">
          <li>Pessoa pede algo ao Cortex (ex.: <em>"cria tarefa: revisar guias DCTFWeb"</em>).</li>
          <li>Cortex detecta a intenção e cria uma <strong>ação pendente</strong> — não executa.</li>
          <li>Aparece um card no drawer: <strong>Cortex propõe uma ação · Confirmar / Cancelar</strong>.</li>
          <li>Só após o clique em <strong>Confirmar</strong>, a ação roda na transação tenant e fica auditada.</li>
          <li>A ação <strong>expira em 1 hora</strong> se ninguém confirmar.</li>
        </ol>
      </Card>

      <Card>
        <CardHeader
          icon={Sparkles}
          title="Ferramentas de escrita"
          subtitle="Marque quais roles podem confirmar cada ação"
        />
        {!permissoes || permissoes.length === 0 ? (
          <Empty
            icon={Sparkles}
            title="Sem permissões configuradas"
            description="Aplique a migration 040_cortex_acoes.sql para popular os defaults."
          />
        ) : (
          <PermissoesTable
            permissoes={permissoes.map(p => ({
              ferramenta: p.ferramenta,
              permitida: p.permitida,
              roles_permitidas: p.roles_permitidas ?? [],
            }))}
            todosRoles={[...TODOS_ROLES]}
          />
        )}
      </Card>
    </div>
  )
}
