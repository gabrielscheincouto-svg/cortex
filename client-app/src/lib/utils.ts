/**
 * Utilidades compartilhadas — formatadores PT-BR, dates, classe condicional.
 * Espelha as funções do `web/lib/utils.ts` que fazem sentido no cliente.
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Concatenação de classes Tailwind com merge inteligente. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** "Bom dia" / "Boa tarde" / "Boa noite" conforme horário local. */
export function saudacao(date: Date = new Date()): string {
  const h = date.getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Data por extenso PT-BR — "segunda, 31 de maio". */
export function dateLongBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

/** Data curta PT-BR — "31/05/2026". */
export function dateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR')
}

/** "há 5 min", "há 2 h", "há 3 d", ou data por extenso se > 7 dias. */
export function ago(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const min = Math.round(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const hrs = Math.round(min / 60)
  if (hrs < 24) return `há ${hrs} h`
  const days = Math.round(hrs / 24)
  if (days <= 7) return `há ${days} d`
  return dateBR(d)
}

/** Formata valor monetário em BRL — "R$ 1.234,56". */
export function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Iniciais para avatar — "Ana Paula" → "AP". */
export function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Cores de avatar determinísticas por nome — paleta limitada do brandbook. */
export function avatarCor(nome: string): { bg: string; fg: string } {
  // hash simples sobre o nome → índice na paleta
  let hash = 0
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) | 0
  const paleta: Array<{ bg: string; fg: string }> = [
    { bg: '#EDE9FE', fg: '#5B21B6' }, // mind-100 / mind-700
    { bg: '#DCFCE7', fg: '#15803D' }, // brand-100 / brand-700
    { bg: '#F1F5F9', fg: '#334155' }, // ink-100  / ink-700
    { bg: '#F6EBC2', fg: '#8E711F' }, // gold-100 / gold-700
    { bg: '#FBE4E8', fg: '#B05D6B' }, // rose-100 / rose-700
  ]
  const i = Math.abs(hash) % paleta.length
  return paleta[i]!
}
