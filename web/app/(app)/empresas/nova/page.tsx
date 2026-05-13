'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { apiBrowser } from '@/lib/api'
import { Card, CardHeader, Button, Input, Textarea } from '@/components/ui'

export default function NovaEmpresaPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [honorario, setHonorario] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('sessão expirada')
      const api = apiBrowser(session.access_token)
      const honCents = Math.round(parseFloat(honorario.replace(/\./g, '').replace(',', '.')) * 100) || 0
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      const empresa = await api.createEmpresa({
        razao_social: razaoSocial.trim(),
        nome_fantasia: nomeFantasia.trim() || undefined,
        cnpj: cnpj.replace(/\D/g, '') || undefined,
        honorario_mensal_cents: honCents,
        tags,
      })
      router.push(`/empresas/${empresa.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/empresas" className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Voltar para empresas
      </Link>

      <Card>
        <CardHeader title="Nova empresa" subtitle="Cadastra uma empresa atendida pelo escritório." />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Razão social *</label>
              <Input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Nome fantasia</label>
              <Input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">CNPJ</label>
              <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Honorário mensal</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-ink-400">R$</span>
                <Input value={honorario} onChange={e => setHonorario(e.target.value)} placeholder="1.500,00" className="pl-9" />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Tags</label>
            <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="grupo-A, cliente-vip, prioridade" />
            <p className="mt-1 text-xs text-ink-400">Separe por vírgula. Use tags para agrupar empresas no dashboard.</p>
          </div>

          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-black/5 pt-3">
            <Link href="/empresas"><Button type="button" variant="ghost">Cancelar</Button></Link>
            <Button type="submit" variant="primary" disabled={loading}>{loading ? 'Cadastrando...' : 'Cadastrar empresa'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
