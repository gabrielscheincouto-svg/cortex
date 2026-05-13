'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { apiBrowser, type KanbanStatus, type KanbanTarefa } from '@/lib/api'
import { Button, Input, Pill } from '@/components/ui'

const statuses: { key: KanbanStatus; label: string }[] = [
  { key: 'a_fazer', label: 'A fazer' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'concluido', label: 'Concluído' },
  { key: 'cancelado', label: 'Cancelado' },
]

export function KanbanBoard({ token }: { token: string }) {
  const router = useRouter()
  const [tarefas, setTarefas] = useState<KanbanTarefa[]>([])
  const [titulo, setTitulo] = useState('')

  useEffect(() => {
    apiBrowser(token).listKanbanTarefas().then(setTarefas).catch(() => setTarefas([]))
  }, [token])

  async function criar() {
    if (!titulo.trim()) return
    await apiBrowser(token).createKanbanTarefa({ titulo, prioridade: 'media' })
    setTitulo('')
    setTarefas(await apiBrowser(token).listKanbanTarefas())
    router.refresh()
  }

  async function mover(id: string, status: KanbanStatus) {
    await apiBrowser(token).updateKanbanTarefa(id, { status })
    setTarefas(prev => prev.map(t => t.id === id ? { ...t, status } : t))
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={titulo} onChange={event => setTitulo(event.target.value)} placeholder="Nova tarefa interna" />
        <Button type="button" variant="primary" icon={Plus} onClick={() => void criar()}>Criar</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {statuses.map(col => (
          <section key={col.key} className="min-h-96 rounded-lg bg-ink-50 p-3">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">{col.label}</h2>
            <div className="space-y-2">
              {tarefas.filter(t => t.status === col.key).map(t => (
                <article key={t.id} className="rounded-lg border border-black/10 bg-white p-3">
                  <p className="font-medium text-ink-900">{t.titulo}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Pill className="bg-ink-100 text-ink-700 ring-ink-200">{t.prioridade ?? 'media'}</Pill>
                    <select value={t.status} onChange={event => void mover(t.id, event.target.value as KanbanStatus)} className="rounded border border-black/10 bg-white px-2 py-1 text-xs">
                      {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
