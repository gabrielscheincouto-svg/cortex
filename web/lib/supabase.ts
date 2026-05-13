/** Clients Supabase para o Next.js App Router.
 *
 * IMPORTANTE: `cookies` de `next/headers` só pode ser importado em Server Components.
 * Esse arquivo é compartilhado entre client e server, então:
 *   - `createBrowserClient` é exportado direto (puro, sem next/headers)
 *   - `createServerClient` faz dynamic require de `next/headers` em tempo de chamada
 *
 * Assim Client Components podem importar `createBrowserClient` sem puxar next/headers.
 */

import {
  createBrowserClient as _createBrowserClient,
  createServerClient as _createServerClient,
  type CookieOptions,
} from '@supabase/ssr'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createBrowserClient() {
  return _createBrowserClient(URL, ANON)
}

export function createServerClient() {
  // Dynamic require evita que `next/headers` seja bundle-ado em Client Components.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { cookies } = require('next/headers') as typeof import('next/headers')
  const cookieStore = cookies()
  return _createServerClient(URL, ANON, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }) } catch { /* ignore */ }
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }) } catch { /* ignore */ }
      },
    },
  })
}
