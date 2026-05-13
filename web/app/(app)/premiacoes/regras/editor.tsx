'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2 } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'

const EVENTOS_LABEL: Record<string, { label: string; descricao: string; cor: string }> = {
  entrega_no_prazo:    { label: 'Entrega no prazo',    descricao: 'Entregue dentro do prazo legal',                  cor: 'text-emerald-700' },
  entrega_antecipada:  { label: 'Entrega antecipada',  descricao: '3+ dias antes do prazo legal',                    cor: 'text-emerald-700' },
  entrega_atrasada:    { label: 'Entrega atrasada',    descricao: 'Ficou atrasada antes de ser concluída',           cor: 'text-rose-700' },
  ajuste_manual:       { label: 'Ajuste manual',       descricao: 'Lançamento manual de pontos pelo gerente',        cor: 'text-ink-700' },
  ajudou_colega:       { label: 'Ajudou colega',       descricao: 'Reconhecimento de colaboração',                   cor: 'text-mind-700' },
  mentoria:            { label: 'Mentoria',            descricao: 'Treinou ou mentorado outro colaborador',          cor: 'text-mind-700' },
  nps_alto:            { label: 'NPS alto',            descricao: 'Cliente avaliou bem o atendimento',               cor: 'text-emerald-700' },
  nps_baixo:           { label: 'NPS baixo',           descricao: 'Cliente avaliou mal o atendimento',               cor: 'text-rose-700' },
}

const NIVEL_LABEL: Record<string, { nome: string; cor: string }> = {
  bronze: { nome: 'BRONZE', cor: 'bg-orange-100 text-orange-900 ring-orange-300' },
  prata:  { nome: 'PRATA',  cor: 'bg-ink-100 text-ink-700 ring-ink-300' },
  ouro:   { nome: 'OURO',   cor: 'bg-amber-100 text-amber-900 ring-amber-300' },
}

interface RegraEvento { id: string; evento: string; pontos: number; ativo: boolean }
interface Nivel       { id: string; nivel: string; score_minimo: number; bonus_perc: number; meta_mensal_pts: number }
interface Departamento { id: string; codigo: string; nome: string; premiacao_modo: string; meta_perc_no_prazo: number | null }

export function RegrasEditor({
  regrasEventos: regrasIniciais,
  niveis: niveisIniciais,
  departamentos: deptosIniciais,
}: {
  regrasEventos: RegraEvento[]
  niveis: Nivel[]
  departamentos: Departamento[]
}) {
  const router = useRouter()
  const [regras, setRegras] = useState(regrasIniciais)
  const [niveis, setNiveis] = useState(niveisIniciais)
  const [deptos, setDeptos] = useState(deptosIniciais)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  async function salvar() {
    setSaved(false)
    startTransition(async () => {
      const supabase = createBrowserClient()
      try {
        for (const r of regras) {
          await supabase.from('regras_pontuacao_org')
            .update({ pontos: r.pontos, ativo: r.ativo })
            .eq('id', r.id)
        }
        for (const n of niveis) {
          await supabase.from('premiacoes_regras_org')
            .update({ score_minimo: n.score_minimo, bonus_perc: n.bonus_perc, meta_mensal_pts: n.meta_mensal_pts })
            .eq('id', n.id)
        }
        for (const d of deptos) {
          await supabase.from('org_departamentos')
            .update({ premiacao_modo: d.premiacao_modo })
            .eq('id', d.id)
        }
        setSaved(true)
        router.refresh()
        setTimeout(() => setSaved(false), 2500)
      } catch (e) {
        console.error(e)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Eventos pontuáveis */}
      <section className="rounded-xl border border-black/10 bg-white">
        <header className="border-b border-black/5 px-5 py-3.5">
          <p className="font-semibold text-sm text-ink-900">Eventos pontuáveis</p>
          <p className="text-xs text-ink-500">Pontos atribuídos automaticamente quando o evento acontece.</p>
        </header>
        <div className="divide-y divide-black/5">
          {regras.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400">Nenhuma regra configurada. Defaults globais serão usados.</p>
          ) : (
            regras.map((r, idx) => {
              const meta = EVENTOS_LABEL[r.evento] ?? { label: r.evento, descricao: '—', cor: 'text-ink-700' }
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${meta.cor}`}>{meta.label}</p>
                    <p className="text-xs text-ink-500">{meta.descricao}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-ink-700">
                    <input
                      type="checkbox"
                      checked={r.ativo}
                      onChange={e => setRegras(prev => prev.map((x, i) => i === idx ? { ...x, ativo: e.target.checked } : x))}
                      className="h-4 w-4 rounded border-ink-300 text-mind-600 focus:ring-mind-500"
                    />
                    Ativo
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={r.pontos}
                      onChange={e => setRegras(prev => prev.map((x, i) => i === idx ? { ...x, pontos: Number(e.target.value) } : x))}
                      className="w-20 rounded-md border border-black/15 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-mind-500"
                    />
                    <span className="text-xs text-ink-500">pts</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Níveis Bronze/Prata/Ouro */}
      <section className="rounded-xl border border-black/10 bg-white">
        <header className="border-b border-black/5 px-5 py-3.5">
          <p className="font-semibold text-sm text-ink-900">Níveis e bônus</p>
          <p className="text-xs text-ink-500">Faixas de score mínimo e percentual de bônus sobre o salário-base.</p>
        </header>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          {niveis.map((n, idx) => {
            const meta = NIVEL_LABEL[n.nivel] ?? { nome: n.nivel.toUpperCase(), cor: 'bg-ink-100 text-ink-700' }
            return (
              <div key={n.id} className="rounded-lg border border-black/10 p-4">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${meta.cor}`}>{meta.nome}</span>
                <div className="mt-3 space-y-2">
                  <Label texto="Score mínimo (%)">
                    <input
                      type="number" min={0} max={200}
                      value={n.score_minimo}
                      onChange={e => setNiveis(prev => prev.map((x, i) => i === idx ? { ...x, score_minimo: Number(e.target.value) } : x))}
                      className="w-full rounded-md border border-black/15 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-mind-500"
                    />
                  </Label>
                  <Label texto="Bônus (% do salário-base)">
                    <input
                      type="number" min={0} max={200}
                      value={n.bonus_perc}
                      onChange={e => setNiveis(prev => prev.map((x, i) => i === idx ? { ...x, bonus_perc: Number(e.target.value) } : x))}
                      className="w-full rounded-md border border-black/15 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-mind-500"
                    />
                  </Label>
                  <Label texto="Meta mensal (pontos)">
                    <input
                      type="number" min={1}
                      value={n.meta_mensal_pts}
                      onChange={e => setNiveis(prev => prev.map((x, i) => i === idx ? { ...x, meta_mensal_pts: Number(e.target.value) } : x))}
                      className="w-full rounded-md border border-black/15 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-mind-500"
                    />
                  </Label>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Departamentos: modo automático/manual */}
      <section className="rounded-xl border border-black/10 bg-white">
        <header className="border-b border-black/5 px-5 py-3.5">
          <p className="font-semibold text-sm text-ink-900">Departamentos</p>
          <p className="text-xs text-ink-500">
            <strong>Automático</strong>: pontos gerados em todas as entregas.
            <strong className="ml-3">Manual</strong>: gerente lança no fim do mês.
          </p>
        </header>
        <div className="divide-y divide-black/5">
          {deptos.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400">Nenhum departamento configurado.</p>
          ) : deptos.map((d, idx) => (
            <div key={d.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">{d.nome}</p>
                <p className="text-xs text-ink-500 font-mono">{d.codigo}</p>
              </div>
              <select
                value={d.premiacao_modo}
                onChange={e => setDeptos(prev => prev.map((x, i) => i === idx ? { ...x, premiacao_modo: e.target.value } : x))}
                className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-mind-500"
              >
                <option value="automatico">Automático</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <button
          type="button"
          onClick={salvar}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-ink-900/15 hover:bg-ink-800 disabled:opacity-50"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saved ? 'Salvo ✓' : pending ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  )
}

function Label({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ink-700">{texto}</span>
      {children}
    </label>
  )
}
