/** Primitivos de UI reutilizáveis. Mesmo design system do admin, com 2 extras (Avatar, Chip). */

import { cn, avatarCor, iniciais } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'
import { type ReactNode, type ButtonHTMLAttributes, forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

// ─── Card ─────────────────────────────────────────────────────
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border border-black/10 bg-white p-5', className)}>{children}</div>
}

export function CardHeader({ title, subtitle, action, icon: Icon }: {
  title: string; subtitle?: string; action?: ReactNode; icon?: LucideIcon
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && <Icon size={20} className="mt-0.5 text-ink-700" />}
        <div>
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

// ─── Button ───────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:   'bg-ink-900 text-white hover:bg-ink-800',
  secondary: 'bg-white text-ink-900 border border-black/10 hover:bg-ink-50',
  ghost:     'bg-transparent text-ink-700 hover:bg-ink-100',
  danger:    'bg-rose-600 text-white hover:bg-rose-700',
  success:   'bg-brand-600 text-white hover:bg-brand-700',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: LucideIcon
  size?: 'sm' | 'md'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', icon: Icon, size = 'md', children, ...props }, ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        buttonVariants[variant],
        className
      )}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
})

// ─── Input / Textarea ─────────────────────────────────────────
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

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props }, ref
) {
  return (
    <textarea
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

// ─── Stat ─────────────────────────────────────────────────────
type StatAccent = 'brand' | 'gold' | 'rose' | 'none'
const accentRing: Record<StatAccent, string> = {
  brand: 'border-l-brand-500',
  gold:  'border-l-gold-500',
  rose:  'border-l-rose',
  none:  'border-l-transparent',
}

export function Stat({ label, value, sub, accent = 'none', valueColor }: {
  label: string; value: string; sub?: string; accent?: StatAccent; valueColor?: string
}) {
  return (
    <div className={cn('rounded-xl border border-black/10 border-l-4 bg-white px-5 py-4', accentRing[accent])}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <p className={cn('mt-2 text-2xl font-semibold', valueColor ?? 'text-ink-900')}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  )
}

// ─── Pill ─────────────────────────────────────────────────────
export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', className)}>
      {children}
    </span>
  )
}

// ─── Avatar ───────────────────────────────────────────────────
export function Avatar({ nome, size = 'md', src }: { nome: string; size?: 'sm' | 'md' | 'lg'; src?: string | null }) {
  const dim = { sm: 'h-7 w-7 text-[11px]', md: 'h-8 w-8 text-xs', lg: 'h-12 w-12 text-sm' }[size]
  const { bg, fg } = avatarCor(nome)
  if (src) {
    return <img src={src} alt={nome} className={cn(dim, 'rounded-full object-cover')} />
  }
  return (
    <span className={cn(dim, 'inline-flex shrink-0 items-center justify-center rounded-full font-semibold')} style={{ backgroundColor: bg, color: fg }}>
      {iniciais(nome)}
    </span>
  )
}

// ─── Empty ────────────────────────────────────────────────────
export function Empty({ icon: Icon, title, description, action }: {
  icon?: LucideIcon; title: string; description?: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && <Icon size={28} className="mb-3 text-ink-400" />}
      <p className="text-base font-medium text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
