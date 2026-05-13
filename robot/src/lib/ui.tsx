import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, forwardRef } from 'react'
import { type LucideIcon } from 'lucide-react'

function cn(...classes: (string | undefined | false | null)[]) { return classes.filter(Boolean).join(' ') }

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border border-black/10 bg-white p-5', className)}>{children}</div>
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
const buttonVariants: Record<ButtonVariant, string> = {
  primary:   'bg-ink-900 text-white hover:bg-ink-700',
  secondary: 'bg-white text-ink-900 border border-black/10 hover:bg-ink-50',
  ghost:     'bg-transparent text-ink-700 hover:bg-ink-100',
  danger:    'bg-rose-600 text-white hover:bg-rose-700',
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: LucideIcon
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { className, variant = 'secondary', icon: Icon, children, ...props }, ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  )
})

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props }, ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm placeholder:text-ink-400',
        'focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand',
        className,
      )}
      {...props}
    />
  )
})

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', className)}>
      {children}
    </span>
  )
}
