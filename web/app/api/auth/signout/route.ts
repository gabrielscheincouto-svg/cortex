/**
 * GET/POST /api/auth/signout
 *
 * Faz logout do Supabase (limpa cookies de sessão) e redireciona pra /login.
 * Usado quando o user logado é de outra org/cliente e quer trocar de conta.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

async function handler(req: Request): Promise<NextResponse> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  const url = new URL('/login', req.url)
  return NextResponse.redirect(url)
}

export const GET = handler
export const POST = handler
