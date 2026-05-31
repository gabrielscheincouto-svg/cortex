'use client'

import { useEffect, useState } from 'react'
import { CortexDrawer } from './drawer'
import { CortexAvatar } from './message-bubble'
import { CortexQuick } from './quick'

/**
 * Dois pontos de entrada para o Cortex:
 *  - Botão flutuante bottom-right → CortexDrawer (chat conversacional)
 *  - Cmd+K em qualquer lugar     → CortexQuick (palette tipo Linear/Raycast)
 *
 * Esc fecha o que estiver aberto.
 */
export function CortexLauncher({ token, enabled }: { token?: string; enabled: boolean }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)

  useEffect(() => {
    if (!enabled || !token) return
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setQuickOpen(v => !v)
        setDrawerOpen(false)
      }
      // Shift+Cmd+K abre o drawer (chat)
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setDrawerOpen(v => !v)
        setQuickOpen(false)
      }
      if (event.key === 'Escape') {
        setQuickOpen(false)
        setDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, token])

  if (!enabled || !token) return null

  return (
    <>
      <button
        type="button"
        aria-label="Abrir Cortex"
        onClick={() => setDrawerOpen(true)}
        className="cortex-pulse-shadow fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white ring-1 ring-mind-200 shadow-lg shadow-mind-500/15 transition hover:ring-mind-500 hover:shadow-mind-500/30"
      >
        <CortexAvatar size={32} />
      </button>
      <CortexDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} token={token} />
      <CortexQuick  open={quickOpen}  onClose={() => setQuickOpen(false)}  token={token} />
    </>
  )
}
