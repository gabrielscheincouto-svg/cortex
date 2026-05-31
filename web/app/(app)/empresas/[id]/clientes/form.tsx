'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, User, Phone, ShieldCheck, Loader2, Copy, Check } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'

type Role = 'titular' | 'financeiro' | 'contador' | 'visualizador'

interface ConviteResultado {
  email: string
  nome: string
  senha_temporaria: string
  portal_url?: string
}

export function FormConvidarCliente({
  empresaId, empresaNome, portalUrl,
}: {
  empresaId: string
  empresaNome: string
  portalUrl?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ConviteResultado | null>(null)
  const [copiado, setCopiado] = useState<'senha' | 'link' | null>(null)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [role, setRole] = useState<Role>('titular')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sessão expirada')

      const res = await fetch('/api/clientes/convidar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ empresa_id: empresaId, nome, email, telefone: telefone || undefined, role }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? 'falha ao convidar')

      setResultado({
        email: body.email, nome: body.nome,
        senha_temporaria: body.senha_temporaria,
        portal_url: body.portal_url,
      })
      setNome(''); setEmail(''); setTelefone('')
      router.refresh()
    } catch (e: any) {
      setErro(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  function copiar(tipo: 'senha' | 'link', texto: string) {
    navigator.clipboard.writeText(texto)
    setCopiado(tipo)
    setTimeout(() => setCopiado(null), 2000)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setResultado(null) }}
        className="inline-flex items-center gap-2 rounded-lg bg-mind-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-mind-600"
      >
        <Mail size={16} /> Convidar cliente da {empresaNome}
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-mind-200 bg-white p-5">
      {!resultado ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-900">Convidar novo cliente</p>
              <p className="text-xs text-ink-500">Cria um login no portal pra essa pessoa acessar.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-500 hover:text-ink-700">
              cancelar
            </button>
          </div>

          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <Campo label="Nome completo *" icon={User}>
              <input type="text" required value={nome} onChange={e => setNome(e.target.value)}
                placeholder="ex: Ana Silva"
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mind-500" />
            </Campo>
            <Campo label="Email *" icon={Mail}>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="ana@empresa.com.br"
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mind-500" />
            </Campo>
            <Campo label="Telefone" icon={Phone}>
              <input type="text" value={telefone} onChange={e => setTelefone(e.target.value)}
                placeholder="opcional"
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mind-500" />
            </Campo>
            <Campo label="Função na empresa" icon={ShieldCheck}>
              <select value={role} onChange={e => setRole(e.target.value as Role)}
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mind-500">
                <option value="titular">Titular (dono / sócio)</option>
                <option value="financeiro">Financeiro</option>
                <option value="contador">Contador interno</option>
                <option value="visualizador">Visualizador</option>
              </select>
            </Campo>

            {erro && (
              <p className="sm:col-span-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>
            )}

            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-mind-500 px-4 py-2 text-sm font-medium text-white hover:bg-mind-600 disabled:opacity-50">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                {loading ? 'Convidando…' : 'Criar acesso'}
              </button>
            </div>
          </form>
        </>
      ) : (
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <Check size={18} />
            <p className="font-semibold text-sm">Acesso criado pra {resultado.nome}</p>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Envie estas credenciais por canal seguro (WhatsApp/Email pessoal). A senha temporária só aparece agora — anote ou copie.
          </p>

          <div className="mt-3 space-y-2 rounded-lg bg-ink-50 p-3">
            <Linha label="Email" valor={resultado.email} />
            <Linha
              label="Senha temporária"
              valor={resultado.senha_temporaria}
              acao={
                <button type="button" onClick={() => copiar('senha', resultado.senha_temporaria)}
                  className="inline-flex items-center gap-1 text-xs text-mind-700 hover:text-mind-900">
                  {copiado === 'senha' ? <Check size={12} /> : <Copy size={12} />}
                  {copiado === 'senha' ? 'copiado' : 'copiar'}
                </button>
              }
            />
            {resultado.portal_url && (
              <Linha
                label="Link do portal"
                valor={resultado.portal_url}
                acao={
                  <button type="button" onClick={() => copiar('link', resultado.portal_url!)}
                    className="inline-flex items-center gap-1 text-xs text-mind-700 hover:text-mind-900">
                    {copiado === 'link' ? <Check size={12} /> : <Copy size={12} />}
                    {copiado === 'link' ? 'copiado' : 'copiar'}
                  </button>
                }
              />
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setResultado(null)}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-ink-700 ring-1 ring-inset ring-black/10 hover:bg-ink-50">
              Convidar outro
            </button>
            <button type="button" onClick={() => { setResultado(null); setOpen(false) }}
              className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-800">
              Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Campo({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-700">
        <Icon size={12} /> {label}
      </span>
      {children}
    </label>
  )
}

function Linha({ label, valor, acao }: { label: string; valor: string; acao?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-ink-500">{label}</p>
        <p className="truncate font-mono text-xs text-ink-900">{valor}</p>
      </div>
      {acao}
    </div>
  )
}
