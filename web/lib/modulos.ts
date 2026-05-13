/** Resolução de módulos ativos por org: combina plano + overrides em org_modulos. */

import { createServerClient } from './supabase'

export interface OrgContext {
  org_id: string
  org_nome: string
  org_slug: string
  cor_primaria: string
  my_role: string
  modulos_ativos: string[]  // ['kanban','empresas','liquidacao','chat',...]
}

/** Carrega o contexto da org atual do user logado. Inclui resolução de módulos. */
export async function loadOrgContext(): Promise<OrgContext | null> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, current_org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.current_org_id) return null

  const { data: orgRow } = await supabase
    .from('orgs')
    .select('id, slug, nome, cor_primaria, plano_id, planos(modulos_inclusos)')
    .eq('id', profile.current_org_id)
    .single()
  if (!orgRow) return null

  const { data: membroRow } = await supabase
    .from('org_membros')
    .select('role')
    .eq('org_id', profile.current_org_id)
    .eq('user_id', user.id)
    .eq('status', 'ativo')
    .single()

  const plano = Array.isArray(orgRow.planos) ? orgRow.planos[0] : orgRow.planos
  const baseModulos: string[] = Array.isArray(plano?.modulos_inclusos) ? plano.modulos_inclusos : []

  const { data: overrides } = await supabase
    .from('org_modulos')
    .select('modulo, ativo')
    .eq('org_id', profile.current_org_id)

  const ativos = new Set(baseModulos)
  overrides?.forEach(o => {
    if (o.ativo) ativos.add(o.modulo)
    else ativos.delete(o.modulo)
  })

  return {
    org_id: orgRow.id,
    org_nome: orgRow.nome,
    org_slug: orgRow.slug,
    cor_primaria: orgRow.cor_primaria,
    my_role: membroRow?.role ?? 'visualizador',
    modulos_ativos: Array.from(ativos),
  }
}

/** Lista todas as orgs do user (para o seletor de org). */
export async function listMyOrgs() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('org_membros')
    .select('role, orgs(id, slug, nome, cor_primaria, status)')
    .eq('user_id', user.id)
    .eq('status', 'ativo')
  return (data ?? [])
    .map(r => ({ ...(Array.isArray(r.orgs) ? r.orgs[0] : r.orgs), my_role: r.role }))
    .filter(Boolean)
}
