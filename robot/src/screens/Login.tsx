import { useState, type FormEvent } from 'react'
import { Lock, Mail } from 'lucide-react'
import { Button, Card, Input } from '../lib/ui'
import { tauri } from '../lib/tauri'

/**
 * Tela de login. O robô NÃO armazena a senha — só a usa uma vez para obter o JWT
 * do Supabase Auth, que vai para o chaveiro do sistema operacional.
 *
 * Em produção, esses valores virão de um config remoto (ou serão hardcoded por edição
 * do código no build, já que o robô é distribuído pela CECOPEL).
 */
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL ?? 'https://xxxxxxxxxxx.supabase.co'
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? ''

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await tauri.login(SUPABASE_URL, SUPABASE_ANON_KEY, email, password)
      onSuccess()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-white font-bold">C</div>
          <h1 className="text-xl font-semibold text-ink-900">CECOPEL · Robô</h1>
          <p className="mt-1 text-sm text-ink-500">Conecte ao seu escritório</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-2.5 text-ink-400" />
              <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Senha</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-2.5 text-ink-400" />
              <Input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="pl-9" />
            </div>
          </div>

          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 break-words">{error}</p>}

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p className="mt-5 text-center text-[11px] text-ink-400">
          Suas credenciais são guardadas no chaveiro do sistema (Keychain/Credential Manager). Nunca em arquivo.
        </p>
      </Card>
    </main>
  )
}
