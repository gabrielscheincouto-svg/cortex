'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileDown, FileSpreadsheet, Lock, Plus, Save } from 'lucide-react'
import { apiBrowser, type Balancete, type BalanceteConta, type ReplaceBalanceteContaDTO } from '@/lib/api'
import { calcularIndicadores, classificarConta, normalizarContaImportada } from '@/lib/balancete'
import { Button, Input, Pill, Stat } from '@/components/ui'
import { brl } from '@/lib/utils'

function vazio(ordem: number): ReplaceBalanceteContaDTO {
  return { codigo: '', descricao: '', saldo_anterior: 0, debito: 0, credito: 0, saldo_atual: 0, ordem }
}

function contaParaDTO(conta: BalanceteConta): ReplaceBalanceteContaDTO {
  return {
    codigo: conta.codigo,
    descricao: conta.descricao,
    grupo: conta.grupo,
    saldo_anterior: conta.saldo_anterior,
    debito: conta.debito,
    credito: conta.credito,
    saldo_atual: conta.saldo_atual,
    natureza: conta.natureza,
    ordem: conta.ordem,
  }
}

function numero(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.')) || 0
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

export function BalanceteDetalheClient({
  token, balancete, contas, variacoes,
}: {
  token: string
  balancete: Balancete
  contas: BalanceteConta[]
  variacoes: Record<string, { valor: number; perc?: number }>
}) {
  const router = useRouter()
  const [linhas, setLinhas] = useState<ReplaceBalanceteContaDTO[]>(contas.length ? contas.map(contaParaDTO) : Array.from({ length: 10 }, (_, index) => vazio(index + 1)))
  const indicadores = useMemo(() => calcularIndicadores(linhas.map((linha, index) => ({
    id: String(index),
    balancete_id: balancete.id,
    org_id: balancete.org_id,
    codigo: linha.codigo,
    descricao: linha.descricao,
    grupo: linha.grupo,
    saldo_anterior: linha.saldo_anterior,
    debito: linha.debito,
    credito: linha.credito,
    saldo_atual: linha.saldo_atual,
    natureza: linha.natureza,
    ordem: linha.ordem ?? index + 1,
  }))), [linhas, balancete])

  function atualizar(index: number, patch: Partial<ReplaceBalanceteContaDTO>) {
    setLinhas(prev => prev.map((linha, i) => i === index ? { ...linha, ...patch } : linha))
  }

  async function importar(file: File) {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    const parsed = rows.map((row, index) => normalizarContaImportada(row, index + 1)).filter(Boolean) as ReplaceBalanceteContaDTO[]
    if (parsed.length) setLinhas(parsed)
  }

  async function salvar() {
    const validas = linhas.filter(linha => linha.codigo.trim() && linha.descricao.trim())
    await apiBrowser(token).replaceBalanceteContas(balancete.id, validas)
    router.refresh()
  }

  async function fechar() {
    await apiBrowser(token).fecharBalancete(balancete.id)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <Stat label="Liquidez corrente" value={indicadores.liquidezCorrente.toFixed(2)} sub="AC / PC" accent="brand" />
        <Stat label="Liquidez geral" value={indicadores.liquidezGeral.toFixed(2)} sub="AC + ARLP / PC + PNC" />
        <Stat label="Endividamento" value={pct(indicadores.endividamento)} sub="PC + PNC / ativo total" accent="rose" />
        <Stat label="Margem líquida" value={pct(indicadores.margemLiquida)} sub="Resultado / receita bruta" accent="gold" />
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Contas do balancete</h2>
            <p className="mt-1 text-sm text-ink-500">Lance manualmente ou importe uma planilha com código, descrição, saldos, débito e crédito.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!balancete.fechado && (
              <>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-3.5 py-2 text-sm font-medium text-ink-900 transition-colors hover:bg-ink-50">
                  <FileSpreadsheet size={16} /> Importar XLSX
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={event => event.target.files?.[0] && void importar(event.target.files[0])} />
                </label>
                <Button type="button" icon={Plus} onClick={() => setLinhas(prev => [...prev, vazio(prev.length + 1)])}>Linha</Button>
                <Button type="button" variant="primary" icon={Save} onClick={() => void salvar()}>Salvar</Button>
                <Button type="button" variant="success" icon={Lock} onClick={() => void fechar()}>Fechar</Button>
              </>
            )}
            <Button type="button" icon={FileDown} onClick={() => window.print()}>Exportar PDF</Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-black/10">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-right">Saldo anterior</th>
                <th className="px-3 py-2 text-right">Débito</th>
                <th className="px-3 py-2 text-right">Crédito</th>
                <th className="px-3 py-2 text-right">Saldo atual</th>
                <th className="px-3 py-2 text-left">Categoria</th>
                <th className="px-3 py-2 text-right">Variação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {linhas.map((linha, index) => {
                const categoria = classificarConta(linha.grupo || linha.descricao)
                const variacao = variacoes[linha.codigo]
                const destaque = variacao?.perc != null && Math.abs(variacao.perc) > 0.2
                return (
                  <tr key={`${linha.codigo}-${index}`} className={destaque ? (variacao.valor > 0 ? 'bg-emerald-50' : 'bg-rose-50') : undefined}>
                    <td className="px-3 py-2"><Input disabled={balancete.fechado} value={linha.codigo} onChange={event => atualizar(index, { codigo: event.target.value })} className="font-mono" /></td>
                    <td className="px-3 py-2"><Input disabled={balancete.fechado} value={linha.descricao} onChange={event => atualizar(index, { descricao: event.target.value })} /></td>
                    <td className="px-3 py-2"><Input disabled={balancete.fechado} value={String(linha.saldo_anterior)} onChange={event => atualizar(index, { saldo_anterior: numero(event.target.value) })} className="text-right" /></td>
                    <td className="px-3 py-2"><Input disabled={balancete.fechado} value={String(linha.debito)} onChange={event => atualizar(index, { debito: numero(event.target.value) })} className="text-right" /></td>
                    <td className="px-3 py-2"><Input disabled={balancete.fechado} value={String(linha.credito)} onChange={event => atualizar(index, { credito: numero(event.target.value) })} className="text-right" /></td>
                    <td className="px-3 py-2"><Input disabled={balancete.fechado} value={String(linha.saldo_atual)} onChange={event => atualizar(index, { saldo_atual: numero(event.target.value), natureza: numero(event.target.value) < 0 ? 'C' : 'D' })} className="text-right" /></td>
                    <td className="px-3 py-2">{categoria ? <Pill className="bg-ink-100 text-ink-700 ring-ink-200">{categoria}</Pill> : <span className="text-xs text-ink-400">-</span>}</td>
                    <td className="px-3 py-2 text-right text-xs">{variacao ? `${brl(Math.round(variacao.valor * 100))} (${variacao.perc == null ? '-' : pct(variacao.perc)})` : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
