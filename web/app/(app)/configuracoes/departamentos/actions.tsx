'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Trophy } from 'lucide-react'
import { apiBrowser, type OrgDepartamento } from '@/lib/api'
import { Button, Input, Pill } from '@/components/ui'

interface Membro {
  user_id: string
  role: string
  nome: string
  email?: string
}

export function DepartamentoEditor({ token, dept, membros }: { token: string; dept: OrgDepartamento; membros: Membro[] }) {
  const router = useRouter()
  const [modo, setModo] = useState(dept.premiacao_modo)
  const [meta, setMeta] = useState(String(dept.meta_perc_no_prazo ?? ''))
  const [gerente, setGerente] = useState(dept.gerente_id ?? '')
  const [manualOpen, setManualOpen] = useState(false)
  const [userID, setUserID] = useState('')
  const [pontos, setPontos] = useState('50')
  const [justificativa, setJustificativa] = useState('')

  async function salvar() {
    await apiBrowser(token).updateDepartamento(dept.codigo, {
      premiacao_modo: modo,
      meta_perc_no_prazo: meta ? Number(meta) : undefined,
      gerente_id: gerente || undefined,
    })
    router.refresh()
  }

  async function lancar() {
    await apiBrowser(token).lancamentoManualPontos({
      user_id: userID,
      evento: 'ajuste_manual',
      pontos: Number(pontos),
      justificativa,
      referencia_tipo: 'manual',
    })
    setUserID('')
    setJustificativa('')
    setManualOpen(false)
    router.refresh()
  }

  return (
    <div className="rounded-lg border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink-900">{dept.nome}</h2>
          <p className="mt-1 text-xs text-ink-500">{dept.gerente_nome ? `Gerente: ${dept.gerente_nome}` : 'Sem gerente definido'}</p>
        </div>
        <Pill className={modo === 'automatico' ? 'bg-emerald-100 text-emerald-900 ring-emerald-300' : 'bg-amber-100 text-amber-900 ring-amber-300'}>
          {modo === 'automatico' ? 'Automático' : 'Manual'}
        </Pill>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr_140px_auto]">
        <select value={modo} onChange={event => setModo(event.target.value as 'automatico' | 'manual')} className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm">
          <option value="automatico">Automático</option>
          <option value="manual">Manual</option>
        </select>
        <select value={gerente} onChange={event => setGerente(event.target.value)} className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm">
          <option value="">Sem gerente</option>
          {membros.map(m => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
        </select>
        <Input value={meta} onChange={event => setMeta(event.target.value)} placeholder="Meta %" />
        <Button type="button" variant="primary" icon={Save} onClick={() => void salvar()}>Salvar</Button>
      </div>

      {modo === 'manual' && (
        <div className="mt-3">
          <Button type="button" size="sm" variant="secondary" icon={Trophy} onClick={() => setManualOpen(v => !v)}>Lançar pontos do mês</Button>
          {manualOpen && (
            <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg bg-ink-50 p-3 md:grid-cols-[1fr_100px_1fr_auto]">
              <select value={userID} onChange={event => setUserID(event.target.value)} className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm">
                <option value="">Colaborador</option>
                {membros.filter(m => m.role === dept.codigo || ['admin','gerente'].includes(m.role)).map(m => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
              </select>
              <Input value={pontos} onChange={event => setPontos(event.target.value)} />
              <Input value={justificativa} onChange={event => setJustificativa(event.target.value)} placeholder="Justificativa do fechamento" />
              <Button type="button" variant="success" disabled={!userID || !justificativa || !Number(pontos)} onClick={() => void lancar()}>Lançar</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
