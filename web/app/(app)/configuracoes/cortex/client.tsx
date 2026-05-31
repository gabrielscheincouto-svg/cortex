'use client'

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { API_BASE_URL } from '@/lib/api'
import { Button, Pill } from '@/components/ui'

const FERRAMENTA_LABELS: Record<string, { titulo: string; descricao: string }> = {
  criar_tarefa_kanban: {
    titulo: 'Criar tarefa no Kanban',
    descricao: 'Adiciona uma nova tarefa atribuída ao próprio user que confirmou.',
  },
  mudar_status_entrega: {
    titulo: 'Mudar status de entrega',
    descricao: 'Marca uma entrega como entregue, em andamento, etc.',
  },
  postar_mural: {
    titulo: 'Publicar no mural',
    descricao: 'Cria um aviso/comunicado no mural interno da equipe.',
  },
  lancar_pontos_manual: {
    titulo: 'Lançar pontos manualmente',
    descricao: 'Adiciona ou subtrai pontos de um membro da equipe. Sensível.',
  },
  responder_solicitacao: {
    titulo: 'Responder solicitação de cliente',
    descricao: 'Envia mensagem no fio de uma solicitação aberta.',
  },
}

export interface PermissaoRow {
  ferramenta: string
  permitida: boolean
  roles_permitidas: string[]
}

export function PermissoesTable({ permissoes, todosRoles }: { permissoes: PermissaoRow[]; todosRoles: string[] }) {
  return (
    <div className="divide-y divide-black/5">
      {permissoes.map(p => (
        <FerramentaRow key={p.ferramenta} permissao={p} todosRoles={todosRoles} />
      ))}
    </div>
  )
}

function FerramentaRow({ permissao, todosRoles }: { permissao: PermissaoRow; todosRoles: string[] }) {
  const meta = FERRAMENTA_LABELS[permissao.ferramenta] ?? { titulo: permissao.ferramenta, descricao: '' }

  const [permitida, setPermitida] = useState(permissao.permitida)
  const [roles, setRoles] = useState<string[]>(permissao.roles_permitidas)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  function toggleRole(r: string) {
    setRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }

  async function salvar() {
    setSaving(true)
    setErro(null)
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')
      const res = await fetch(`${API_BASE_URL}/api/v1/cortex/permissoes/${permissao.ferramenta}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          permitida,
          roles_permitidas: roles,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error((body as any)?.message ?? `${res.status}`)
      }
      setSavedAt(Date.now())
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="py-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-ink-900">{meta.titulo}</p>
            {!permitida && <Pill className="bg-rose-100 text-rose-700">Desativada</Pill>}
            {savedAt && Date.now() - savedAt < 3000 && <Pill className="bg-emerald-100 text-emerald-700">Salvo</Pill>}
          </div>
          <p className="mt-1 text-xs text-ink-500">{meta.descricao}</p>
          <p className="mt-1 font-mono text-[11px] text-ink-400">{permissao.ferramenta}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={permitida}
            onChange={e => setPermitida(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-mind-600 focus:ring-mind-500"
          />
          Permitida
        </label>
      </div>

      <div className="mb-3">
        <p className="mb-1 text-xs font-medium text-ink-700">Roles que podem confirmar</p>
        <div className="flex flex-wrap gap-1.5">
          {todosRoles.map(r => {
            const ativo = roles.includes(r)
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggleRole(r)}
                disabled={!permitida}
                className={`rounded-full px-2.5 py-1 text-xs ring-1 ring-inset transition ${
                  ativo
                    ? 'bg-mind-500 text-white ring-mind-500'
                    : 'bg-white text-ink-700 ring-black/15 hover:bg-mind-50'
                } ${!permitida ? 'opacity-40' : ''}`}
              >
                {r}
              </button>
            )
          })}
        </div>
        {roles.length === 0 && permitida && (
          <p className="mt-1 text-xs text-amber-700">Vazio = qualquer role da org pode confirmar.</p>
        )}
      </div>

      {erro && <p className="mb-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          icon={saving ? Loader2 : Save}
          onClick={salvar}
          disabled={saving}
          className="bg-mind-500 hover:bg-mind-600"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}
