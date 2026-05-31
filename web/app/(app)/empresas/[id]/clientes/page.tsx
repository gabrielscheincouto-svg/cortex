/**
 * Empresas › Clientes — gestão de acessos ao Portal do Cliente Final.
 *
 * Admin/gerente do escritório:
 *   - lista quem da empresa tem acesso (empresa_usuarios_finais)
 *   - convida novo cliente final (nome + email + role)
 *   - dá link direto pra cliente acessar https://app/portal/<slug>
 */

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, Mail, ExternalLink } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'
import { Card } from '@/components/ui'
import { dateBR } from '@/lib/utils'
import { FormConvidarCliente } from './form'
import { CardClienteAcoes } from './card-cliente'

export const revalidate = 0

export default async function EmpresaClientesPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const ctx = await loadOrgContext()
  if (!ctx) return null
  if (!['admin','gerente'].includes(ctx.my_role)) redirect(`/empresas/${params.id}`)

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, razao_social, nome_fantasia, cnpj, slug_publico')
    .eq('id', params.id)
    .eq('org_id', ctx.org_id)
    .maybeSingle()

  if (!empresa) notFound()

  const { data: clientes } = await supabase
    .from('empresa_usuarios_finais')
    .select('id, nome, email, telefone, role, ativo, primeiro_login_em, created_at')
    .eq('empresa_id', empresa.id)
    .order('created_at', { ascending: false })

  const portalUrl = empresa.slug_publico
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usecortex-app.netlify.app'}/portal/${empresa.slug_publico}/login`
    : null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/empresas/${params.id}`} className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700">
            <ArrowLeft size={12} /> Voltar para a empresa
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-ink-900">
            <Users size={22} className="text-mind-700" />
            Clientes finais — {empresa.nome_fantasia || empresa.razao_social}
          </h1>
          <p className="mt-1 text-xs text-ink-500">
            Pessoas dessa empresa que acessam o portal e baixam as entregas.
          </p>
        </div>
        {portalUrl && (
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-lg bg-mind-50 px-3 py-2 text-xs font-medium text-mind-800 ring-1 ring-inset ring-mind-200 hover:bg-mind-100"
          >
            <ExternalLink size={14} /> Abrir portal do cliente
          </a>
        )}
      </div>

      <FormConvidarCliente
        empresaId={empresa.id}
        empresaNome={empresa.nome_fantasia || empresa.razao_social}
        portalUrl={portalUrl ?? undefined}
      />

      <Card className="p-0">
        <div className="border-b border-black/5 px-5 py-3.5">
          <p className="font-semibold text-sm text-ink-900">
            {(clientes ?? []).length} {(clientes ?? []).length === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}
          </p>
        </div>

        {(!clientes || clientes.length === 0) ? (
          <div className="px-6 py-10 text-center">
            <Mail size={32} className="mx-auto text-ink-300" />
            <p className="mt-3 text-sm text-ink-500">Nenhum cliente final cadastrado ainda.</p>
            <p className="text-xs text-ink-400">Use o formulário acima pra convidar o primeiro acesso.</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {clientes.map(c => (
              <li key={c.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink-900">{c.nome}</p>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                        c.role === 'titular'    ? 'bg-mind-100 text-mind-800 ring-mind-200'
                        : c.role === 'financeiro' ? 'bg-amber-100 text-amber-900 ring-amber-300'
                        : c.role === 'contador'   ? 'bg-emerald-100 text-emerald-900 ring-emerald-300'
                        : 'bg-ink-100 text-ink-700 ring-ink-300'
                      }`}>{c.role}</span>
                      {!c.ativo && <span className="text-[10px] font-medium text-rose-700">inativo</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {c.email}
                      {c.telefone && <> · {c.telefone}</>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      {c.primeiro_login_em
                        ? <>Primeiro login: <strong>{dateBR(c.primeiro_login_em)}</strong></>
                        : <>Convidado em {dateBR(c.created_at)} · ainda não acessou</>
                      }
                    </p>
                  </div>
                  <CardClienteAcoes
                    clienteId={c.id}
                    email={c.email}
                    ativo={c.ativo}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
