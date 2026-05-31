'use client'

/**
 * Matriz Controle Contábil — empresa × mês × status.
 * Inline edit: click na célula abre dropdown com os status. Salva via Supabase.
 * Lock por mês: cadeado no header da coluna; células bloqueadas read-only.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ChevronDown } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'] as const

type Status = 'pendente' | 'c' | 'c_d' | 'l' | 'd' | 's' | 'n'

const STATUS_INFO: Record<Status, { label: string; cell: string; dot?: string }> = {
  pendente: { label: '—',   cell: 'bg-white text-ink-300' },
  c:        { label: 'C',   cell: 'bg-emerald-600 text-white font-semibold' },
  c_d:      { label: 'C/D', cell: 'bg-emerald-300 text-emerald-950 font-semibold' },
  l:        { label: 'L',   cell: 'bg-amber-400 text-amber-950 font-semibold' },
  d:        { label: 'D',   cell: 'bg-sky-500 text-white font-semibold' },
  s:        { label: 'S',   cell: 'bg-ink-200 text-ink-700 font-semibold' },
  n:        { label: 'N',   cell: 'bg-ink-100 text-ink-500 font-medium [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(0,0,0,0.06)_3px,rgba(0,0,0,0.06)_6px)]' },
}

const STATUS_ORDEM: Status[] = ['c', 'c_d', 'l', 'd', 's', 'n', 'pendente']

interface Linha {
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnpj: string
  regime: string | null
  responsavel: { id: string; nome: string } | null
}

export function MatrizControle({
  ano,
  linhas,
  celulaMap,
  fechados,
}: {
  ano: number
  linhas: Linha[]
  celulaMap: Record<string, { id: string; status: string }>
  fechados: number[]
}) {
  const fechadosSet = new Set(fechados)

  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
      <p className="border-b border-black/5 bg-ink-50 px-3 py-1.5 text-[11px] text-ink-500 sm:hidden">
        Role lateralmente para ver todos os meses →
      </p>
      <table className="w-full text-sm" style={{ minWidth: 1000 }}>
        <thead>
          <tr className="bg-ink-900 text-white">
            <th className="sticky left-0 z-10 w-8 bg-ink-900 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">#</th>
            <th className="sticky left-8 z-10 min-w-[220px] bg-ink-900 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Empresa</th>
            <th className="min-w-[140px] bg-ink-900 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Responsável</th>
            {MESES.map((m, i) => (
              <th key={m} className="min-w-[64px] px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1">
                  {m}
                  {fechadosSet.has(i + 1) && <Lock size={10} className="text-amber-400" />}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {linhas.length === 0 ? (
            <tr>
              <td colSpan={15} className="px-6 py-10 text-center text-sm text-ink-400">
                Nenhuma empresa encontrada com os filtros aplicados.
              </td>
            </tr>
          ) : (
            linhas.map((linha, idx) => (
              <tr key={linha.id} className="group hover:bg-ink-50/40">
                <td className="sticky left-0 z-10 bg-white px-2 py-2 text-center text-xs text-ink-400 group-hover:bg-ink-50">{idx + 1}</td>
                <td className="sticky left-8 z-10 bg-white px-3 py-2 group-hover:bg-ink-50">
                  <p className="font-medium text-ink-900 leading-tight">{linha.nome_fantasia || linha.razao_social}</p>
                  <p className="text-[11px] text-ink-500">
                    {linha.regime && <span className="font-mono">{linha.regime}</span>}
                  </p>
                </td>
                <td className="px-3 py-2">
                  {linha.responsavel ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-mind-50 px-2 py-0.5 text-xs font-medium text-mind-800 ring-1 ring-mind-200">
                      {linha.responsavel.nome}
                    </span>
                  ) : (
                    <span className="text-[11px] italic text-ink-400">sem responsável</span>
                  )}
                </td>
                {MESES.map((_, i) => {
                  const mes = i + 1
                  const celula = celulaMap[`${linha.id}|${mes}`]
                  const bloqueado = fechadosSet.has(mes)
                  return (
                    <td key={mes} className="border-l border-black/5 p-0 text-center">
                      <CelulaEditavel
                        empresaId={linha.id}
                        ano={ano}
                        mes={mes}
                        celulaId={celula?.id}
                        status={(celula?.status as Status) ?? 'pendente'}
                        bloqueado={bloqueado}
                      />
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function CelulaEditavel({
  empresaId, ano, mes, celulaId, status, bloqueado,
}: {
  empresaId: string
  ano: number
  mes: number
  celulaId?: string
  status: Status
  bloqueado: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [statusLocal, setStatusLocal] = useState<Status>(status)

  const info = STATUS_INFO[statusLocal]

  async function escolher(novo: Status) {
    setOpen(false)
    if (novo === statusLocal) return
    const supabase = createBrowserClient()
    setStatusLocal(novo)
    startTransition(async () => {
      try {
        if (celulaId) {
          await supabase
            .from('controle_contabil_celulas')
            .update({ status: novo, atualizado_em: new Date().toISOString() })
            .eq('id', celulaId)
        } else {
          // Precisa do org_id pra inserir — buscamos do profile do user atual
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          const { data: profile } = await supabase
            .from('profiles').select('current_org_id').eq('id', user.id).single()
          if (!profile?.current_org_id) return
          await supabase
            .from('controle_contabil_celulas')
            .insert({
              org_id: profile.current_org_id,
              empresa_id: empresaId,
              ano, mes, status: novo,
              atualizado_por: user.id,
            })
        }
        router.refresh()
      } catch (e) {
        console.error(e)
        setStatusLocal(status) // rollback visual
      }
    })
  }

  if (bloqueado) {
    return (
      <div className={`flex h-10 w-full items-center justify-center text-xs ${info.cell} opacity-70`}>
        {info.label}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={pending}
        className={`flex h-10 w-full items-center justify-center text-xs transition hover:brightness-110 ${info.cell} ${pending ? 'opacity-60' : ''}`}
      >
        {info.label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 rounded-lg border border-black/10 bg-white p-1 shadow-xl">
            {STATUS_ORDEM.map(s => {
              const i = STATUS_INFO[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => escolher(s)}
                  className={`flex w-32 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs hover:bg-ink-50 ${s === statusLocal ? 'bg-ink-50' : ''}`}
                >
                  <span className={`inline-flex h-5 w-9 items-center justify-center rounded text-[10px] ${i.cell}`}>
                    {i.label}
                  </span>
                  <span className="text-ink-700">{STATUS_LABEL_LONGO[s]}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

const STATUS_LABEL_LONGO: Record<Status, string> = {
  pendente: 'Pendente',
  c:        'Conciliado',
  c_d:      'Conc. ag. doc',
  l:        'Lançado',
  d:        'Doc recebido',
  s:        'Suspensa',
  n:        'Não receberá',
}
