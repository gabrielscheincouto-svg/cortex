/**
 * Login — magic link via Supabase Auth.
 * Cliente digita email, recebe link no inbox, clica → cai na home.
 */
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Sparkles, Mail } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button, Input, Spinner } from '@/components/ui'

type FormState = 'idle' | 'sending' | 'sent' | 'error'

export function LoginPage() {
  const { status } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [formState, setFormState] = useState<FormState>('idle')
  const [erro, setErro] = useState<string | null>(null)

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setFormState('sending')
    const supabase = getSupabase()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
    if (error) {
      setErro(error.message)
      setFormState('error')
      return
    }
    setFormState('sent')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2">
            <span className="cortex-pulse" aria-hidden="true" />
            <span className="text-xl font-semibold tracking-tight text-ink-900">cortex</span>
          </div>
          <h1 className="text-2xl font-semibold text-ink-900">Portal do cliente</h1>
          <p className="mt-1 text-sm text-ink-500">
            Acompanhe obrigações, baixe guias e fale com o escritório.
          </p>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
          {formState === 'sent' ? (
            <div className="text-center">
              <Mail size={28} className="mx-auto mb-3 text-brand-600" />
              <h2 className="text-base font-semibold text-ink-900">Link enviado</h2>
              <p className="mt-2 text-sm text-ink-600">
                Abra seu email <strong className="text-ink-900">{email}</strong> e clique no
                link para entrar. Se não chegar em 1 minuto, confira o spam.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFormState('idle')
                  setEmail('')
                }}
                className="mt-5 text-xs font-medium text-mind-700 hover:text-mind-900"
              >
                Trocar de email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-800">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  placeholder="voce@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={formState === 'sending'}
                />
              </div>

              {erro && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={formState === 'sending' || !email}
              >
                {formState === 'sending' ? <Spinner size={14} /> : <Sparkles size={14} />}
                {formState === 'sending' ? 'Enviando link…' : 'Entrar com email'}
              </Button>

              <p className="text-center text-xs text-ink-500">
                Sem senha. Você recebe um link mágico no email para entrar.
              </p>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-ink-500">
          Problemas para entrar?{' '}
          <a className="text-mind-700 hover:text-mind-900" href="mailto:suporte@usecortex.com.br">
            suporte@usecortex.com.br
          </a>
        </p>
      </div>
    </div>
  )
}
