'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { apiBrowser } from '@/lib/api'
import { Card, CardHeader, Button, Input } from '@/components/ui'

type Plano = 'free' | 'pro' | 'enterprise'

export default function NovoEscritorioPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [slug, setSlug] = useState('')
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [plano, setPlano] = useState<Plano>('pro')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada — faça login novamente')

      const api = apiBrowser(session.access_token)
      const org = await api.createOrg({
        slug: slug.trim().toLowerCase(),
        nome: nome.trim(),
        cnpj: cnpj.trim() || undefined,
        razao_social: razaoSocial.trim() || undefined,
        plano_codigo: plano,
      })
      router.push(`/escritorios/${org.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/escritorios" className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Voltar para escritórios
      </Link>

      <Card>
        <CardHeader title="Novo escritório" subtitle="Cria o tenant, vincula você como admin e ativa o trial." />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Slug (subdomínio)</label>
              <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="cecopel" required pattern="[a-z0-9-]+" />
              <p className="mt-1 text-xs text-ink-400">Vira o subdomínio: <span className="font-mono">{slug || 'slug'}.usecortex.com.br</span></p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Nome</label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Cortex Contabilidade" required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">CNPJ (opcional)</label>
              <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Razão social (opcional)</label>
              <Input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Plano inicial</label>
            <div className="grid grid-cols-3 gap-2">
              {(['free', 'pro', 'enterprise'] as Plano[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlano(p)}
                  className={`rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                    plano === p
                      ? 'border-brand-500 bg-brand-50 text-brand-900 font-medium'
                      : 'border-black/10 bg-white hover:bg-ink-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Link href="/escritorios">
              <Button type="button" variant="ghost">Cancelar</Button>
            </Link>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Criando...' : 'Criar escritório'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
