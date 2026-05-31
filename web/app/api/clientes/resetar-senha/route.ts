/**
 * POST /api/clientes/resetar-senha
 * Body: { cliente_id }
 * Reseta senha do cliente final (empresa_usuarios_finais.user_id) com nova
 * senha temporária, retorna em texto plano pro admin entregar via canal seguro.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'

function gerarSenha(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digitos = '23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += letras[Math.floor(Math.random() * letras.length)]
  for (let i = 0; i < 4; i++) s += digitos[Math.floor(Math.random() * digitos.length)]
  return s + '!'
}

export async function POST(req: Request) {
  try {
    const ctx = await loadOrgContext()
    if (!ctx) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
    if (!['admin','gerente'].includes(ctx.my_role)) {
      return NextResponse.json({ error: 'apenas admin/gerente' }, { status: 403 })
    }

    const { cliente_id } = await req.json()
    if (!cliente_id) return NextResponse.json({ error: 'cliente_id obrigatório' }, { status: 400 })

    const supabase = createServerClient()
    const { data: cliente } = await supabase
      .from('empresa_usuarios_finais')
      .select('id, user_id, email, empresa_id, empresas!empresa_id(org_id)')
      .eq('id', cliente_id)
      .maybeSingle()
    if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

    const emp = Array.isArray((cliente as any).empresas) ? (cliente as any).empresas[0] : (cliente as any).empresas
    if (emp?.org_id !== ctx.org_id) {
      return NextResponse.json({ error: 'cliente não pertence à sua org' }, { status: 403 })
    }
    if (!cliente.user_id) {
      return NextResponse.json({ error: 'cliente ainda não tem user_id; convide novamente' }, { status: 400 })
    }

    const senha = gerarSenha()
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    const { error } = await supabaseAdmin.auth.admin.updateUserById(cliente.user_id, { password: senha })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, senha_temporaria: senha, email: cliente.email })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'erro' }, { status: 500 })
  }
}
