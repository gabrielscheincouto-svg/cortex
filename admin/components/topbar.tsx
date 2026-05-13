'use client'

import { useRouter } from 'next/navigation'
import { LogOut, User } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { Button } from './ui'

export function Topbar({ userEmail, userName }: { userEmail: string; userName: string }) {
  const router = useRouter()
  const supabase = createBrowserClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-black/10 bg-white/80 px-6 backdrop-blur">
      <div />
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-ink-900">{userName}</p>
          <p className="text-xs text-ink-500">{userEmail}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <User size={16} />
        </div>
        <Button variant="ghost" icon={LogOut} onClick={signOut} aria-label="Sair">
          Sair
        </Button>
      </div>
    </header>
  )
}
