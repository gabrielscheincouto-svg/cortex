'use client'

import { useState } from 'react'
import { ChevronDown, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ToolCallCard({ ferramenta, resumo, resultado }: { ferramenta: string; resumo: string; resultado?: unknown }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ml-12 rounded-lg border border-mind-300 bg-mind-50">
      <button type="button" onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-mind-900">
        <Wrench size={14} />
        <span className="flex-1">Cortex consultou: {resumo || ferramenta}</span>
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <pre className="max-h-56 overflow-auto border-t border-mind-300 px-3 py-2 text-[11px] text-mind-900">
          {JSON.stringify(resultado ?? {}, null, 2)}
        </pre>
      )}
    </div>
  )
}
