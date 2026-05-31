/**
 * UpdatePrompt — toast que aparece quando há uma versão nova do app.
 *
 * O vite-plugin-pwa em modo 'prompt' não recarrega sozinho: notifica que
 * existe um novo service worker pronto. A gente mostra um banner discreto
 * convidando o usuário a recarregar. Também trata o evento de offline-ready
 * (mostrado UMA vez no primeiro acesso) e exibe um toast de "pronto para uso offline".
 */
import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, Wifi, X } from 'lucide-react'
import { Button } from '@/components/ui'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      // Checa update a cada 60 min — não bombardeia o servidor, mas pega releases razoavelmente rápido
      if (reg) {
        setInterval(() => { void reg.update() }, 60 * 60 * 1000)
      }
    },
  })
  const [reloading, setReloading] = useState(false)

  // Esconde "pronto offline" automaticamente após 6 segundos
  useEffect(() => {
    if (offlineReady) {
      const t = setTimeout(() => setOfflineReady(false), 6000)
      return () => clearTimeout(t)
    }
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md">
        {needRefresh ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-mind-200 bg-white p-4 shadow-xl ring-1 ring-mind-100"
          >
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mind-50 text-mind-700">
              <RefreshCw size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900">Nova versão disponível</p>
              <p className="mt-0.5 text-xs text-ink-500">
                Atualizamos o portal. Recarregue pra usar a versão mais recente.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  icon={RefreshCw}
                  disabled={reloading}
                  onClick={() => {
                    setReloading(true)
                    void updateServiceWorker(true)
                  }}
                >
                  {reloading ? 'Atualizando…' : 'Atualizar agora'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
                  Depois
                </Button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Dispensar"
              onClick={() => setNeedRefresh(false)}
              className="rounded-full p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <X size={14} />
            </button>
          </div>
        ) : offlineReady ? (
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-white p-3 shadow-lg ring-1 ring-brand-100"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Wifi size={14} />
            </div>
            <p className="text-sm text-ink-800">
              Pronto pra usar mesmo offline.
            </p>
            <button
              type="button"
              aria-label="Dispensar"
              onClick={() => setOfflineReady(false)}
              className="ml-auto rounded-full p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
