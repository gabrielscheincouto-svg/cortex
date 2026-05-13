'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiBrowser, type FrequenciaDia } from '@/lib/api'
import { Button } from '@/components/ui'

const status = ['presente', 'falta', 'folga', 'atestado', 'home_office', 'ferias'] as const

export function FrequenciaGrid({ token, competencia }: { token: string; competencia: string }) {
  const [rows, setRows] = useState<FrequenciaDia[]>([])
  const dias = useMemo(() => {
    const [ano, mes] = competencia.split('-').map(Number)
    const total = new Date(ano, mes, 0).getDate()
    return Array.from({ length: total }, (_, i) => `${competencia}-${String(i + 1).padStart(2, '0')}`)
  }, [competencia])
  const users = useMemo(() => Array.from(new Map(rows.map(r => [r.user_id, r.nome])).entries()), [rows])

  useEffect(() => {
    apiBrowser(token).listFrequencia(competencia).then(setRows).catch(() => setRows([]))
  }, [token, competencia])

  async function marcar(userId: string, data: string, value: typeof status[number]) {
    await apiBrowser(token).patchFrequencia(userId, data, { status: value, horario_chegada: value === 'presente' ? '08:00' : undefined })
    setRows(await apiBrowser(token).listFrequencia(competencia))
  }

  async function fechar() {
    await apiBrowser(token).fecharMesFrequencia(competencia)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="primary" onClick={() => void fechar()}>Fechar mês</Button>
      </div>
      <div className="overflow-auto rounded-lg border border-black/10">
        <table className="min-w-full text-xs">
          <thead className="bg-ink-50">
            <tr>
              <th className="sticky left-0 bg-ink-50 px-3 py-2 text-left">Colaborador</th>
              {dias.map(d => <th key={d} className="px-2 py-2">{d.slice(-2)}</th>)}
            </tr>
          </thead>
          <tbody>
            {users.map(([userId, nome]) => (
              <tr key={userId} className="border-t border-black/5">
                <td className="sticky left-0 bg-white px-3 py-2 font-medium text-ink-900">{nome}</td>
                {dias.map(dia => {
                  const atual = rows.find(r => r.user_id === userId && r.data === dia)?.status ?? 'presente'
                  return (
                    <td key={dia} className="p-1">
                      <select value={atual} onChange={event => void marcar(userId, dia, event.target.value as typeof status[number])} className="rounded border border-black/10 bg-white px-1 py-0.5">
                        {status.map(s => <option key={s} value={s}>{s[0]}</option>)}
                      </select>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
