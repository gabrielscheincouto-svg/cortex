/**
 * Cliente Supabase do browser (PWA cliente final).
 *
 * Mesmo projeto Supabase usado pelo `web/` e `admin/`. Aqui usamos `anon key` —
 * o RLS garante que o cliente só leia dados da própria empresa.
 *
 * Não usar `service_role` no browser jamais.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Falha rápido em dev — evita warnings opacos em produção.
  // eslint-disable-next-line no-console
  console.error(
    '[Cortex] VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias. ' +
      'Copie `.env.example` para `.env.local` e preencha.',
  )
}

let _client: SupabaseClient | undefined

/** Singleton — evita múltiplas conexões realtime. */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL ?? '', SUPABASE_ANON_KEY ?? '', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  }
  return _client
}
