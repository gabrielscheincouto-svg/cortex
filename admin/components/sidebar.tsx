'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Package, FileText, CreditCard, Trophy, BarChart3, Bot, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/dashboard',         label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/escritorios',       label: 'Escritórios',   icon: Building2 },
  { href: '/planos',            label: 'Planos',        icon: Package },
  { href: '/catalogo',          label: 'Catálogos',     icon: FileText },
  { href: '/conquistas',        label: 'Conquistas',    icon: Trophy },
  { href: '/faturamento',       label: 'Faturamento',   icon: CreditCard },
  { href: '/telemetria',        label: 'Telemetria',    icon: BarChart3 },
  { href: '/robos',             label: 'Robôs',         icon: Bot },
  { href: '/auditoria',         label: 'Auditoria',     icon: Activity },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-black/10 bg-ink-900 text-white">
      <div className="flex items-center gap-2 px-6 pt-5 pb-4">
        <div className="h-2 w-2 rounded-full bg-brand-500" />
        <span className="text-sm font-bold tracking-wider uppercase">CECOPEL admin</span>
      </div>

      <nav className="mt-2 flex-1 space-y-0.5 px-3">
        {nav.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active ? 'bg-white/10 text-white font-medium' : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              <item.icon size={16} className={cn(active ? 'text-brand-500' : 'text-white/40')} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-xs text-white/40">
        <p>v0.1.0 · {new Date().getFullYear()}</p>
      </div>
    </aside>
  )
}
