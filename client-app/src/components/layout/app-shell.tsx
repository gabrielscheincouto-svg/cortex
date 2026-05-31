/**
 * AppShell — wrapper das rotas autenticadas.
 * Layout mobile-first: topbar fixo + outlet. Sidebar entra em viewport >= md.
 */
import { Outlet } from 'react-router-dom'
import { Topbar } from './topbar'
import { Sidebar } from './sidebar'
import { useRequireAuth } from '@/lib/auth'
import { Spinner } from '@/components/ui'

export function AppShell() {
  const { status } = useRequireAuth()

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
