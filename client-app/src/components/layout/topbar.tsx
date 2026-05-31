/**
 * Topbar — header fixo com identidade Cortex, pulsação neural, empresa,
 * sino de notificações com badge contador, avatar e perfil.
 */
import { Link } from 'react-router-dom'
import { Bell, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button, Avatar } from '@/components/ui'
import { useNotificacoesNaoLidasCount } from '@/lib/queries'
import { cn } from '@/lib/utils'

export function Topbar() {
  const { user, empresa, signOut } = useAuth()
  const naoLidas = useNotificacoesNaoLidasCount(empresa?.id)
  const count = naoLidas.data ?? 0

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="cortex-pulse" aria-hidden="true" />
          <span className="text-base font-semibold tracking-tight text-ink-900">cortex</span>
        </Link>
        <span aria-hidden="true" className="h-5 w-px bg-ink-200" />
        <div className="min-w-0 truncate">
          <p className="truncate text-sm font-medium text-ink-900">
            {empresa?.nome ?? 'Portal do cliente'}
          </p>
          {empresa?.cnpj && (
            <p className="font-mono text-[11px] text-ink-500">{empresa.cnpj}</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/notificacoes"
            aria-label={count > 0 ? `${count} avisos não lidos` : 'Avisos'}
            className={cn(
              'relative inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
              'hover:bg-ink-100 text-ink-700 hover:text-ink-900',
            )}
          >
            <Bell size={18} />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
          <span className="hidden text-xs text-ink-500 sm:inline">{user?.email}</span>
          <Avatar nome={user?.email ?? '?'} size="sm" />
          <Button size="sm" variant="ghost" icon={LogOut} onClick={() => void signOut()}>
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
