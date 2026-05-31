'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { fetchIrpf, type IrpfDeclarante } from '@/lib/irpf'
import { Button, Card, Input } from '@/components/ui'

export function NovoDeclaranteButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>
        Novo declarante
      </Button>
      {open && <NovoDeclaranteModal onClose={() => setOpen(false)} />}
    </>
  )
}

function NovoDeclaranteModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [cpf, setCpf] = useState('')
  const [nome, setNome] = useState('')
  const [dataNasc, setDataNasc] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')
      await fetchIrpf<IrpfDeclarante>(session.access_token, '/api/v1/irpf/declarantes', {
        method: 'POST',
        body: JSON.stringify({
          cpf: cpf.replace(/\D/g, ''),
          nome_completo: nome.trim(),
          data_nascimento: dataNasc || undefined,
          email: email.trim() || undefined,
          telefone: telefone.trim() || undefined,
          observacoes: observacoes.trim() || undefined,
        }),
      })
      router.refresh()
      onClose()
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : String(e2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Novo declarante</h2>
            <p className="mt-1 text-sm text-ink-500">Pessoa física que terá uma ou mais declarações</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-500 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">CPF *</label>
              <Input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Data de nascimento</label>
              <Input type="date" value={dataNasc} onChange={e => setDataNasc(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Nome completo *</label>
            <Input value={nome} onChange={e => setNome(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Email</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Telefone</label>
              <Input value={telefone} onChange={e => setTelefone(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Observações</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}

          <div className="flex justify-end gap-2 border-t border-black/5 pt-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
