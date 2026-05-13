'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { Building2, Save, Send, Trash2, UploadCloud } from 'lucide-react'
import { apiBrowser } from '@/lib/api'
import { Button, Input } from '@/components/ui'

const roles = ['admin', 'gerente', 'contabil', 'fiscal', 'pessoal', 'societario', 'comercial', 'visualizador']

export function ConfigTabs({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState('equipe')
  const labels = [
    ['equipe', 'Equipe'],
    ['empresas', 'Empresas'],
    ['white-label', 'White-label'],
    ['plano', 'Plano'],
    ['pontuacao', 'Regras de pontuação'],
  ]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {labels.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-full px-3 py-1 text-xs ring-1 ring-inset ${tab === key ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-700 ring-black/10 hover:bg-ink-50'}`}>{label}</button>
        ))}
      </div>
      <div data-active-tab={tab}>
        {Array.isArray(children) ? children.find((child: any) => child?.props?.tab === tab) : children}
      </div>
    </div>
  )
}

export function TabPanel({ children }: { tab: string; children: ReactNode }) {
  return <>{children}</>
}

export function ConvidarMembroForm({ token }: { token: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('visualizador')
  const [erro, setErro] = useState<string | null>(null)

  async function convidar() {
    setErro(null)
    try {
      await apiBrowser(token).convidarMembro({ email, role })
      setEmail('')
      router.refresh()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível convidar')
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-black/10 p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_auto]">
        <Input value={email} onChange={event => setEmail(event.target.value)} placeholder="email@empresa.com.br" />
        <select value={role} onChange={event => setRole(event.target.value)} className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm">
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <Button type="button" variant="primary" icon={Send} disabled={!email} onClick={() => void convidar()}>Convidar</Button>
      </div>
      {erro && <p className="text-xs text-rose-700">{erro}</p>}
    </div>
  )
}

export function MembroActions({ token, membroId, role }: { token: string; membroId: string; role: string }) {
  const router = useRouter()
  const [value, setValue] = useState(role)

  async function salvar() {
    await apiBrowser(token).updateMembro(membroId, { role: value })
    router.refresh()
  }

  async function remover() {
    await apiBrowser(token).deleteMembro(membroId)
    router.refresh()
  }

  return (
    <div className="flex justify-end gap-2">
      <select value={value} onChange={event => setValue(event.target.value)} className="rounded-lg border border-black/15 bg-white px-2 py-1 text-xs">
        {roles.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <Button type="button" size="sm" variant="secondary" icon={Save} onClick={() => void salvar()}>Salvar</Button>
      <Button type="button" size="sm" variant="danger" icon={Trash2} onClick={() => void remover()}>Inativar</Button>
    </div>
  )
}

export function WhiteLabelForm({ token, cor, logo }: { token: string; cor: string; logo?: string | null }) {
  const router = useRouter()
  const [corPrimaria, setCorPrimaria] = useState(cor)
  const [logoUrl, setLogoUrl] = useState(logo ?? '')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function salvar() {
    setErro(null)
    setEnviando(true)
    try {
      const api = apiBrowser(token)
      if (arquivo) {
        const prep = await api.prepararUpload({
          contexto: 'logo_org',
          nome_original: arquivo.name,
          mime_type: arquivo.type || 'application/octet-stream',
          tamanho_bytes: arquivo.size,
        })
        const resp = await fetch(prep.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': arquivo.type || 'application/octet-stream' },
          body: arquivo,
        })
        if (!resp.ok) throw new Error(`Storage recusou o arquivo (${resp.status})`)
        await api.confirmarUpload(prep.upload_id, {})
      }
      await api.updateOrgConfiguracoes({ cor_primaria: corPrimaria, logo_url: arquivo ? undefined : logoUrl || undefined })
      setArquivo(null)
      router.refresh()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar a marca')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm text-ink-700">
        Cor primária
        <div className="mt-1 flex gap-2">
          <input type="color" value={corPrimaria} onChange={event => setCorPrimaria(event.target.value)} className="h-10 w-12 rounded border border-black/15 bg-white" />
          <Input value={corPrimaria} onChange={event => setCorPrimaria(event.target.value)} />
        </div>
      </label>
      <label className="block text-sm text-ink-700">
        Logo URL
        <Input value={logoUrl} onChange={event => setLogoUrl(event.target.value)} placeholder="https://..." className="mt-1" />
      </label>
      <label className="block text-sm text-ink-700">
        Enviar logo
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => setArquivo(event.target.files?.[0] ?? null)} className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-ink-700" />
      </label>
      {arquivo && <p className="text-xs text-ink-500">Arquivo selecionado: {arquivo.name}</p>}
      {erro && <p className="text-xs text-rose-700">{erro}</p>}
      <Button type="button" variant="primary" icon={arquivo ? UploadCloud : Save} disabled={enviando} onClick={() => void salvar()}>{enviando ? 'Salvando...' : 'Salvar white-label'}</Button>
    </div>
  )
}

export function EmpresasShortcut() {
  return <Link href="/empresas"><Button variant="primary" icon={Building2}>Abrir empresas</Button></Link>
}
