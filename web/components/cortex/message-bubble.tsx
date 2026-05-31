import { cn } from '@/lib/utils'
import { CortexOrb } from './orb'

/**
 * Avatar do Cortex — orb 3D animado (brandbook v2, maio/2026).
 * Wrapper sobre <CortexOrb> com a API que o drawer/launcher esperam.
 * `pulsando = true` → modo thinking (animação mais rápida).
 */
export function CortexAvatar({ size = 36, pulsando = false }: { size?: number; pulsando?: boolean }) {
  return <CortexOrb size={size} mode={pulsando ? 'thinking' : 'cortex'} />
}

// Versão legada do avatar (C-em-rede). Mantida pra fallback caso algum lugar
// chame especificamente. Use `CortexOrb` direto em UI nova.
export function CortexAvatarLegacy({ size = 36, pulsando = false }: { size?: number; pulsando?: boolean }) {
  const animClass = pulsando ? 'animate-pulse' : ''
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Cortex"
      className="shrink-0"
    >
      {/* arestas — hemisfério verde (topo) */}
      <g stroke="#22C55E" strokeWidth="1.2" opacity="0.9" fill="none">
        <line x1="18" y1="14" x2="32" y2="10" />
        <line x1="32" y1="10" x2="46" y2="14" />
        <line x1="18" y1="14" x2="28" y2="22" />
        <line x1="32" y1="10" x2="28" y2="22" />
        <line x1="32" y1="10" x2="40" y2="22" />
        <line x1="46" y1="14" x2="40" y2="22" />
        <line x1="28" y1="22" x2="40" y2="22" />
        <line x1="18" y1="14" x2="14" y2="26" />
      </g>
      {/* aresta de transição (cinza/dourado) */}
      <g stroke="#6B7280" strokeWidth="1.2" opacity="0.75" fill="none">
        <line x1="14" y1="26" x2="12" y2="38" />
        <line x1="14" y1="26" x2="22" y2="32" />
        <line x1="22" y1="32" x2="28" y2="22" />
      </g>
      {/* arestas — hemisfério violeta (base) */}
      <g stroke="#7C3AED" strokeWidth="1.2" opacity="0.9" fill="none">
        <line x1="12" y1="38" x2="20" y2="46" />
        <line x1="20" y1="46" x2="32" y2="52" />
        <line x1="32" y1="52" x2="42" y2="48" />
        <line x1="42" y1="48" x2="48" y2="40" />
        <line x1="20" y1="46" x2="28" y2="40" />
        <line x1="28" y1="40" x2="38" y2="42" />
        <line x1="38" y1="42" x2="48" y2="40" />
        <line x1="12" y1="38" x2="28" y2="40" />
        <line x1="32" y1="52" x2="28" y2="40" />
      </g>
      {/* nós verdes (topo) */}
      <g fill="#22C55E">
        <circle cx="32" cy="10" r="2.6" />
        <circle cx="46" cy="14" r="2" />
        <circle cx="40" cy="22" r="1.8" />
      </g>
      <g fill="#0F5132">
        <circle cx="18" cy="14" r="2.2" />
        <circle cx="28" cy="22" r="1.8" />
      </g>
      {/* nó dourado de transição (gamificação) */}
      <circle cx="14" cy="26" r="2.6" fill="#D4AF37" />
      {/* nó cinza */}
      <circle cx="22" cy="32" r="1.6" fill="#6B7280" />
      {/* nós violeta (base) */}
      <g fill="#7C3AED" className={animClass}>
        <circle cx="12" cy="38" r="2.4" />
        <circle cx="20" cy="46" r="2" />
        <circle cx="32" cy="52" r="2.4" />
        <circle cx="42" cy="48" r="1.8" />
        <circle cx="48" cy="40" r="2" />
        <circle cx="28" cy="40" r="1.8" />
        <circle cx="38" cy="42" r="1.6" />
      </g>
    </svg>
  )
}

export function MessageBubble({ papel, conteudo }: { papel: 'user' | 'assistant'; conteudo: string }) {
  const assistant = papel === 'assistant'
  return (
    <div className={cn('flex gap-3', assistant ? 'items-start' : 'justify-end')}>
      {assistant && <CortexAvatar size={28} />}
      <div className={cn(
        'max-w-[82%] rounded-lg px-3 py-2 text-sm leading-6',
        assistant ? 'bg-white text-ink-800 ring-1 ring-black/10' : 'bg-ink-900 text-white'
      )}>
        {conteudo}
      </div>
    </div>
  )
}
