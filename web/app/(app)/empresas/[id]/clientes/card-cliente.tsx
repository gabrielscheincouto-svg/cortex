'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, KeyRound, UserX, UserCheck, Loader2 } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'

/**
 * Menu de ações por cliente: resetar senha, ativar/desativar.
 */
export function CardClienteAcoes({
  clienteId, email, ativo,
}: {
  clienteId: string
  email: string
  ativo: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [novaSenha, setNovaSenha] = useState<string | null>(null)

  async function toggleAtivo() {
    setOpen(false)
    startTransition(async () => {
      const supabase = createBrowserClient()
      await supabase
        .from('empresa_usuarios_finais')
        .update({ ativo: !ativo })
        .eq('id', clienteId)
      router.refresh()
    })
  }

  async function resetarSenha() {
    setOpen(false)
    if (!confirm(`Resetar senha de ${email}? Vai gerar nova senha temporária.`)) return
    startTransition(async () => {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/clientes/resetar-senha', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ cliente_id: clienteId }),
      })
      const body = await res.json()
      if (res.ok && body.senha_temporaria) {
        setNovaSenha(body.senha_temporaria)
      } else {
        alert(body?.error ?? 'erro ao resetar')
      }
    })
  }

  return (
    <div className="relative flex items-center gap-2">
      {novaSenha && (
        <span className="rounded-md bg-amber-50 px-2 py-1 font-mono text-[11px] text-amber-900 ring-1 ring-amber-200">
          nova senha: <strong>{novaSenha}</strong>
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={pending}
        className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100"
        aria-label="Ações do cliente"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <MoreVertical size={16} />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-20 min-w-[200px] rounded-lg border border-black/10 bg-white p-1 shadow-xl">
            <button type="button" onClick={resetarSenha}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-ink-700 hover:bg-ink-50">
              <KeyRound size={12} /> Resetar senha
            </button>
            <button type="button" onClick={toggleAtivo}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-ink-700 hover:bg-ink-50">
              {ativo ? <><UserX size={12} /> Desativar acesso</> : <><UserCheck size={12} /> Reativar acesso</>}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
