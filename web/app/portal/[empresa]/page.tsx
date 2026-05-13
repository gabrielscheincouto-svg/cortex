/**
 * Dashboard do cliente final.
 * Mostra:
 *   - Status geral (entregas no prazo, pendentes, arquivos disponíveis)
 *   - Lista das últimas entregas com download direto
 *   - Solicitações abertas (canal de comunicação com o escritório)
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FileText, CheckCircle2, Clock, Download, MessageSquare } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { Card, Stat, Pill, Empty } from '@/components/ui'
import { ago, dateBR } from '@/lib/utils'

export const revalidate = 60

export default async function PortalHomePage({ params }: { params: { empresa: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/portal/${params.empresa}/login`)
  }

  // Confirma vínculo + busca empresa
  const { data: vinculo } = await supabase
    .from('empresa_usuarios_finais')
    .select(`
      id, role, empresa_id,
      empresas!empresa_id(id, razao_social, nome_fantasia, cnpj, slug_publico)
    `)
    .eq('user_id', user.id)
    .eq('ativo', true)
    .maybeSingle()

  const empresa = vinculo && Array.isArray((vinculo as any).empresas)
    ? (vinculo as any).empresas[0]
    : (vinculo as any)?.empresas

  if (!vinculo || empresa?.slug_publico !== params.empresa) {
    redirect(`/portal/${params.empresa}/login`)
  }

  const empresaId = empresa.id

  // Dados do dashboard — RLS filtra por user_id e a tabela de vínculo
  const [
    { count: entregasTotal },
    { count: entregasEntregues },
    { count: entregasPendentes },
    { data: entregasRecentes },
    { count: solicitacoesAbertas },
  ] = await Promise.all([
    supabase.from('entregas').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId),
    supabase.from('entregas').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('status', 'entregue'),
    supabase.from('entregas').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId).in('status', ['pendente','em_andamento','aguardando_cliente']),
    supabase.from('entregas')
      .select(`
        id, competencia, prazo_legal, status, entregue_em,
        obrigacoes_catalogo!obrigacao_id(nome, sigla),
        entrega_arquivos(id, nome, tamanho_bytes)
      `)
      .eq('empresa_id', empresaId)
      .eq('status', 'entregue')
      .order('entregue_em', { ascending: false, nullsFirst: false })
      .limit(8),
    supabase.from('solicitacoes').select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .in('status', ['nova','em_atendimento','aguardando_cliente']),
  ])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-mind-700">Bem-vindo</p>
        <h1 className="mt-1 font-display text-3xl text-ink-900">Suas entregas, sempre à vista</h1>
        <p className="mt-1 text-sm text-ink-500">
          Tudo o que seu escritório entrega aparece aqui automaticamente — em tempo real.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Entregas totais" value={(entregasTotal ?? 0).toString()} sub="histórico completo" />
        <Stat label="Já entregues" value={(entregasEntregues ?? 0).toString()} sub="prontas para download" valueColor="text-emerald-700" />
        <Stat label="Pendentes" value={(entregasPendentes ?? 0).toString()} sub="em andamento" />
        <Stat label="Solicitações" value={(solicitacoesAbertas ?? 0).toString()} sub="abertas com você" accent="brand" />
      </div>

      {/* Últimas entregas */}
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-ink-700" />
            <p className="font-semibold text-sm text-ink-900">Últimas entregas</p>
          </div>
          <Link href={`/portal/${params.empresa}/entregas`} className="text-xs font-medium text-mind-700 hover:text-mind-900">
            Ver tudo →
          </Link>
        </div>

        {(!entregasRecentes || entregasRecentes.length === 0) ? (
          <Empty
            icon={FileText}
            title="Nenhuma entrega ainda"
            description="Quando seu escritório concluir uma obrigação, ela aparecerá aqui."
          />
        ) : (
          <ul className="divide-y divide-black/5">
            {entregasRecentes.map((e) => {
              const obrig = Array.isArray(e.obrigacoes_catalogo) ? e.obrigacoes_catalogo[0] : (e as any).obrigacoes_catalogo
              const arquivos = (e as any).entrega_arquivos ?? []
              return (
                <li key={e.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">{obrig?.nome ?? 'Obrigação'}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        competência {e.competencia} · entregue {ago(e.entregue_em)}
                      </p>
                    </div>
                    <Pill className="bg-emerald-100 text-emerald-900 ring-emerald-300">
                      <CheckCircle2 size={12} className="mr-1 inline" /> Entregue
                    </Pill>
                  </div>
                  {arquivos.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {arquivos.map((a: any) => (
                        <Link
                          key={a.id}
                          href={`/portal/${params.empresa}/arquivo/${a.id}`}
                          className="inline-flex items-center gap-1.5 rounded-md bg-mind-50 px-2.5 py-1 text-xs font-medium text-mind-800 ring-1 ring-mind-200 hover:bg-mind-100"
                        >
                          <Download size={12} /> {a.nome}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* Solicitações */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-ink-700" />
            <p className="font-semibold text-sm text-ink-900">Conversar com o escritório</p>
          </div>
          <Link href={`/portal/${params.empresa}/solicitacoes`} className="text-xs font-medium text-mind-700 hover:text-mind-900">
            Nova solicitação →
          </Link>
        </div>
        <p className="mt-2 text-sm text-ink-500">
          Use as solicitações para enviar documentos ou tirar dúvidas com seu escritório. Tudo fica registrado e auditável.
        </p>
      </Card>
    </div>
  )
}
