/**
 * OfflineIndicator — barra discreta no topo quando perde conexão.
 * Esconde quando volta online. Mostra "conectando…" durante reconexão.
 */
import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineIndicator() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-medium text-white shadow"
    >
      <WifiOff size={12} />
      Sem conexão — você pode ver o que já carregou; mudanças sincronizam quando voltar.
    </div>
  )
}
