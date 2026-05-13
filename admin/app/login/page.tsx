'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { Button, Input } from '@/components/ui'
import { Lock, Mail } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createBrowserClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    const next = params.get('next') ?? '/dashboard'
    router.push(next)
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl shadow-black/40">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-2 w-2 rounded-full bg-brand-500" />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-500">Cortex admin</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink-900">Acessar painel</h1>
          <p className="mt-1 text-sm text-ink-500">Apenas super-admins têm acesso a este painel.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700" htmlFor="email">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-2.5 text-ink-400" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voce@usecortex.com.br"
                required
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700" htmlFor="password">Senha</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-2.5 text-ink-400" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="pl-9"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
          )}

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-400">
          Sem conta? O cadastro de super-admin é feito direto no Supabase pelo seu administrador.
        </p>
      </div>
    </main>
  )
}
