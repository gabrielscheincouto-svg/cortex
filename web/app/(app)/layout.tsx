import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext, listMyOrgs } from '@/lib/modulos'
import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'
import { AppShell } from '@/components/app-shell'
import { CortexLauncher } from '@/components/cortex/launcher'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nome, email')
    .eq('id', user.id)
    .single()
  const { data: { session } } = await supabase.auth.getSession()

  const orgs = await listMyOrgs()

  // Se o user não pertence a nenhuma org, mostra estado vazio (não redireciona em loop)
  if (orgs.length === 0) {
    return <NoOrgsScreen userName={profile?.nome ?? user.email ?? ''} />
  }

  const ctx = await loadOrgContext()

  // Caso o profile.current_org_id esteja vazio, mas tenha ao menos uma org disponível:
  // sugere setá-la manualmente. Não fazemos isso aqui para evitar magia.
  if (!ctx) {
    return <NoCurrentOrgScreen orgs={orgs} userName={profile?.nome ?? ''} />
  }

  const isAdminEscritorio = ctx.my_role === 'admin' || ctx.my_role === 'gerente'

  return (
    <>
      <AppShell
        sidebar={
          <Sidebar
            modulosAtivos={ctx.modulos_ativos}
            isAdminEscritorio={isAdminEscritorio}
            orgNome={ctx.org_nome}
            corPrimaria={ctx.cor_primaria}
          />
        }
        topbar={
          <Topbar
            userName={profile?.nome ?? user.email ?? ''}
            userEmail={profile?.email ?? user.email ?? ''}
            orgs={orgs.map(o => ({ id: o.id!, nome: o.nome!, cor_primaria: o.cor_primaria! }))}
            currentOrgId={ctx.org_id}
          />
        }
      >
        {children}
      </AppShell>
      <CortexLauncher token={session?.access_token} enabled={ctx.modulos_ativos.includes('ai')} />
    </>
  )
}

function NoOrgsScreen({ userName }: { userName: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
      <div className="max-w-md rounded-xl border border-black/10 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-ink-900">Olá, {userName.split(' ')[0]}</h1>
        <p className="mt-2 text-sm text-ink-500">
          Você ainda não foi convidado para nenhum escritório no Cortex.
        </p>
        <p className="mt-1 text-sm text-ink-500">
          Peça ao administrador do seu escritório para enviar um convite.
        </p>
      </div>
    </main>
  )
}

function NoCurrentOrgScreen({ orgs, userName }: { orgs: { id?: string; nome?: string }[]; userName: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
      <div className="max-w-md rounded-xl border border-black/10 bg-white p-8">
        <h1 className="text-lg font-semibold text-ink-900">Selecione o escritório</h1>
        <p className="mt-1 text-sm text-ink-500">
          Olá, {userName.split(' ')[0]}. Você participa de mais de um escritório — escolha por onde quer começar.
        </p>
        <ul className="mt-4 space-y-1">
          {orgs.map(o => (
            <li key={o.id}>
              <Link
                href={`/api/orgs/set-current?id=${o.id}`}
                className="block rounded-lg border border-black/10 px-4 py-3 text-sm hover:bg-ink-50"
              >
                {o.nome}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
