/**
 * /aceitar-convite — landing após clicar no email do convite.
 *
 * O Supabase Auth coloca o access_token no fragment (hash) da URL ao redirecionar.
 * O cliente Supabase JS detecta automaticamente e cria a sessão.
 * Aqui, mostramos o form de "definir senha" e ao submeter:
 *   1) updateUser({ password })
 *   2) marca org_membros.aceito_em = now() (via PATCH na própria session)
 *   3) redireciona pra home do escritório
 */
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'

type Phase = 'verificando' | 'pronto' | 'sem-sessao' | 'salvando' | 'feito' | 'erro'

export default function AceitarConvitePage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [phase, setPhase] = useState<Phase>('verificando')
  const [email, setEmail] = useState<string>('')
  const [nome, setNome] = useState<string>('')
  const [orgNome, setOrgNome] = useState<string>('')
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  // Detecta sessão criada pelo magic link
  useEffect(() => {
    void (async () => {
      // Espera Supabase processar o hash (#access_token=...)
      await new Promise(r => setTimeout(r, 300))
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setPhase('sem-sessao')
        return
      }
      const meta = session.user.user_metadata as { nome?: string; org_nome?: string } | null
      setEmail(session.user.email ?? '')
      setNome(meta?.nome ?? '')
      setOrgNome(meta?.org_nome ?? '')
      setPhase('pronto')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 8) {
      setErro('A senha precisa de pelo menos 8 caracteres.')
      return
    }
    if (senha !== senha2) {
      setErro('As senhas não conferem.')
      return
    }
    setPhase('salvando')
    try {
      // 1) Define a senha definitiva
      const { error: upErr } = await supabase.auth.updateUser({ password: senha })
      if (upErr) throw upErr

      // 2) Marca o vínculo como aceito (best-effort — RLS permite o próprio user atualizar)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('org_membros')
          .update({ aceito_em: new Date().toISOString() })
          .eq('user_id', user.id)
          .is('aceito_em', null)
      }

      setPhase('feito')
      setTimeout(() => router.push('/'), 1500)
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err))
      setPhase('erro')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-2 inline-flex items-center gap-2">
            <span className="block h-2.5 w-2.5 rounded-full bg-brand-500" />
            <span className="text-lg font-semibold tracking-tight text-ink-900">cortex</span>
          </div>
          {orgNome ? (
            <h1 className="text-2xl font-semibold text-ink-900">Bem-vindo a {orgNome}</h1>
          ) : (
            <h1 className="text-2xl font-semibold text-ink-900">Aceite seu convite</h1>
          )}
          <p className="mt-1 text-sm text-ink-500">
            Defina sua senha para começar a usar o Cortex.
          </p>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          {phase === 'verificando' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Loader2 size={22} className="animate-spin text-mind-600" />
              <p className="text-sm text-ink-500">Verificando seu convite...</p>
            </div>
          )}

          {phase === 'sem-sessao' && (
            <div className="text-center">
              <p className="text-sm text-ink-700">
                Não conseguimos validar seu convite.
              </p>
              <p className="mt-2 text-xs text-ink-500">
                O link pode ter expirado ou já ter sido usado. Peça ao administrador um novo convite.
              </p>
              <a
                href="/login"
                className="mt-5 inline-block text-sm font-medium text-mind-700 hover:text-mind-900"
              >
                Ir para login →
              </a>
            </div>
          )}

          {phase === 'feito' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <CheckCircle2 size={24} />
              </div>
              <p className="text-sm font-medium text-ink-900">Tudo certo! Entrando...</p>
            </div>
          )}

          {(phase === 'pronto' || phase === 'salvando' || phase === 'erro') && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs">
                <div className="text-ink-500">Conta convidada</div>
                <div className="font-medium text-ink-900">{nome || email}</div>
                {nome && <div className="text-ink-500">{email}</div>}
              </div>

              <div>
                <label htmlFor="senha" className="mb-1 block text-xs font-medium text-ink-700">
                  Nova senha
                </label>
                <input
                  id="senha"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  required
                  minLength={8}
                  placeholder="mínimo 8 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  disabled={phase === 'salvando'}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-mind-500 focus:outline-none focus:ring-1 focus:ring-mind-500"
                />
              </div>

              <div>
                <label htmlFor="senha2" className="mb-1 block text-xs font-medium text-ink-700">
                  Confirme a senha
                </label>
                <input
                  id="senha2"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="digite novamente"
                  value={senha2}
                  onChange={(e) => setSenha2(e.target.value)}
                  disabled={phase === 'salvando'}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-mind-500 focus:outline-none focus:ring-1 focus:ring-mind-500"
                />
              </div>

              {erro && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>
              )}

              <button
                type="submit"
                disabled={phase === 'salvando' || !senha || !senha2}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
              >
                {phase === 'salvando' ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {phase === 'salvando' ? 'Definindo senha...' : 'Definir senha e entrar'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-ink-500">
          Problemas?{' '}
          <a className="text-mind-700 hover:text-mind-900" href="mailto:suporte@usecortex.com.br">
            suporte@usecortex.com.br
          </a>
        </p>
      </div>
    </main>
  )
}
