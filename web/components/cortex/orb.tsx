/**
 * Orb do Cortex — esfera 3D translúcida com onda interna pulsando.
 * Inspirada em Apple Intelligence / Siri 2024.
 *
 * Implementação: SVG + CSS animations (sem Three.js).
 * Peso: <2 KB de JS, 0 dependências extras. Funciona em mobile.
 *
 * Variantes:
 * - `size`: tamanho em px. Default 360 (hero). Use 48 pra inline.
 * - `mode`: 'idle' (verde+violeta calmo) | 'thinking' (pulso rápido) | 'cortex' (verde+violeta+dourado)
 */
'use client'

import { useId } from 'react'

interface OrbProps {
  size?: number
  mode?: 'idle' | 'thinking' | 'cortex'
  className?: string
}

export function CortexOrb({ size = 360, mode = 'cortex', className = '' }: OrbProps) {
  const id = useId().replace(/:/g, '')
  const speed = mode === 'thinking' ? '4s' : '8s'

  return (
    <div
      className={`cortex-orb ${className}`}
      style={{ width: size, height: size, position: 'relative' }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 400 400"
        width={size}
        height={size}
        style={{ display: 'block' }}
      >
        <defs>
          {/* Gradient base: violeta + verde (paleta Cortex) */}
          <radialGradient id={`g-base-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.95"/>
            <stop offset="40%"  stopColor="#EDE9FE" stopOpacity="0.85"/>
            <stop offset="70%"  stopColor="#C4B5FD" stopOpacity="0.55"/>
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0"/>
          </radialGradient>

          {/* Highlight superior — efeito glossy */}
          <radialGradient id={`g-hl-${id}`} cx="50%" cy="35%" r="40%">
            <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.95"/>
            <stop offset="60%"  stopColor="#FFFFFF" stopOpacity="0.0"/>
          </radialGradient>

          {/* Onda interna verde-violeta — pulsa */}
          <linearGradient id={`g-wave-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#22C55E" stopOpacity="0.0"/>
            <stop offset="35%"  stopColor="#22C55E" stopOpacity="0.85"/>
            <stop offset="55%"  stopColor="#D4AF37" stopOpacity="0.6"/>
            <stop offset="75%"  stopColor="#7C3AED" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0"/>
          </linearGradient>

          {/* Glow externo — halo sutil */}
          <radialGradient id={`g-glow-${id}`} cx="50%" cy="50%" r="55%">
            <stop offset="50%"  stopColor="#7C3AED" stopOpacity="0.0"/>
            <stop offset="80%"  stopColor="#7C3AED" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0"/>
          </radialGradient>

          {/* Máscara circular pra confinar a onda dentro da esfera */}
          <clipPath id={`clip-${id}`}>
            <circle cx="200" cy="200" r="155"/>
          </clipPath>

          {/* Blur filter pra onda */}
          <filter id={`blur-${id}`}>
            <feGaussianBlur stdDeviation="3"/>
          </filter>
        </defs>

        {/* Halo externo */}
        <circle cx="200" cy="200" r="195" fill={`url(#g-glow-${id})`}>
          <animate attributeName="r" values="195;205;195" dur={speed} repeatCount="indefinite"/>
        </circle>

        {/* Esfera base — gradient radial */}
        <circle cx="200" cy="200" r="155" fill={`url(#g-base-${id})`}/>

        {/* Anel sutil ao redor */}
        <circle cx="200" cy="200" r="155" fill="none" stroke="#C4B5FD" strokeWidth="0.5" opacity="0.4"/>

        {/* Onda interna pulsante — confinada na esfera */}
        <g clipPath={`url(#clip-${id})`}>
          <path
            d="M 0 200 Q 100 160 200 200 T 400 200 L 400 240 Q 300 280 200 240 T 0 240 Z"
            fill={`url(#g-wave-${id})`}
            filter={`url(#blur-${id})`}
            opacity="0.85"
          >
            <animate
              attributeName="d"
              dur={speed}
              repeatCount="indefinite"
              values="
                M 0 200 Q 100 160 200 200 T 400 200 L 400 240 Q 300 280 200 240 T 0 240 Z;
                M 0 210 Q 100 250 200 210 T 400 210 L 400 250 Q 300 210 200 250 T 0 250 Z;
                M 0 200 Q 100 160 200 200 T 400 200 L 400 240 Q 300 280 200 240 T 0 240 Z"
            />
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 200 200" to="360 200 200"
              dur={mode === 'thinking' ? '8s' : '20s'}
              repeatCount="indefinite"
            />
          </path>

          {/* 2ª onda contra-rotação verde */}
          <path
            d="M 0 180 Q 100 220 200 180 T 400 180 L 400 220 Q 300 180 200 220 T 0 220 Z"
            fill="#22C55E"
            opacity="0.18"
            filter={`url(#blur-${id})`}
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="360 200 200" to="0 200 200"
              dur={mode === 'thinking' ? '12s' : '28s'}
              repeatCount="indefinite"
            />
          </path>

          {/* Pontinho dourado orbital — toque gamificação */}
          {mode === 'cortex' && (
            <circle r="3" fill="#D4AF37">
              <animateMotion
                dur="14s"
                repeatCount="indefinite"
                path="M 200 60 a 140 140 0 1 1 -0.1 0 z"
              />
              <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite"/>
            </circle>
          )}
        </g>

        {/* Highlight glossy superior */}
        <ellipse cx="180" cy="140" rx="80" ry="50" fill={`url(#g-hl-${id})`} opacity="0.7"/>

        {/* Borda fina pra dar definição */}
        <circle cx="200" cy="200" r="155" fill="none" stroke="rgba(124,58,237,0.25)" strokeWidth="1"/>
      </svg>

      <style jsx>{`
        .cortex-orb {
          filter: drop-shadow(0 20px 60px rgba(124, 58, 237, 0.25))
                  drop-shadow(0 10px 30px rgba(34, 197, 94, 0.15));
          animation: orb-float 6s ease-in-out infinite;
        }
        @keyframes orb-float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%      { transform: translateY(-8px) scale(1.015); }
        }
      `}</style>
    </div>
  )
}
