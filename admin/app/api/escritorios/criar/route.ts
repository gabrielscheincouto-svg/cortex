/**
 * POST /api/escritorios/criar
 *
 * Endpoint de ONBOARDING de novo escritório no Cortex.
 * Acessível somente para super-admins (profiles.is_super_admin = true).
 *
 * Body:
 *   {
 *     slug:           string  // ex: 'aurora' → vira aurora.usecortex.com.br
 *     nome:           string  // ex: 'Aurora Contabilidade'
 *     cnpj?:          string  // opcional
 *     razao_social?:  string  // opcional
 *     plano_codigo:   'free' | 'pro' | 'enterprise'
 *     admin_email:    string  // email do PRIMEIRO admin do novo escritório
 *     admin_nome:     string  // nome do admin (ex: 'João da Silva')
 *   }
 *
 * Faz, em uma única transação (best-effort):
 *   1) Cria public.orgs (novo tenant) com plano e trial ativo
 *   2) Cria auth.users do admin com senha temporária aleatória
 *   3) Cria auth.identities (provider 'email')
 *   4) Cria public.profiles (trigger automática cuida disso, mas idempotente)
 *   5) Cria public.org_membros (user = admin do escritório novo)
 *
 * Retorna: { org, admin: { email, nome, senha_temporaria, login_url } }
 * IMPORTANTE: a senha_temporária é exibida UMA VEZ no painel admin.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'

interface CreateBody {
  slug?: string
  nome?: string
  cnpj?: string
  razao_social?: string
  plano_codigo?: 'free' | 'pro' | 'enterprise'
  admin_email?: string
  admin_nome?: string
}

function gerarSenha(): string {
  // Senha legível: 4 letras (sem confundíveis) + 4 dígitos + 1 símbolo
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digitos = '23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += letras[Math.floor(Math.random() * letras.length)]
  for (let i = 0; i < 4; i++) s += digitos[Math.floor(Math.random() * digitos.length)]
  return s + '!'
}

export async function POST(req: Request) {
  try {
    // 1) Verifica que o caller é super-admin
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()
    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'forbidden — apenas super-admins' }, { status: 403 })
    }

    // 2) Valida body
    const body = (await req.json()) as CreateBody
    const slug = body.slug?.trim().toLowerCase()
    const nome = body.nome?.trim()
    const plano = body.plano_codigo
    const adminEmail = body.admin_email?.trim().toLowerCase()
    const adminNome = body.admin_nome?.trim()
    if (!slug || !nome || !plano || !adminEmail || !adminNome) {
      return NextResponse.json(
        { error: 'campos obrigatórios: slug, nome, plano_codigo, admin_email, admin_nome' },
        { status: 400 },
      )
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'slug deve conter só letras minúsculas, números e hífen' },
        { status: 400 },
      )
    }

    // 3) Service-role pra rodar as inserções privilegiadas
    const SERVICE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!SERVICE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' }, { status: 500 })
    }
    const sb = createClient(SERVICE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 4) Resolve plano_id pelo código
    const { data: plano_row, error: planoErr } = await sb
      .from('planos')
      .select('id')
      .eq('codigo', plano)
      .single()
    if (planoErr || !plano_row) {
      return NextResponse.json({ error: `plano '${plano}' não existe` }, { status: 400 })
    }

    // 5) Cria a org (trial de 14 dias)
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)

    const orgPayload: Record<string, unknown> = {
      slug,
      nome,
      plano_id: plano_row.id,
      status: 'ativo',
      onboarding_completo: false,
      trial_ends_at: trialEnd.toISOString(),
      cor_primaria: '#22C55E',
      criada_por: user.id,
    }
    if (body.cnpj?.trim()) orgPayload.cnpj = body.cnpj.trim()
    if (body.razao_social?.trim()) orgPayload.razao_social = body.razao_social.trim()

    const { data: org, error: orgErr } = await sb
      .from('orgs')
      .insert(orgPayload)
      .select('id, slug, nome, plano_id, status, trial_ends_at, created_at')
      .single()
    if (orgErr || !org) {
      return NextResponse.json(
        { error: `falha ao criar org: ${orgErr?.message ?? 'desconhecido'}` },
        { status: 500 },
      )
    }

    // 6) Cria user admin via Auth Admin API (cria senha hashed, email_confirmed, etc)
    const senhaTemp = gerarSenha()
    const { data: created, error: userErr } = await sb.auth.admin.createUser({
      email: adminEmail,
      password: senhaTemp,
      email_confirm: true,
      user_metadata: { nome: adminNome },
    })
    if (userErr || !created?.user) {
      // rollback da org
      await sb.from('orgs').delete().eq('id', org.id)
      return NextResponse.json(
        { error: `falha ao criar user admin: ${userErr?.message ?? 'desconhecido'}` },
        { status: 500 },
      )
    }
    const adminUserId = created.user.id

    // 7) Upsert profile (trigger pode ter criado com nome vazio)
    await sb
      .from('profiles')
      .upsert({ id: adminUserId, nome: adminNome, email: adminEmail, is_super_admin: false }, { onConflict: 'id' })

    // 8) Vincula como admin da nova org
    const { error: membroErr } = await sb.from('org_membros').insert({
      org_id: org.id,
      user_id: adminUserId,
      role: 'admin',
      status: 'ativo',
      salario_base_cents: 0,
      cargo: 'Administrador',
      convidado_por: user.id,
      aceito_em: new Date().toISOString(),
    })
    if (membroErr) {
      return NextResponse.json(
        { error: `falha ao vincular admin: ${membroErr.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({
      org,
      admin: {
        user_id: adminUserId,
        email: adminEmail,
        nome: adminNome,
        senha_temporaria: senhaTemp,
        login_url: 'https://usecortex-app.netlify.app/login',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
