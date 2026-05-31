/**
 * Primitivos de UI usados em todo o painel admin.
 * Tudo flat, sem dependências externas além do Tailwind + lucide-react.
 */

import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'
import { type ReactNode, type ButtonHTMLAttributes, forwardRef, type InputHTMLAttributes } from 'react'

// ─── Card ─────────────────────────────────────────────────────
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-black/10 bg-white p-5', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Button ───────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:   'bg-ink-900 text-white hover:bg-ink-800',
  secondary: 'bg-white text-ink-900 border border-black/10 hover:bg-ink-50',
  ghost:     'bg-transparent text-ink-700 hover:bg-ink-100',
  danger:    'bg-rose-600 text-white hover:bg-rose-700',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: LucideIcon
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', icon: Icon, children, ...props }, ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        buttonVariants[variant],
        className
      )}
      {...props}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  )
})

// ─── Input ────────────────────────────────────────────────────
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props }, ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm placeholder:text-ink-400',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
        className
      )}
      {...props}
    />
  )
})

// ─── Stat (cartão de KPI) ─────────────────────────────────────
export function Stat({
  label, value, sub, accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'brand' | 'gold' | 'rose' | 'amber' | 'none'
}) {
  const accentRing = {
    brand: 'border-l-brand-500',
    gold:  'border-l-gold',
    rose:  'border-l-rose',
    amber: 'border-l-amber-500',
    none:  '',
  }[accent ?? 'none']

  return (
    <div className={cn('rounded-xl border border-black/10 border-l-4 bg-white px-5 py-4', accentRing)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  )
}

// ─── Pill (status badge) ──────────────────────────────────────
export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', className)}>
      {children}
    </span>
  )
}

// ─── Empty state ──────────────────────────────────────────────
export function Empty({ icon: Icon, title, description, action }: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={28} className="mb-3 text-ink-400" />}
      <p className="text-base font-medium text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
