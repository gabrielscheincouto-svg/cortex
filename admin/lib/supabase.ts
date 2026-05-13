/**
 * Clients Supabase para o Next.js App Router.
 *
 * - createBrowserClient: para Client Components (login, formulários)
 * - createServerClient:  para Server Components, Server Actions e Route Handlers
 *
 * Ambos compartilham as cookies de sessão via @supabase/ssr.
 */

import { createBrowserClient as _createBrowserClient, createServerClient as _createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Use em Client Components (`'use client'`). */
export function createBrowserClient() {
  return _createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

/** Use em Server Components, Server Actions e Route Handlers. */
export function createServerClient() {
  const cookieStore = cookies()
  return _createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // chamado de Server Component sem cookies write — silencioso
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch {
          // idem
        }
      },
    },
  })
}
