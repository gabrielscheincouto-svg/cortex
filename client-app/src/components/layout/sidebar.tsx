/**
 * Sidebar — navegação principal do cliente.
 * Mobile esconde (md:block). Desktop fixo na lateral.
 */
import { NavLink } from 'react-router-dom'
import { Home, ClipboardList, MessagesSquare, FolderArchive, Bell, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const NAV: ReadonlyArray<NavItem> = [
  { to: '/',              label: 'Início',       icon: Home },
  { to: '/obrigacoes',    label: 'Obrigações',   icon: ClipboardList },
  { to: '/solicitacoes',  label: 'Solicitações', icon: MessagesSquare },
  { to: '/documentos',    label: 'Documentos',   icon: FolderArchive },
  { to: '/notificacoes',  label: 'Avisos',       icon: Bell },
]

export function Sidebar() {
  return (
    <nav aria-label="Navegação principal" className="sticky top-20 space-y-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-ink-900 text-white'
                : 'text-ink-700 hover:bg-ink-100',
            )
          }
        >
          <item.icon size={16} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
