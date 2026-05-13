'use client'

import { useRouter } from 'next/navigation'
import { Bell, LogOut, Search, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { apiBrowser } from '@/lib/api'
import { Avatar, Button } from './ui'

interface Org {
  id: string
  nome: string
  cor_primaria: string
}

export function Topbar({
  userName, userEmail, orgs, currentOrgId,
}: {
  userName: string
  userEmail: string
  orgs: Org[]
  currentOrgId: string
}) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [orgPickerOpen, setOrgPickerOpen] = useState(false)
  const [trocando, setTrocando] = useState(false)

  const currentOrg = orgs.find(o => o.id === currentOrgId)

  async function trocarOrg(orgId: string) {
    if (orgId === currentOrgId) { setOrgPickerOpen(false); return }
    setTrocando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('sessão expirada')
      await apiBrowser(session.access_token).setCurrentOrg(orgId)
      router.refresh()
    } finally {
      setTrocando(false)
      setOrgPickerOpen(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-black/10 bg-white/80 px-6 backdrop-blur">
      <div className="flex flex-1 max-w-md items-center gap-2 rounded-lg border border-black/10 bg-ink-50 px-3 py-1.5 text-sm text-ink-400">
        <Search size={16} />
        <span>Buscar empresas, obrigações...</span>
        <kbd className="ml-auto rounded border border-black/10 bg-white px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </div>

      <div className="flex items-center gap-2">
        {/* Seletor de org */}
        {orgs.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setOrgPickerOpen(o => !o)}
              className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm hover:bg-ink-50"
              disabled={trocando}
            >
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: currentOrg?.cor_primaria ?? '#10B981' }} />
              {currentOrg?.nome ?? '—'}
              <ChevronDown size={14} className="text-ink-400" />
            </button>
            {orgPickerOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-black/10 bg-white p-1 shadow-lg">
                {orgs.map(o => (
                  <button
                    key={o.id}
                    onClick={() => trocarOrg(o.id)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-ink-50"
                  >
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: o.cor_primaria }} />
                    <span className={o.id === currentOrgId ? 'font-semibold text-ink-900' : 'text-ink-700'}>{o.nome}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button aria-label="Notificações" className="rounded-lg p-2 text-ink-700 hover:bg-ink-100">
          <Bell size={18} />
        </button>

        <div className="flex items-center gap-2 border-l border-black/10 pl-3">
          <Avatar nome={userName} size="sm" />
          <div className="hidden text-right md:block">
            <p className="text-sm font-medium text-ink-900">{userName}</p>
            <p className="text-xs text-ink-500">{userEmail}</p>
          </div>
        </div>

        <Button variant="ghost" icon={LogOut} size="sm" onClick={signOut} aria-label="Sair" />
      </div>
    </header>
  )
}
