/**
 * GET /api/orgs/set-current?id=<uuid>
 *
 * Troca a org atual do user (UPDATE profiles.current_org_id) e redireciona
 * pra raiz, que faz o app recarregar com o novo contexto.
 *
 * Endpoint navegacional (não JSON) pra casar com o `<Link>` usado em
 * NoCurrentOrgScreen — quando o user clica num escritório no picker, é uma
 * navegação GET, não fetch.
 *
 * Segurança: a RLS de `profiles` só permite o user atualizar a própria row
 * (auth.uid() = id). Mesmo que alguém force `id` de uma org da qual não é
 * membro, o loadOrgContext devolve null e o picker reaparece — sem dados
 * vazando, porque todas as tabelas multitenant filtram por membership.
 *
 * O backend Go expõe o mesmo recurso em PATCH /api/v1/me/current-org (usado
 * pelo Admin Cortex). Esse route handler é o atalho navegacional do `web/`.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('id')

  const home = new URL('/', req.url)

  if (!orgId) {
    return NextResponse.redirect(home)
  }

  // Validação leve de UUID — evita query inútil pro Postgres
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRe.test(orgId)) {
    return NextResponse.redirect(home)
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // RLS garante que o user só atualiza o próprio profile.
  // Se o user não for membro da org, current_org_id vai pra um UUID válido
  // mas o loadOrgContext na próxima request devolve null e cai no picker
  // de novo — sem vazar nada.
  await supabase
    .from('profiles')
    .update({ current_org_id: orgId })
    .eq('id', user.id)

  return NextResponse.redirect(home)
}
