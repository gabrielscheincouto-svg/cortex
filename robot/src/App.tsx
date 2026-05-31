import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { tauri, type Status as RoboStatus } from './lib/tauri'
import { Login } from './screens/Login'
import { Setup } from './screens/Setup'
import { Status } from './screens/Status'

type Screen = 'loading' | 'login' | 'setup' | 'status'

export function App() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [status, setStatus] = useState<RoboStatus | null>(null)

  const reload = useCallback(async () => {
    try {
      const s = await tauri.getStatus()
      setStatus(s)
      if (!s.logged_in) {
        setScreen('login')
      } else if (!s.watch_dir) {
        setScreen('setup')
      } else {
        setScreen('status')
      }
    } catch (e) {
      console.error('falha lendo status', e)
      setScreen('login')
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  if (screen === 'loading') {
    return (
      <main className="flex h-full items-center justify-center">
        <Loader2 size={20} className="animate-spin text-ink-400" />
      </main>
    )
  }

  if (screen === 'login') {
    return <Login onSuccess={reload} />
  }
  if (screen === 'setup' || !status) {
    return <Setup onDone={reload} />
  }
  return (
    <Status
      status={status}
      onLogout={async () => { await tauri.logout(); reload() }}
      onChangeFolder={() => setScreen('setup')}
    />
  )
}
