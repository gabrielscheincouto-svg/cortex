/** Tipos + helpers do módulo IRPF.
 *
 * Convenção:
 * - Leituras: Server Components consultam Supabase diretamente (RLS protege)
 * - Mutações: server actions chamam a API Go via fetchIrpf (com token do user logado)
 */

import { API_BASE_URL } from './api'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type IrpfStatus =
  | 'a_iniciar' | 'coletando' | 'em_processamento' | 'aguardando_cliente'
  | 'entregue' | 'em_malha' | 'retificada' | 'cancelada'

export type IrpfSituacaoFinal = 'a_restituir' | 'a_pagar' | 'sem_imposto'

export type IrpfLancamentoTipo =
  | 'rendimento_tributavel' | 'rendimento_isento' | 'rendimento_exclusivo'
  | 'deducao_medica' | 'deducao_educacao' | 'deducao_previdencia' | 'deducao_pensao'
  | 'dependente' | 'bem_direito' | 'divida'

export interface IrpfDeclarante {
  id: string
  org_id: string
  empresa_id?: string
  cpf: string
  nome_completo: string
  data_nascimento?: string
  email?: string
  telefone?: string
  observacoes?: string
  created_at: string
  updated_at: string
  declaracoes_count?: number
}

export interface IrpfDeclaracao {
  id: string
  org_id: string
  declarante_id: string
  declarante_nome?: string
  declarante_cpf?: string
  exercicio: number
  ano_calendario: number
  status: IrpfStatus
  responsavel_id?: string
  responsavel_nome?: string
  rendimentos_total_cents: number
  deducoes_total_cents: number
  imposto_devido_cents: number
  imposto_retido_cents: number
  saldo_cents: number
  situacao_final?: IrpfSituacaoFinal
  recibo_url?: string
  transmitida_em?: string
  observacoes?: string
  created_at: string
  updated_at: string
}

export interface IrpfLancamento {
  id: string
  org_id: string
  declaracao_id: string
  tipo: IrpfLancamentoTipo
  fonte_pagadora?: string
  fonte_cnpj?: string
  descricao?: string
  valor_cents: number
  imposto_retido_cents: number
  documento_url?: string
  payload: Record<string, unknown>
  created_at: string
}

export interface IrpfDeclaracaoDetalhe {
  declaracao: IrpfDeclaracao
  declarante: IrpfDeclarante
  lancamentos: IrpfLancamento[]
}

export interface IrpfDashboard {
  exercicio: number
  total: number
  a_iniciar: number
  coletando: number
  em_processamento: number
  aguardando_cliente: number
  entregues: number
  em_malha: number
  retificadas: number
  canceladas: number
  total_a_restituir_cents: number
  total_a_pagar_cents: number
  total_imposto_retido_cents: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export async function fetchIrpf<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
  const text = await res.text()
  const body = text ? safeJson(text) : null
  if (!res.ok) {
    const msg = (body as { message?: string } | null)?.message ?? `${res.status} ${res.statusText}`
    throw new Error(msg)
  }
  return body as T
}

function safeJson(t: string): unknown {
  try { return JSON.parse(t) } catch { return t }
}

// ─── Formatadores e labels ──────────────────────────────────────────────────

export const statusLabel: Record<IrpfStatus, string> = {
  a_iniciar: 'A iniciar',
  coletando: 'Coletando',
  em_processamento: 'Em processamento',
  aguardando_cliente: 'Aguardando cliente',
  entregue: 'Entregue',
  em_malha: 'Em malha',
  retificada: 'Retificada',
  cancelada: 'Cancelada',
}

export const statusBadge: Record<IrpfStatus, string> = {
  a_iniciar: 'bg-ink-100 text-ink-700 ring-ink-200',
  coletando: 'bg-amber-100 text-amber-900 ring-amber-300',
  em_processamento: 'bg-blue-100 text-blue-900 ring-blue-300',
  aguardando_cliente: 'bg-purple-100 text-purple-900 ring-purple-300',
  entregue: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  em_malha: 'bg-rose-100 text-rose-900 ring-rose-300',
  retificada: 'bg-ink-100 text-ink-700 ring-ink-200',
  cancelada: 'bg-ink-100 text-ink-500 ring-ink-200',
}

export const tipoLabel: Record<IrpfLancamentoTipo, string> = {
  rendimento_tributavel: 'Rendimento tributável',
  rendimento_isento: 'Rendimento isento',
  rendimento_exclusivo: 'Rendimento exclusivo na fonte',
  deducao_medica: 'Dedução médica',
  deducao_educacao: 'Dedução educação',
  deducao_previdencia: 'Dedução previdência',
  deducao_pensao: 'Dedução pensão alimentícia',
  dependente: 'Dependente',
  bem_direito: 'Bem ou direito',
  divida: 'Dívida / ônus real',
}

export function exercicioAtual(): number {
  // Exercício do IRPF = ano de entrega = ano-calendário + 1
  const d = new Date()
  return d.getMonth() < 4 ? d.getFullYear() : d.getFullYear() + 1
}

export function formatCPF(cpf: string): string {
  const digits = (cpf ?? '').replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}
