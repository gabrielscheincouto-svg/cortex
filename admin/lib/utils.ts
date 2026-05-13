/** Helpers tipados e formatters utilizados pelo painel. */

/** Junta classes condicionais (mini implementação de `clsx`). */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Formata centavos em BRL. */
export function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Formata número grande em PT-BR (47 → "47", 1247 → "1.247", 1500000 → "1,5M"). */
export function num(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (n >= 10_000)   return `${(n / 1000).toFixed(0)}k`
  return n.toLocaleString('pt-BR')
}

/** Data ISO → "12 mai 2026" */
export function dateBR(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** "há X dias" */
export function ago(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1)  return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `há ${days} d`
  return dateBR(d)
}

/** Mapeia status de org para cor de pill */
export function orgStatusBadge(status: string): { label: string; classes: string } {
  const m: Record<string, { label: string; classes: string }> = {
    trial:      { label: 'Trial',     classes: 'bg-amber-100 text-amber-900 ring-amber-300' },
    ativo:      { label: 'Ativo',     classes: 'bg-emerald-100 text-emerald-900 ring-emerald-300' },
    suspenso:   { label: 'Suspenso',  classes: 'bg-rose-100 text-rose-900 ring-rose-300' },
    cancelado:  { label: 'Cancelado', classes: 'bg-ink-200 text-ink-700 ring-ink-300' },
  }
  return m[status] ?? { label: status, classes: 'bg-ink-100 text-ink-700 ring-ink-200' }
}
