import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { apiServer } from '@/lib/api'
import { Card, CardHeader } from '@/components/ui'
import { DepartamentoEditor } from './actions'

export default async function DepartamentosPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  const api = await apiServer()
  const departamentos = await api.listDepartamentos()
  const { data: membros } = await supabase
    .from('org_membros')
    .select('user_id, role, profiles!user_id(nome, email)')
    .eq('status', 'ativo')

  const membrosView = (membros ?? []).map(m => {
    const profile = Array.isArray((m as any).profiles) ? (m as any).profiles[0] : (m as any).profiles
    return {
      user_id: m.user_id,
      role: m.role,
      nome: profile?.nome || profile?.email || 'Colaborador',
      email: profile?.email,
    }
  })

  return (
    <div className="space-y-5">
      <Link href="/configuracoes" className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={16} /> Voltar para configurações
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Departamentos</h1>
        <p className="mt-1 text-sm text-ink-500">Metas, gerentes e modo de premiação por setor.</p>
      </div>
      <Card>
        <CardHeader title="Premiação por setor" subtitle="Fiscal e Pessoal geram pontos automaticamente; Contábil fica em fechamento manual." />
        <div className="space-y-3">
          {departamentos.map(dept => (
            <DepartamentoEditor key={dept.id} token={session.access_token} dept={dept} membros={membrosView} />
          ))}
        </div>
      </Card>
    </div>
  )
}
