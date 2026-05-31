'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Mail } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { Button, Input } from '@/components/ui'

export function LoginPortalForm({ empresaSlug }: { empresaSlug: string }) {
  return (
    <Suspense fallback={<p className="mt-4 text-sm text-ink-500">Carregando…</p>}>
      <Form empresaSlug={empresaSlug} />
    </Suspense>
  )
}

function Form({ empresaSlug }: { empresaSlug: string }) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      // 1. Login Supabase
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      const userId = data.user?.id
      if (!userId) throw new Error('Sessão não criada')

      // 2. Verifica se esse user pertence à empresa pelo email cadastrado
      const { data: vinculo } = await supabase
        .from('empresa_usuarios_finais')
        .select('id, empresa_id, ativo, empresas!empresa_id(slug_publico)')
        .eq('email', email)
        .eq('ativo', true)
        .maybeSingle()

      const empresaVinculo = vinculo && Array.isArray((vinculo as any).empresas)
        ? (vinculo as any).empresas[0]
        : (vinculo as any)?.empresas

      if (!vinculo || empresaVinculo?.slug_publico !== empresaSlug) {
        await supabase.auth.signOut()
        throw new Error('Esse email não tem acesso a este portal. Solicite ao seu escritório.')
      }

      // 3. Atualiza user_id se ainda não estiver vinculado e marca primeiro_login
      await supabase
        .from('empresa_usuarios_finais')
        .update({ user_id: userId, primeiro_login_em: new Date().toISOString() })
        .eq('id', vinculo.id)
        .is('primeiro_login_em', null)

      router.push(`/portal/${empresaSlug}`)
      router.refresh()
    } catch (e: any) {
      setErro(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-700">Email</label>
        <div className="relative">
          <Mail size={16} className="absolute left-3 top-2.5 text-ink-400" />
          <Input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="seu@email.com" className="pl-9" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-700">Senha</label>
        <div className="relative">
          <Lock size={16} className="absolute left-3 top-2.5 text-ink-400" />
          <Input value={password} onChange={e => setPassword(e.target.value)} type="password" required className="pl-9" />
        </div>
      </div>
      {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}
      <Button type="submit" variant="primary" disabled={loading} className="w-full bg-mind-500 hover:bg-mind-600">
        {loading ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
