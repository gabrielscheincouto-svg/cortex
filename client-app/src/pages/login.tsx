/**
 * Login do PWA cliente.
 *
 * Modos:
 *   - "senha": email + senha (padrão para usuários criados pelo escritório
 *              com senha temporária).
 *   - "link":  magic link via email (alternativa quando o cliente esqueceu a senha
 *              ou prefere não digitar).
 */
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Sparkles, Mail, LogIn } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button, Input, Spinner } from '@/components/ui'

type FormState = 'idle' | 'sending' | 'sent' | 'error'
type Modo = 'senha' | 'link'

export function LoginPage() {
  const { status } = useAuth()
  const location = useLocation()
  const [modo, setModo] = useState<Modo>('senha')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [formState, setFormState] = useState<FormState>('idle')
  const [erro, setErro] = useState<string | null>(null)

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function handleSubmitSenha(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setFormState('sending')
    const supabase = getSupabase()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErro(traduzErro(error.message))
      setFormState('error')
      return
    }
    setFormState('idle')
    // o AuthProvider escuta onAuthStateChange e redireciona via <Navigate />
  }

  async function handleSubmitLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setFormState('sending')
    const supabase = getSupabase()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    if (error) {
      setErro(traduzErro(error.message))
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
          ) : modo === 'senha' ? (
            <form onSubmit={handleSubmitSenha} className="space-y-4">
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

              <div>
                <label htmlFor="senha" className="mb-1.5 block text-sm font-medium text-ink-800">
                  Senha
                </label>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
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
                disabled={formState === 'sending' || !email || !senha}
              >
                {formState === 'sending' ? <Spinner size={14} /> : <LogIn size={14} />}
                {formState === 'sending' ? 'Entrando…' : 'Entrar'}
              </Button>

              <div className="border-t border-ink-100 pt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setModo('link')
                    setErro(null)
                  }}
                  className="text-xs font-medium text-mind-700 hover:text-mind-900"
                >
                  Esqueci a senha · entrar por link
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitLink} className="space-y-4">
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
                {formState === 'sending' ? 'Enviando link…' : 'Receber link no email'}
              </Button>

              <div className="border-t border-ink-100 pt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setModo('senha')
                    setErro(null)
                  }}
                  className="text-xs font-medium text-mind-700 hover:text-mind-900"
                >
                  ← Voltar pra entrar com senha
                </button>
              </div>
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

function traduzErro(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Email ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'Email ainda não confirmado.'
  if (/over_email_send_rate_limit/i.test(msg)) return 'Aguarde alguns segundos antes de tentar novamente.'
  return msg
}
