import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Carrega profile e valida super-admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nome, email, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
        <div className="max-w-md rounded-xl border border-rose-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-ink-900">Acesso negado</h1>
          <p className="mt-2 text-sm text-ink-500">
            Esta área é restrita a super-admins do Cortex. Se você é dono de um escritório,
            acesse <span className="font-medium text-ink-900">app.usecortex.com.br</span>.
          </p>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="ml-60">
        <Topbar userName={profile.nome} userEmail={profile.email} />
        <main className="p-8">{children}</main>
      </div>
    </div>
  )
}
