/** Middleware: protege rotas + renova sessão. Espelho do admin com paths ajustados. */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => res.cookies.set({ name, value, ...options }),
        remove: (name: string, options: CookieOptions) => res.cookies.set({ name, value: '', ...options }),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = req.nextUrl.pathname
  const isLogin    = path === '/login'
  const isAuth     = path.startsWith('/auth')
  const isPortal   = path.startsWith('/portal/')    // portal do cliente final tem auth próprio
  const isPublic   = isLogin || isAuth || isPortal

  // Não autenticado fora das áreas públicas → manda pra login do escritório
  if (!user && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  // Logado tentando ir pro login do escritório → manda pra home (escritório)
  if (user && path === '/login') {
    return NextResponse.redirect(new URL('/home', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
