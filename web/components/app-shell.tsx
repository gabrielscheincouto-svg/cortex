'use client'

/**
 * AppShell — orquestra layout responsivo.
 * Mobile (<lg): sidebar oculta atrás de translate; abre com hamburger no Topbar.
 * Desktop (≥lg): sidebar fixa 240px, conteúdo com margin-left.
 */

import { useState, useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'

export function AppShell({
  sidebar,
  topbar,
  children,
}: {
  sidebar: ReactNode
  topbar: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Fecha sidebar ao navegar em mobile
  useEffect(() => { setOpen(false) }, [pathname])

  // Trava scroll quando sidebar mobile aberta
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <div className="min-h-screen">
      {/* Sidebar — translate em mobile, fixa em desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-60 transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:shadow-none'
        }`}
      >
        {sidebar}
      </div>

      {/* Backdrop em mobile */}
      {open && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden"
        />
      )}

      {/* Conteúdo */}
      <div className="lg:ml-60">
        {/* Topbar mobile com hamburger */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-black/10 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-ink-700 hover:bg-ink-100"
          >
            <Menu size={20} />
          </button>
          <p className="font-display text-base text-ink-900">usecortex</p>
        </div>

        {/* Topbar desktop */}
        <div className="hidden lg:block">{topbar}</div>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
