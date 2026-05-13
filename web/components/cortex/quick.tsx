'use client'

/**
 * Cortex Quick — palette tipo Linear/Raycast.
 * Cmd+K abre. Input grande no topo, 3 seções:
 *  1. Ações rápidas (locais, sem servidor) — atalhos pra páginas
 *  2. Busca direta (GET /api/v1/busca?q=) com debounce 200ms
 *  3. Sugestão Cortex (POST /api/v1/cortex/comando) quando o input parece comando
 * Setas ↑↓ navegam, Enter seleciona, Esc fecha.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Calendar, CheckSquare, FileText, MessageSquare, Plus, Search, Sparkles,
  Users, Receipt, BarChart3, BrainCircuit,
} from 'lucide-react'
import { API_BASE_URL } from '@/lib/api'
import { ActionCard } from './action-card'
import type { CortexAcaoPendente } from './streaming'

interface BuscaResultado {
  empresas: BuscaItem[]
  entregas: BuscaItem[]
  solicitacoes: BuscaItem[]
  colaboradores: BuscaItem[]
  tarefas: BuscaItem[]
}
interface BuscaItem {
  id: string
  titulo: string
  subtitulo?: string
  href: string
  status?: string
}

// ─── Ações rápidas locais ────────────────────────────────────────────────────
const ACOES_RAPIDAS = [
  { id: 'home',           label: 'Ir para o início',          href: '/',              icon: Sparkles,    keywords: 'home inicio dashboard' },
  { id: 'entregas',       label: 'Abrir entregas',            href: '/entregas',      icon: Calendar,    keywords: 'entregas obrigacoes prazo guia' },
  { id: 'entregas-atrs',  label: 'Entregas atrasadas',        href: '/entregas?status=atrasada', icon: Calendar, keywords: 'atrasada vencida' },
  { id: 'empresas',       label: 'Listar empresas',           href: '/empresas',      icon: Building2,   keywords: 'empresa cliente cnpj' },
  { id: 'empresa-nova',   label: 'Nova empresa',              href: '/empresas?novo=1', icon: Plus,      keywords: 'nova empresa cadastrar adicionar' },
  { id: 'solicitacoes',   label: 'Solicitações abertas',      href: '/solicitacoes?status=abertas', icon: MessageSquare, keywords: 'solicitacao ticket abertas pendente' },
  { id: 'kanban',         label: 'Kanban interno',            href: '/kanban',        icon: CheckSquare, keywords: 'kanban tarefa quadro' },
  { id: 'mural',          label: 'Mural da equipe',           href: '/mural',         icon: MessageSquare, keywords: 'mural comunicado aviso post' },
  { id: 'irpf',           label: 'IRPF · dashboard',          href: '/irpf',          icon: Receipt,     keywords: 'irpf imposto renda declaracao' },
  { id: 'balancete',      label: 'Balancetes',                href: '/balancete',     icon: BarChart3,   keywords: 'balancete fechamento contabil' },
  { id: 'frequencia',     label: 'Frequência da equipe',      href: '/frequencia',    icon: Users,       keywords: 'frequencia ponto presenca falta' },
  { id: 'cortex-memorias',label: 'Memórias do Cortex',        href: '/cortex/memorias', icon: BrainCircuit, keywords: 'cortex memoria fatos lembrar' },
  { id: 'config',         label: 'Configurações',             href: '/configuracoes', icon: FileText,    keywords: 'configuracao equipe plano permissao' },
  { id: 'config-cortex',  label: 'Permissões do Cortex',      href: '/configuracoes/cortex', icon: Sparkles, keywords: 'cortex permissao role ferramenta' },
]

// ─── Componente ──────────────────────────────────────────────────────────────
export function CortexQuick({ open, onClose, token }: { open: boolean; onClose: () => void; token: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [busca, setBusca] = useState<BuscaResultado | null>(null)
  const [acao, setAcao] = useState<CortexAcaoPendente | null>(null)
  const [loadingBusca, setLoadingBusca] = useState(false)
  const [loadingComando, setLoadingComando] = useState(false)
  const [highlight, setHighlight] = useState(0)

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery(''); setBusca(null); setAcao(null); setHighlight(0)
    } else {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounce 200ms p/ a busca cross-entity
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) { setBusca(null); return }
    setLoadingBusca(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/busca?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) setBusca(await res.json())
      } catch {
        // ignore
      } finally {
        setLoadingBusca(false)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [query, open, token])

  // Resultados achatados em uma lista pra navegação por teclado
  const itensFlat = useMemo(() => {
    const q = query.trim().toLowerCase()
    const acoesFiltradas = q.length === 0
      ? ACOES_RAPIDAS.slice(0, 6)
      : ACOES_RAPIDAS.filter(a => a.label.toLowerCase().includes(q) || a.keywords.includes(q))

    type Flat = { tipo: string; id: string; titulo: string; subtitulo?: string; href?: string; onSelect?: () => void; icon?: any }
    const out: Flat[] = []
    for (const a of acoesFiltradas) out.push({ tipo: 'acao', id: a.id, titulo: a.label, href: a.href, icon: a.icon })
    if (busca) {
      for (const e of busca.empresas)      out.push({ tipo: 'empresa',      id: e.id, titulo: e.titulo, subtitulo: e.subtitulo, href: e.href, icon: Building2 })
      for (const e of busca.entregas)      out.push({ tipo: 'entrega',      id: e.id, titulo: e.titulo, subtitulo: e.subtitulo, href: e.href, icon: Calendar })
      for (const e of busca.solicitacoes)  out.push({ tipo: 'solicitacao',  id: e.id, titulo: e.titulo, subtitulo: e.subtitulo, href: e.href, icon: MessageSquare })
      for (const e of busca.colaboradores) out.push({ tipo: 'colaborador',  id: e.id, titulo: e.titulo, subtitulo: e.subtitulo, href: e.href, icon: Users })
      for (const e of busca.tarefas)       out.push({ tipo: 'tarefa',       id: e.id, titulo: e.titulo, subtitulo: e.subtitulo, href: e.href, icon: CheckSquare })
    }
    return out
  }, [query, busca])

  // Detector heurístico: se query tem >3 palavras OU começa com verbo de ação,
  // mostramos o atalho "Pedir ao Cortex"
  const podeVirarComando = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 8) return false
    const verbos = ['cria', 'criar', 'lembre', 'lembra', 'anote', 'guarde', 'esqueça', 'esquece', 'poste', 'publique', 'marca', 'lança', 'lance']
    if (verbos.some(v => q.startsWith(v + ' ') || q.startsWith(v + ':'))) return true
    return q.split(/\s+/).length >= 4
  }, [query])

  async function pedirAoCortex() {
    if (!query.trim() || loadingComando) return
    setLoadingComando(true)
    setAcao(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cortex/comando`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ texto: query }),
      })
      const body = await res.json()
      if (body?.acao) setAcao(body.acao as CortexAcaoPendente)
      else {
        // Fallback: abre o drawer e despeja a frase
        router.push('/cortex/memorias')
      }
    } catch {
      // ignore
    } finally {
      setLoadingComando(false)
    }
  }

  function selecionar(index: number) {
    const item = itensFlat[index]
    if (!item) return
    if (item.href) {
      router.push(item.href)
      onClose()
    } else {
      item.onSelect?.()
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, itensFlat.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (podeVirarComando && itensFlat.length === 0) {
        void pedirAoCortex()
      } else {
        selecionar(highlight)
      }
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-900/40 px-4 pt-[14vh]" onClick={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-mind-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-black/5 px-4 py-3">
          <Search size={18} className="text-mind-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlight(0); setAcao(null) }}
            onKeyDown={onKeyDown}
            placeholder="Pergunte ou peça algo ao Cortex…"
            className="flex-1 bg-transparent text-base text-ink-900 outline-none placeholder:text-ink-400"
          />
          <kbd className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {/* Ação proposta (depois do user pedir ao Cortex) */}
          {acao && (
            <div className="border-b border-black/5 p-3">
              <ActionCard
                acao={acao}
                token={token}
                onResolved={(final) => { if (!final) setAcao(null); else setAcao(final) }}
              />
            </div>
          )}

          {/* Seção 1: Ações rápidas / busca */}
          <Lista
            highlight={highlight}
            itens={itensFlat}
            onSelect={selecionar}
            loadingBusca={loadingBusca}
            query={query}
          />

          {/* Seção 3: pedir ao Cortex */}
          {podeVirarComando && (
            <button
              type="button"
              onClick={pedirAoCortex}
              disabled={loadingComando}
              className="flex w-full items-center gap-3 border-t border-black/5 px-4 py-3 text-left hover:bg-mind-50"
            >
              <div className="rounded-full bg-mind-100 p-1.5">
                <Sparkles size={14} className="text-mind-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-900">
                  {loadingComando ? 'Cortex pensando…' : `Pedir ao Cortex: “${query.trim().slice(0, 60)}${query.length > 60 ? '…' : ''}”`}
                </p>
                <p className="text-xs text-mind-700">O Cortex propõe a ação e você confirma.</p>
              </div>
              <kbd className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">↵</kbd>
            </button>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t border-black/5 bg-ink-50 px-4 py-2 text-[11px] text-ink-500">
          <span>
            <kbd className="rounded bg-white px-1.5 py-0.5 ring-1 ring-black/10">↑↓</kbd> navegar
            <span className="mx-2">·</span>
            <kbd className="rounded bg-white px-1.5 py-0.5 ring-1 ring-black/10">↵</kbd> abrir
            <span className="mx-2">·</span>
            <kbd className="rounded bg-white px-1.5 py-0.5 ring-1 ring-black/10">esc</kbd> fechar
          </span>
          <span className="font-display text-mind-700">cortex quick</span>
        </div>
      </div>
    </div>
  )
}

// ─── Lista de resultados agrupados ──────────────────────────────────────────
function Lista({
  highlight, itens, onSelect, loadingBusca, query,
}: {
  highlight: number
  itens: { tipo: string; id: string; titulo: string; subtitulo?: string; href?: string; icon?: any }[]
  onSelect: (index: number) => void
  loadingBusca: boolean
  query: string
}) {
  if (itens.length === 0) {
    if (loadingBusca) {
      return <p className="px-4 py-6 text-center text-sm text-ink-500">Buscando…</p>
    }
    if (query.trim().length < 2) {
      return <p className="px-4 py-6 text-center text-sm text-ink-500">Digite para buscar ou peça algo ao Cortex.</p>
    }
    return <p className="px-4 py-6 text-center text-sm text-ink-500">Nada encontrado. Tente outras palavras.</p>
  }

  const grupos: Record<string, { label: string; itens: typeof itens; indices: number[] }> = {
    acao:         { label: 'Ações rápidas',   itens: [], indices: [] },
    empresa:      { label: 'Empresas',        itens: [], indices: [] },
    entrega:      { label: 'Entregas',        itens: [], indices: [] },
    solicitacao:  { label: 'Solicitações',    itens: [], indices: [] },
    colaborador:  { label: 'Colaboradores',   itens: [], indices: [] },
    tarefa:       { label: 'Tarefas Kanban',  itens: [], indices: [] },
  }
  itens.forEach((it, i) => {
    if (grupos[it.tipo]) {
      grupos[it.tipo].itens.push(it)
      grupos[it.tipo].indices.push(i)
    }
  })

  return (
    <div>
      {(Object.keys(grupos) as (keyof typeof grupos)[]).map(key => {
        const g = grupos[key]
        if (g.itens.length === 0) return null
        return (
          <div key={key}>
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              {g.label}
            </p>
            {g.itens.map((it, idx) => {
              const globalIdx = g.indices[idx]
              const Icon = it.icon
              const ativo = globalIdx === highlight
              return (
                <button
                  key={it.id}
                  type="button"
                  onMouseEnter={() => { /* could highlight on hover */ }}
                  onClick={() => onSelect(globalIdx)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left transition ${
                    ativo ? 'bg-mind-50' : 'hover:bg-ink-50'
                  }`}
                >
                  {Icon && (
                    <div className={`rounded-md p-1.5 ${ativo ? 'bg-mind-100 text-mind-700' : 'bg-ink-100 text-ink-600'}`}>
                      <Icon size={14} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink-900">{it.titulo}</p>
                    {it.subtitulo && <p className="truncate text-xs text-ink-500">{it.subtitulo}</p>}
                  </div>
                  {ativo && <span className="rounded bg-mind-500 px-1.5 py-0.5 text-[10px] font-medium text-white">↵</span>}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
