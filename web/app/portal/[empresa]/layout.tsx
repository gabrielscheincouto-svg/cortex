/**
 * Layout do Portal do Cliente Final.
 * Sem sidebar do escritório — header minimal com nome da empresa + orb.
 * Auth separado: usa empresa_usuarios_finais.user_id em vez de org_membros.
 */

import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { CortexOrb } from '@/components/cortex/orb'

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { empresa: string }
}) {
  const supabase = createServerClient()

  // Empresa pública (qualquer um com o slug pode acessar a tela de login)
  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, razao_social, nome_fantasia, cnpj, org_id, orgs(nome, cor_primaria, logo_url)')
    .eq('slug_publico', params.empresa)
    .maybeSingle()

  if (!empresa) notFound()

  const escritorio = Array.isArray(empresa.orgs) ? empresa.orgs[0] : (empresa as any).orgs
  const titulo = empresa.nome_fantasia || empresa.razao_social

  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-50 to-white">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href={`/portal/${params.empresa}`} className="flex items-center gap-3">
            <CortexOrb size={32} mode="idle" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Portal do cliente</p>
              <p className="text-sm font-semibold text-ink-900">{titulo}</p>
            </div>
          </Link>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-ink-400">Atendido por</p>
            <p className="text-xs font-medium text-ink-700">{escritorio?.nome ?? '—'}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>

      <footer className="mx-auto max-w-5xl border-t border-black/5 px-6 py-6 text-center text-[11px] text-ink-400">
        Powered by <span className="font-display text-mind-700">usecortex</span> · o cérebro do escritório contábil
      </footer>
    </div>
  )
}
