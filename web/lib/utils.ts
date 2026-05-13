/** Helpers compartilhados (formatters, badges) — espelha admin/lib/utils.ts. */

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function dateBR(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function dateLongBR(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

export function timeBR(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function ago(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h} h`
  const dd = Math.floor(h / 24)
  if (dd < 30) return `há ${dd} d`
  return dateBR(d)
}

/** Saudação dinâmica conforme hora */
export function saudacao(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export interface StatusBadge { label: string; classes: string }

export function entregaStatusBadge(status: string): StatusBadge {
  const m: Record<string, StatusBadge> = {
    pendente:           { label: 'Pendente',           classes: 'bg-ink-100 text-ink-700 ring-ink-200' },
    em_andamento:       { label: 'Em andamento',       classes: 'bg-blue-100 text-blue-900 ring-blue-300' },
    aguardando_cliente: { label: 'Aguardando cliente', classes: 'bg-amber-100 text-amber-900 ring-amber-300' },
    entregue:           { label: 'Entregue',           classes: 'bg-emerald-100 text-emerald-900 ring-emerald-300' },
    justificada:        { label: 'Justificada',        classes: 'bg-purple-100 text-purple-900 ring-purple-300' },
    dispensada:         { label: 'Dispensada',         classes: 'bg-ink-100 text-ink-500 ring-ink-200' },
    atrasada:           { label: 'Atrasada',           classes: 'bg-rose-100 text-rose-900 ring-rose-300' },
  }
  return m[status] ?? { label: status, classes: 'bg-ink-100 text-ink-700 ring-ink-200' }
}

export function departamentoLabel(d: string): string {
  return {
    contabil:   'Contábil',
    fiscal:     'Fiscal',
    pessoal:    'Pessoal',
    societario: 'Societário',
    comercial:  'Comercial',
    rural:      'Rural',
    paralegal:  'Paralegal',
    outro:      'Outro',
  }[d] ?? d
}

/** Cor de fundo do avatar baseado no nome (consistente por hash). */
export function avatarCor(nome: string): { bg: string; fg: string } {
  const palette = [
    { bg: '#E6F1FB', fg: '#0C447C' },
    { bg: '#ECFDF5', fg: '#065F46' },
    { bg: '#FAEEDA', fg: '#854F0B' },
    { bg: '#FAECE7', fg: '#993C1D' },
    { bg: '#EEEDFE', fg: '#3C3489' },
    { bg: '#FBEAF0', fg: '#72243E' },
    { bg: '#E1F5EE', fg: '#0F6E56' },
  ]
  let hash = 0
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}

export function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
