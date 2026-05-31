import { createServerClient } from '@/lib/supabase'
import { Card, CardHeader } from '@/components/ui'
import { FrequenciaGrid } from './actions'

export default async function FrequenciaPage({ searchParams }: { searchParams: { competencia?: string } }) {
  const competencia = searchParams.competencia ?? new Date().toISOString().slice(0, 7)
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Frequência</h1>
        <p className="mt-1 text-sm text-ink-500">Presenças, faltas, atrasos e fechamento mensal.</p>
      </div>
      <Card>
        <CardHeader title={`Competência ${competencia}`} subtitle="Clique em uma célula para alterar o status do dia." />
        <FrequenciaGrid token={session.access_token} competencia={competencia} />
      </Card>
    </div>
  )
}
