'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Link2, Plus, Trash2 } from 'lucide-react'
import { apiBrowser } from '@/lib/api'
import { Button } from '@/components/ui'

export function HerdarObrigacaoButton({ token, obrigacaoId }: { token: string; obrigacaoId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function herdar() {
    setLoading(true)
    try {
      await apiBrowser(token).herdarObrigacao(obrigacaoId)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return <Button type="button" size="sm" variant="primary" icon={Plus} disabled={loading} onClick={() => void herdar()}>Adicionar</Button>
}

export function VincularEmpresaForm({
  token,
  obrigacaoId,
  empresas,
  responsaveis,
}: {
  token: string;
  obrigacaoId: string;
  empresas: { id: string; nome: string }[];
  responsaveis: { id: string; nome: string }[];
}) {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? '')
  const [responsavelId, setResponsavelId] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function vincular() {
    if (!empresaId) return
    setLoading(true)
    setErro(null)
    try {
      await apiBrowser(token).createObrigacaoEmpresa({
        obrigacao_id: obrigacaoId,
        empresa_id: empresaId,
        ...(responsavelId ? { responsavel_id: responsavelId } : {}),
      })
      router.refresh()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível vincular')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <select value={empresaId} onChange={event => setEmpresaId(event.target.value)} className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm">
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <select value={responsavelId} onChange={event => setResponsavelId(event.target.value)} className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm">
          <option value="">Sem responsável</option>
          {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
      </div>
      {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}
      <Button type="button" variant="primary" icon={Link2} disabled={loading || !empresaId} onClick={() => void vincular()}>Vincular empresa</Button>
    </div>
  )
}

export function DesvincularButton({ token, vinculoId }: { token: string; vinculoId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function desvincular() {
    setLoading(true)
    try {
      await apiBrowser(token).deleteObrigacaoEmpresa(vinculoId)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return <Button type="button" size="sm" variant="danger" icon={Trash2} disabled={loading} onClick={() => void desvincular()}>Desvincular</Button>
}
