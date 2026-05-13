'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Mail } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { Button, Input } from '@/components/ui'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-ink-900 text-white">Carregando…</div>}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
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
    router.push(params.get('next') ?? '/home')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white text-base font-bold">
            C
          </div>
          <h1 className="text-2xl font-semibold text-ink-900">Cortex</h1>
          <p className="mt-1 text-sm text-ink-500">Entre com seu email do escritório.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-2.5 text-ink-400" />
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="voce@escritorio.com.br" className="pl-9" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Senha</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-2.5 text-ink-400" />
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="pl-9" />
            </div>
          </div>

          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-400">
          Sem conta? Peça um convite ao administrador do seu escritório.
        </p>
      </div>
    </main>
  )
}
