import { createServerClient } from '@/lib/supabase'
import { Card, CardHeader } from '@/components/ui'
import { KanbanBoard } from './actions'

export default async function KanbanPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Kanban interno</h1>
        <p className="mt-1 text-sm text-ink-500">Tarefas internas, co-responsáveis e recorrências do escritório.</p>
      </div>
      <Card>
        <CardHeader title="Tarefas" subtitle="Mova pelo seletor de status; recorrências são geradas pelo worker horário." />
        <KanbanBoard token={session.access_token} />
      </Card>
    </div>
  )
}
