/**
 * Lista de Minhas Tarefas priorizadas (paridade legado).
 * Mostra tarefas do user atual com: cliente em destaque, depto colorido, prazo, status badge.
 */

import Link from 'next/link'
import { ListChecks } from 'lucide-react'

const DEPT_COR: Record<string, string> = {
  contabil:    'text-emerald-700',
  fiscal:      'text-rose-700',
  pessoal:     'text-sky-700',
  societario:  'text-mind-700',
  manutencao:  'text-amber-700',
  gestao:      'text-ink-700',
  outros:      'text-ink-500',
}

const STATUS_BADGE: Record<string, string> = {
  a_fazer:       'bg-amber-100 text-amber-900 ring-amber-300',
  em_andamento:  'bg-sky-100 text-sky-900 ring-sky-300',
  concluido:     'bg-emerald-100 text-emerald-900 ring-emerald-300',
  cancelado:     'bg-ink-100 text-ink-700 ring-ink-200',
}

const STATUS_LABEL: Record<string, string> = {
  a_fazer:       'Solicitado',
  em_andamento:  'Em andamento',
  concluido:     'Concluído',
  cancelado:     'Cancelado',
}

export interface MinhasTarefasItem {
  id: string
  titulo: string
  cliente?: string | null
  departamento?: string | null
  prazo?: string | null
  status: string
}

export function MinhasTarefas({ tarefas }: { tarefas: MinhasTarefasItem[] }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <ListChecks size={18} className="text-ink-700" />
          <p className="font-semibold text-sm text-ink-900">Minhas Tarefas</p>
        </div>
        <Link href="/kanban" prefetch={false} className="text-xs font-medium text-mind-700 hover:text-mind-900">
          Ver tudo →
        </Link>
      </div>

      {tarefas.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-ink-400">
          Nenhuma tarefa atribuída a você no momento.
        </div>
      ) : (
        <ul className="divide-y divide-black/5">
          {tarefas.map(t => (
            <li key={t.id} className="px-5 py-3.5 hover:bg-ink-50/60">
              <Link href={`/kanban?tarefa=${t.id}`} prefetch={false} className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {t.cliente && (
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                      {t.cliente}
                    </p>
                  )}
                  <p className="mt-0.5 text-sm font-medium leading-snug text-ink-900">{t.titulo}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-ink-500">
                    {t.departamento && (
                      <span className={`font-medium ${DEPT_COR[t.departamento] ?? DEPT_COR.outros}`}>
                        {t.departamento.charAt(0).toUpperCase() + t.departamento.slice(1)}
                      </span>
                    )}
                    {t.prazo && (
                      <span className="inline-flex items-center gap-1">
                        <span>·</span>
                        <span>{new Date(t.prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                      </span>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${STATUS_BADGE[t.status] ?? STATUS_BADGE.a_fazer}`}>
                  {STATUS_LABEL[t.status] ?? t.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
