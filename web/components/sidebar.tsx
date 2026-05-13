'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, ClipboardCheck, Building2, MessageSquareText, Newspaper, MessagesSquare, KanbanSquare, Users,
  Trophy, BarChart3, FileText, Settings, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  modulo?: string         // se preenchido, só aparece se org tem o módulo ativo
  adminOnly?: boolean
  prefetch?: boolean      // só prefetch nas top rotas (caminho mais comum)
}

const items: NavItem[] = [
  { href: '/home',          label: 'Home',          icon: Home,              prefetch: true },
  { href: '/kanban',        label: 'Kanban',        icon: KanbanSquare,      modulo: 'kanban',       prefetch: true },
  { href: '/entregas',      label: 'Entregas',      icon: ClipboardCheck,    modulo: 'entregas',     prefetch: true },
  { href: '/empresas',      label: 'Empresas',      icon: Building2,         modulo: 'empresas' },
  { href: '/solicitacoes',  label: 'Solicitações',  icon: MessageSquareText, modulo: 'solicitacoes' },
  { href: '/mural',         label: 'Mural',         icon: Newspaper,         modulo: 'mural' },
  { href: '/chat',          label: 'Chat',          icon: MessagesSquare,    modulo: 'chat' },
  { href: '/dashboards',    label: 'Dashboards',    icon: BarChart3,         modulo: 'dashboards' },
  { href: '/balancete',     label: 'Ctrl Contábil', icon: BarChart3,         modulo: 'contabil' },
  { href: '/premiacoes',    label: 'Premiações',    icon: Trophy,            modulo: 'gamificacao' },
  { href: '/conquistas',    label: 'Conquistas',    icon: Trophy,            modulo: 'gamificacao' },
  { href: '/rh/frequencia', label: 'Frequência',    icon: Users,             modulo: 'rh' },
  { href: '/obrigacoes',    label: 'Obrigações',    icon: FileText,          modulo: 'obrigacoes' },
  { href: '/configuracoes', label: 'Configurações', icon: Settings,          adminOnly: true },
]

export function Sidebar({
  modulosAtivos, isAdminEscritorio, orgNome, corPrimaria,
}: {
  modulosAtivos: string[]
  isAdminEscritorio: boolean
  orgNome: string
  corPrimaria: string
}) {
  const pathname = usePathname()
  const visiveis = items.filter(it => {
    if (it.adminOnly && !isAdminEscritorio) return false
    if (it.modulo && !modulosAtivos.includes(it.modulo)) return false
    return true
  })

  return (
    <aside className="flex h-full w-60 flex-col border-r border-black/10 bg-white">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg text-white text-sm font-bold"
             style={{ backgroundColor: corPrimaria }}>
          {orgNome.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Escritório</p>
          <p className="truncate text-sm font-semibold text-ink-900">{orgNome}</p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-0.5 px-3">
        {visiveis.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={item.prefetch ?? false}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active ? 'bg-ink-900 text-white font-medium' : 'text-ink-700 hover:bg-ink-50'
              )}
            >
              <item.icon size={16} className={active ? 'text-brand-500' : 'text-ink-500'} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-black/5 px-5 py-3">
        <p className="mb-1 text-[10px] uppercase tracking-wider text-ink-400">Cortex</p>
        <div className="flex items-center justify-between text-xs text-ink-500">
          <span>Cmd+K para abrir</span>
          <kbd className="rounded-md bg-ink-100 px-1.5 py-0.5 font-mono text-[10px] text-ink-700">⌘K</kbd>
        </div>
      </div>
    </aside>
  )
}
