/**
 * Queries reusáveis do cliente — todas batem direto no Supabase.
 * O RLS faz o escopo (cliente só lê dados da própria empresa via
 * app.user_eh_cliente_da_empresa). Nada de filtro manual no client.
 *
 * Convenção das queryKey:
 *   ['kpis', empresaId]
 *   ['proximas-obrigacoes', empresaId]
 *   ['notificacoes-nao-lidas-count', empresaId]
 *   ['notificacoes', empresaId, filtros]
 *   ['obrigacoes', empresaId, filtros]
 *   ['solicitacoes', empresaId, filtros]
 */

import {
  useMutation, useQuery, useQueryClient,
  type UseMutationResult, type UseQueryResult,
} from '@tanstack/react-query'
import { getSupabase } from './supabase'

// ─── Tipos compartilhados ─────────────────────────────────────────────────

export type EntregaStatus =
  | 'pendente'
  | 'em_andamento'
  | 'aguardando_cliente'
  | 'entregue'
  | 'justificada'
  | 'dispensada'
  | 'atrasada'

export interface EntregaArquivo {
  id: string
  nome_original: string
  tamanho_bytes: number
  mime_type: string | null
  created_at: string
}

export interface EntregaResumida {
  id: string
  empresa_id: string
  obrigacao_id: string
  obrigacao_nome: string
  departamento: string
  competencia: string
  prazo_legal: string
  status: EntregaStatus
  entregue_em: string | null
  arquivos?: EntregaArquivo[]
}

export interface KpisCliente {
  obrigacoesDoMes: number
  vencendoEm7Dias: number
  atrasadas: number
  notificacoesNaoLidas: number
}

export type NotificacaoTipo =
  | 'nova_guia'
  | 'novo_documento'
  | 'novo_balancete'
  | 'resposta_chamado'
  | 'alerta_vencimento'
  | 'alerta_atraso'

export interface NotificacaoCliente {
  id: string
  empresa_id: string
  tipo: NotificacaoTipo
  titulo: string
  corpo: string | null
  payload: Record<string, unknown>
  lida_em: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Retorna competência do mês corrente em formato 'YYYY-MM'. */
export function competenciaAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Retorna data ISO (YYYY-MM-DD) somando dias na data informada. */
export function isoMaisDias(base: Date, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Hook: 4 KPIs da Home ─────────────────────────────────────────────────

export function useKpisCliente(empresaId: string | undefined): UseQueryResult<KpisCliente> {
  return useQuery({
    queryKey: ['kpis', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const supabase = getSupabase()
      const eid = empresaId as string
      const hoje = new Date()
      const hojeIso = hoje.toISOString().slice(0, 10)
      const em7dias = isoMaisDias(hoje, 7)
      const comp = competenciaAtual()

      const [doMesRes, vencendoRes, atrasadasRes, naoLidasRes] = await Promise.all([
        supabase
          .from('entregas')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', eid)
          .eq('competencia', comp),
        supabase
          .from('entregas')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', eid)
          .gte('prazo_legal', hojeIso)
          .lte('prazo_legal', em7dias)
          .not('status', 'in', '("entregue","justificada","dispensada")'),
        supabase
          .from('entregas')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', eid)
          .lt('prazo_legal', hojeIso)
          .not('status', 'in', '("entregue","justificada","dispensada")'),
        supabase
          .from('cliente_notificacoes')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', eid)
          .is('lida_em', null),
      ])

      return {
        obrigacoesDoMes: doMesRes.count ?? 0,
        vencendoEm7Dias: vencendoRes.count ?? 0,
        atrasadas: atrasadasRes.count ?? 0,
        notificacoesNaoLidas: naoLidasRes.count ?? 0,
      }
    },
  })
}

// ─── Hook: Próximas obrigações (Home) ─────────────────────────────────────

export function useProximasObrigacoes(empresaId: string | undefined): UseQueryResult<EntregaResumida[]> {
  return useQuery({
    queryKey: ['proximas-obrigacoes', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const supabase = getSupabase()
      const eid = empresaId as string
      const hoje = new Date()
      const hojeIso = hoje.toISOString().slice(0, 10)
      const em30dias = isoMaisDias(hoje, 30)

      const { data, error } = await supabase
        .from('entregas')
        .select(`
          id, empresa_id, obrigacao_id, departamento, competencia, prazo_legal, status, entregue_em,
          obrigacoes_catalogo:obrigacao_id (nome)
        `)
        .eq('empresa_id', eid)
        .gte('prazo_legal', hojeIso)
        .lte('prazo_legal', em30dias)
        .not('status', 'in', '("entregue","justificada","dispensada")')
        .order('prazo_legal', { ascending: true })
        .limit(8)

      if (error) throw error

      type Row = {
        id: string
        empresa_id: string
        obrigacao_id: string
        departamento: string
        competencia: string
        prazo_legal: string
        status: EntregaStatus
        entregue_em: string | null
        obrigacoes_catalogo: { nome: string } | null
      }
      return (data as unknown as Row[] | null ?? []).map(r => ({
        id: r.id,
        empresa_id: r.empresa_id,
        obrigacao_id: r.obrigacao_id,
        obrigacao_nome: r.obrigacoes_catalogo?.nome ?? 'Obrigação',
        departamento: r.departamento,
        competencia: r.competencia,
        prazo_legal: r.prazo_legal,
        status: r.status,
        entregue_em: r.entregue_em,
      }))
    },
  })
}

// ─── Hook: Contagem de notificações não-lidas (sino do topbar) ────────────

export function useNotificacoesNaoLidasCount(empresaId: string | undefined): UseQueryResult<number> {
  return useQuery({
    queryKey: ['notificacoes-nao-lidas-count', empresaId],
    enabled: !!empresaId,
    refetchInterval: 60_000, // polling leve a cada 1 min
    queryFn: async () => {
      const supabase = getSupabase()
      const eid = empresaId as string
      const { count, error } = await supabase
        .from('cliente_notificacoes')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', eid)
        .is('lida_em', null)
      if (error) throw error
      return count ?? 0
    },
  })
}

// ─── Hook: Lista de notificações ──────────────────────────────────────────

export function useNotificacoes(
  empresaId: string | undefined,
  apenasNaoLidas = false,
): UseQueryResult<NotificacaoCliente[]> {
  return useQuery({
    queryKey: ['notificacoes', empresaId, { apenasNaoLidas }],
    enabled: !!empresaId,
    queryFn: async () => {
      const supabase = getSupabase()
      const eid = empresaId as string
      let q = supabase
        .from('cliente_notificacoes')
        .select('id, empresa_id, tipo, titulo, corpo, payload, lida_em, created_at')
        .eq('empresa_id', eid)
        .order('created_at', { ascending: false })
        .limit(100)
      if (apenasNaoLidas) {
        q = q.is('lida_em', null)
      }
      const { data, error } = await q
      if (error) throw error
      return (data as NotificacaoCliente[] | null) ?? []
    },
  })
}

// ─── Tipos de solicitação ─────────────────────────────────────────────────

export type DepartamentoCodigo =
  | 'contabil' | 'fiscal' | 'pessoal' | 'societario'
  | 'comercial' | 'rural' | 'paralegal' | 'outro'

export type CampoTipo = 'text' | 'textarea' | 'date' | 'number' | 'select' | 'checkbox' | 'file'

export interface CampoForm {
  name: string
  label: string
  type: CampoTipo
  required?: boolean
  placeholder?: string
  options?: string[]
  mask?: string
}

export interface SolicitacaoTipo {
  id: string
  codigo: string
  label: string
  descricao: string | null
  departamento: DepartamentoCodigo
  campos_form: CampoForm[]
  icone: string | null
  ordem: number
  sla_resposta_horas: number
  sla_resolucao_horas: number
}

export function useSolicitacaoTipos(): UseQueryResult<SolicitacaoTipo[]> {
  return useQuery({
    queryKey: ['solicitacao-tipos'],
    staleTime: 5 * 60_000, // catálogo muda raramente
    queryFn: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('solicitacao_tipos')
        .select('id, codigo, label, descricao, departamento, campos_form, icone, ordem, sla_resposta_horas, sla_resolucao_horas')
        .eq('ativo', true)
        .order('departamento', { ascending: true })
        .order('ordem', { ascending: true })
      if (error) throw error
      return (data as SolicitacaoTipo[] | null) ?? []
    },
  })
}

// ─── Solicitações do cliente ──────────────────────────────────────────────

export type SolicitacaoStatus =
  | 'nova' | 'em_atendimento' | 'aguardando_cliente' | 'resolvida' | 'fechada' | 'cancelada'

export interface SolicitacaoResumida {
  id: string
  assunto: string
  descricao: string | null
  status: SolicitacaoStatus
  prioridade: string
  tipo_codigo: string | null
  departamento_sugerido: string | null
  criada_em: string
  primeira_resposta_em: string | null
  resolvida_em: string | null
  mensagens_count?: number
}

export function useSolicitacoes(empresaId: string | undefined): UseQueryResult<SolicitacaoResumida[]> {
  return useQuery({
    queryKey: ['solicitacoes', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const supabase = getSupabase()
      const eid = empresaId as string
      const { data, error } = await supabase
        .from('solicitacoes')
        .select('id, assunto, descricao, status, prioridade, tipo_codigo, departamento_sugerido, created_at, primeira_resposta_em, resolvida_em')
        .eq('empresa_id', eid)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      type Row = {
        id: string; assunto: string; descricao: string | null;
        status: SolicitacaoStatus; prioridade: string;
        tipo_codigo: string | null; departamento_sugerido: string | null;
        created_at: string; primeira_resposta_em: string | null; resolvida_em: string | null
      }
      return (data as unknown as Row[] | null ?? []).map(r => ({
        id: r.id,
        assunto: r.assunto,
        descricao: r.descricao,
        status: r.status,
        prioridade: r.prioridade,
        tipo_codigo: r.tipo_codigo,
        departamento_sugerido: r.departamento_sugerido,
        criada_em: r.created_at,
        primeira_resposta_em: r.primeira_resposta_em,
        resolvida_em: r.resolvida_em,
      }))
    },
  })
}

// ─── Documentos (entrega_arquivos visíveis ao cliente) ────────────────────

export type ArquivoTipo = 'sped' | 'guia' | 'recibo' | 'declaracao' | 'relatorio' | 'documento' | 'outro'

export interface DocumentoCliente {
  id: string
  nome_original: string
  tipo: ArquivoTipo
  mime_type: string | null
  tamanho_bytes: number
  origem: string
  created_at: string
  // Da entrega vinculada
  competencia: string
  obrigacao_nome: string
  departamento: string
}

export function useDocumentos(empresaId: string | undefined): UseQueryResult<DocumentoCliente[]> {
  return useQuery({
    queryKey: ['documentos', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const supabase = getSupabase()
      const eid = empresaId as string
      const { data, error } = await supabase
        .from('entrega_arquivos')
        .select(`
          id, nome_original, tipo, mime_type, tamanho_bytes, origem, created_at, visivel_cliente,
          entregas!inner (
            empresa_id, competencia, departamento,
            obrigacoes_catalogo:obrigacao_id (nome)
          )
        `)
        .eq('entregas.empresa_id', eid)
        .eq('visivel_cliente', true)
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) throw error
      type Row = {
        id: string
        nome_original: string
        tipo: ArquivoTipo
        mime_type: string | null
        tamanho_bytes: number
        origem: string
        created_at: string
        visivel_cliente: boolean
        entregas: {
          empresa_id: string
          competencia: string
          departamento: string
          obrigacoes_catalogo: { nome: string } | null
        } | null
      }
      return ((data as unknown as Row[] | null) ?? []).map(r => {
        const entrega = r.entregas
        return {
          id: r.id,
          nome_original: r.nome_original,
          tipo: r.tipo,
          mime_type: r.mime_type,
          tamanho_bytes: r.tamanho_bytes,
          origem: r.origem,
          created_at: r.created_at,
          competencia: entrega?.competencia ?? '',
          obrigacao_nome: entrega?.obrigacoes_catalogo?.nome ?? 'Documento',
          departamento: entrega?.departamento ?? 'outro',
        }
      })
    },
  })
}

// ─── Detalhe de Solicitação + mensagens ───────────────────────────────────

export interface SolicitacaoDetalhe {
  id: string
  empresa_id: string
  org_id: string
  assunto: string
  descricao: string | null
  status: SolicitacaoStatus
  prioridade: string
  tipo_codigo: string | null
  departamento_sugerido: string | null
  dados_form: Record<string, unknown>
  criada_em: string
  responsavel_nome: string | null
  primeira_resposta_em: string | null
  resolvida_em: string | null
  sla_resposta_horas: number
}

export interface SolicitacaoMensagem {
  id: string
  solicitacao_id: string
  autor_tipo: 'cliente' | 'escritorio' | 'sistema'
  autor_nome: string | null
  autor_id: string | null
  conteudo: string
  criado_em: string
}

export function useSolicitacaoDetalhe(id: string | undefined): UseQueryResult<SolicitacaoDetalhe | null> {
  return useQuery({
    queryKey: ['solicitacao', id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('solicitacoes')
        .select(`
          id, empresa_id, org_id, assunto, descricao, status, prioridade,
          tipo_codigo, departamento_sugerido, dados_form, created_at,
          primeira_resposta_em, resolvida_em, sla_resposta_horas,
          responsavel:profiles!responsavel_id (nome)
        `)
        .eq('id', id as string)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      type Row = {
        id: string; empresa_id: string; org_id: string;
        assunto: string; descricao: string | null;
        status: SolicitacaoStatus; prioridade: string;
        tipo_codigo: string | null; departamento_sugerido: string | null;
        dados_form: Record<string, unknown> | null;
        created_at: string;
        primeira_resposta_em: string | null;
        resolvida_em: string | null;
        sla_resposta_horas: number;
        responsavel: { nome: string } | null
      }
      const r = data as unknown as Row
      return {
        id: r.id,
        empresa_id: r.empresa_id,
        org_id: r.org_id,
        assunto: r.assunto,
        descricao: r.descricao,
        status: r.status,
        prioridade: r.prioridade,
        tipo_codigo: r.tipo_codigo,
        departamento_sugerido: r.departamento_sugerido,
        dados_form: r.dados_form ?? {},
        criada_em: r.created_at,
        responsavel_nome: r.responsavel?.nome ?? null,
        primeira_resposta_em: r.primeira_resposta_em,
        resolvida_em: r.resolvida_em,
        sla_resposta_horas: r.sla_resposta_horas,
      }
    },
  })
}

export function useSolicitacaoMensagens(solicitacaoId: string | undefined): UseQueryResult<SolicitacaoMensagem[]> {
  return useQuery({
    queryKey: ['solicitacao-mensagens', solicitacaoId],
    enabled: !!solicitacaoId,
    refetchInterval: 30_000, // polling leve pra "tempo real" sem WebSocket
    queryFn: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('solicitacao_mensagens')
        .select('id, solicitacao_id, autor_tipo, autor_nome, autor_id, conteudo, criado_em')
        .eq('solicitacao_id', solicitacaoId as string)
        .order('criado_em', { ascending: true })
      // RLS já filtra interna=false pro cliente
      if (error) throw error
      return (data as SolicitacaoMensagem[] | null) ?? []
    },
  })
}

export function useEnviarMensagem(): UseMutationResult<
  void, Error,
  { solicitacaoId: string; orgId: string; autorNome: string | null; conteudo: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ solicitacaoId, orgId, autorNome, conteudo }) => {
      const supabase = getSupabase()
      const { error } = await supabase.from('solicitacao_mensagens').insert({
        solicitacao_id: solicitacaoId,
        org_id: orgId,
        autor_tipo: 'cliente',
        autor_nome: autorNome,
        conteudo,
        interna: false,
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['solicitacao-mensagens', vars.solicitacaoId] })
      void qc.invalidateQueries({ queryKey: ['solicitacoes'] })
    },
  })
}

// ─── Mutations: marcar notificações como lidas ───────────────────────────

export function useMarcarNotificacaoLida(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (notificacaoId: string) => {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('cliente_notificacoes')
        .update({ lida_em: new Date().toISOString() })
        .eq('id', notificacaoId)
        .is('lida_em', null)
      if (error) throw error
    },
    onSuccess: () => {
      // Invalida tudo que depende de não-lidas (sino, kpis, lista)
      void qc.invalidateQueries({ queryKey: ['notificacoes'] })
      void qc.invalidateQueries({ queryKey: ['notificacoes-nao-lidas-count'] })
      void qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

export function useMarcarTodasLidas(): UseMutationResult<number, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (empresaId: string) => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('cliente_notificacoes')
        .update({ lida_em: new Date().toISOString() })
        .eq('empresa_id', empresaId)
        .is('lida_em', null)
        .select('id')
      if (error) throw error
      return data?.length ?? 0
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notificacoes'] })
      void qc.invalidateQueries({ queryKey: ['notificacoes-nao-lidas-count'] })
      void qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

// ─── Hook: Lista de obrigações (com filtros) ──────────────────────────────

export interface FiltrosObrigacoes {
  status?: EntregaStatus | 'todas'
  competencia?: string
  departamento?: string
}

export function useObrigacoes(
  empresaId: string | undefined,
  filtros: FiltrosObrigacoes = {},
): UseQueryResult<EntregaResumida[]> {
  return useQuery({
    queryKey: ['obrigacoes', empresaId, filtros],
    enabled: !!empresaId,
    queryFn: async () => {
      const supabase = getSupabase()
      const eid = empresaId as string
      let q = supabase
        .from('entregas')
        .select(`
          id, empresa_id, obrigacao_id, departamento, competencia, prazo_legal, status, entregue_em,
          obrigacoes_catalogo:obrigacao_id (nome),
          entrega_arquivos!entrega_arquivos_entrega_id_fkey (
            id, nome_original, tamanho_bytes, mime_type, created_at, visivel_cliente
          )
        `)
        .eq('empresa_id', eid)
        .order('prazo_legal', { ascending: false })
        .limit(120)

      if (filtros.status && filtros.status !== 'todas') {
        q = q.eq('status', filtros.status)
      }
      if (filtros.competencia) {
        q = q.eq('competencia', filtros.competencia)
      }
      if (filtros.departamento) {
        q = q.eq('departamento', filtros.departamento)
      }

      const { data, error } = await q
      if (error) throw error

      type ArquivoRow = {
        id: string
        nome_original: string
        tamanho_bytes: number
        mime_type: string | null
        created_at: string
        visivel_cliente: boolean
      }
      type Row = {
        id: string
        empresa_id: string
        obrigacao_id: string
        departamento: string
        competencia: string
        prazo_legal: string
        status: EntregaStatus
        entregue_em: string | null
        obrigacoes_catalogo: { nome: string } | null
        entrega_arquivos: ArquivoRow[] | null
      }
      return (data as unknown as Row[] | null ?? []).map(r => ({
        id: r.id,
        empresa_id: r.empresa_id,
        obrigacao_id: r.obrigacao_id,
        obrigacao_nome: r.obrigacoes_catalogo?.nome ?? 'Obrigação',
        departamento: r.departamento,
        competencia: r.competencia,
        prazo_legal: r.prazo_legal,
        status: r.status,
        entregue_em: r.entregue_em,
        arquivos: (r.entrega_arquivos ?? [])
          .filter(a => a.visivel_cliente)
          .map(a => ({
            id: a.id,
            nome_original: a.nome_original,
            tamanho_bytes: a.tamanho_bytes,
            mime_type: a.mime_type,
            created_at: a.created_at,
          })),
      }))
    },
  })
}
