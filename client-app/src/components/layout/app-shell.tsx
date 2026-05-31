/**
 * AppShell — wrapper das rotas autenticadas.
 * Layout mobile-first: topbar fixo + outlet. Sidebar entra em viewport >= md.
 *
 * Quando o user logou mas não tem vínculo em empresa_usuarios_finais,
 * mostra NoEmpresaScreen com opção de trocar de conta.
 */
import { Outlet } from 'react-router-dom'
import { LogOut, Building2 } from 'lucide-react'
import { Topbar } from './topbar'
import { Sidebar } from './sidebar'
import { useRequireAuth } from '@/lib/auth'
import { Spinner, Button } from '@/components/ui'

export function AppShell() {
  const { status, empresa, user, signOut } = useRequireAuth()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <Spinner size={24} />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    // useRequireAuth já redireciona; render mínimo enquanto navega
    return null
  }

  // Logado mas sem vínculo a empresa-cliente — provavelmente entrou no portal errado.
  if (status === 'authenticated' && !empresa) {
    return <NoEmpresaScreen userEmail={user?.email ?? ''} onSignOut={signOut} />
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <Topbar />
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <Sidebar />
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NoEmpresaScreen({ userEmail, onSignOut }: { userEmail: string; onSignOut: () => Promise<void> }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-mind-50 text-mind-600">
          <Building2 size={22} />
        </div>
        <h1 className="text-lg font-semibold text-ink-900">Conta sem empresa associada</h1>
        <p className="mt-2 text-sm text-ink-500">
          Você entrou como <strong className="text-ink-800">{userEmail}</strong>, mas essa conta
          ainda não foi vinculada a nenhuma empresa do Cortex.
        </p>
        <p className="mt-3 text-sm text-ink-500">
          Peça ao seu escritório contábil para enviar o convite, ou entre com outra conta.
        </p>

        <div className="mt-6 space-y-2">
          <Button
            type="button"
            variant="primary"
            className="w-full"
            onClick={() => { void onSignOut() }}
          >
            <LogOut size={14} />
            Entrar com outra conta
          </Button>
          <a
            href="https://usecortex-app.netlify.app/"
            className="block text-xs text-ink-500 hover:text-ink-700 hover:underline"
          >
            É membro de um escritório? Acessar painel do Escritório
          </a>
        </div>
      </div>
    </main>
  )
}
