/**
 * POST /api/clientes/convidar
 * Body: { empresa_id, nome, email, telefone?, role }
 *
 * Auth do escritório (admin/gerente). Cria:
 *   1. user no Supabase Auth (service_role)
 *   2. vínculo em empresa_usuarios_finais
 *
 * Resposta: { email, nome, senha_temporaria, portal_url }
 *
 * IMPORTANTE: usa SUPABASE_SERVICE_ROLE_KEY — só roda no servidor (Next API Route).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { loadOrgContext } from '@/lib/modulos'

function gerarSenha(): string {
  // Senha legível: 4 letras + 4 dígitos + 1 símbolo
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
      return NextResponse.json({ error: 'apenas admin/gerente pode convidar' }, { status: 403 })
    }

    const body = await req.json()
    const { empresa_id, nome, email, telefone, role } = body
    if (!empresa_id || !nome || !email || !role) {
      return NextResponse.json({ error: 'campos obrigatórios: empresa_id, nome, email, role' }, { status: 400 })
    }
    if (!['titular','financeiro','contador','visualizador'].includes(role)) {
      return NextResponse.json({ error: 'role inválida' }, { status: 400 })
    }

    const supabase = createServerClient()

    // Confirma que empresa pertence à org do user
    const { data: empresa } = await supabase
      .from('empresas')
      .select('id, slug_publico, razao_social, org_id')
      .eq('id', empresa_id)
      .eq('org_id', ctx.org_id)
      .maybeSingle()
    if (!empresa) {
      return NextResponse.json({ error: 'empresa não encontrada' }, { status: 404 })
    }

    // Cria user via service_role
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const senha = gerarSenha()
    let userId: string | undefined

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, role, empresa_id, escopo: 'cliente_final' },
    })

    if (createErr) {
      // Se já existe, busca o user existente — mantemos o vínculo (não troca senha)
      if (String(createErr.message ?? '').toLowerCase().includes('already')) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers()
        const existing = list?.users?.find((u: any) => u.email === email)
        if (existing) {
          userId = existing.id
        } else {
          return NextResponse.json({ error: 'email já em uso mas user não localizado' }, { status: 409 })
        }
      } else {
        return NextResponse.json({ error: createErr.message }, { status: 500 })
      }
    } else {
      userId = created.user?.id
    }

    if (!userId) {
      return NextResponse.json({ error: 'falha ao criar/localizar user' }, { status: 500 })
    }

    // Vincula em empresa_usuarios_finais
    const { error: vincErr } = await supabaseAdmin
      .from('empresa_usuarios_finais')
      .upsert({
        org_id: empresa.org_id,
        empresa_id: empresa.id,
        user_id: userId,
        nome,
        email,
        telefone: telefone || null,
        role,
        ativo: true,
        convite_enviado_em: new Date().toISOString(),
      }, { onConflict: 'empresa_id,email' })

    if (vincErr) {
      return NextResponse.json({ error: vincErr.message }, { status: 500 })
    }

    const portalUrl = empresa.slug_publico
      ? `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usecortex-app.netlify.app'}/portal/${empresa.slug_publico}/login`
      : undefined

    return NextResponse.json({
      ok: true,
      nome, email,
      senha_temporaria: createErr ? '(já existia — senha não foi alterada)' : senha,
      portal_url: portalUrl,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'erro inesperado' }, { status: 500 })
  }
}
