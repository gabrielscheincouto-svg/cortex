/**
 * Auth context — sessão Supabase + resolução da empresa do cliente.
 *
 * Hooks:
 *   useAuth() → { session, user, empresa, status, signOut }
 *   useRequireAuth() → redireciona pra /login se não autenticado
 *
 * A "empresa" do cliente é resolvida via tabela `empresa_acessos` (a definir
 * no schema): cada user_id é vinculado a uma ou mais empresas. Por hora,
 * resolvemos só a primeira — multi-empresa fica para fase 2.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

export type EmpresaUsuarioRole = 'visualizador' | 'aprovador' | 'admin'

export interface ClienteEmpresa {
  readonly id: string
  readonly nome: string
  readonly cnpj?: string | null
  readonly role: EmpresaUsuarioRole
}

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated'

interface AuthContextValue {
  readonly status: AuthStatus
  readonly session: Session | null
  readonly user: User | null
  readonly empresa: ClienteEmpresa | null
  readonly signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [empresa, setEmpresa] = useState<ClienteEmpresa | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    const supabase = getSupabase()
    let active = true

    // 1) tenta restaurar sessão persistida
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setStatus(data.session ? 'authenticated' : 'unauthenticated')
    })

    // 2) escuta mudanças de auth (login, logout, refresh)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      setStatus(sess ? 'authenticated' : 'unauthenticated')
      if (!sess) setEmpresa(null)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Quando logar, resolve qual empresa o cliente representa via
  // empresa_usuarios_finais (vínculo user ↔ empresa, com role).
  // O RLS policy `app.user_eh_cliente_da_empresa()` (migration 042) garante
  // que ele só lê dados da própria empresa daqui pra frente.
  useEffect(() => {
    if (!session) return
    let active = true
    void (async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('empresa_usuarios_finais')
        .select(`
          empresa_id,
          role,
          empresas:empresa_id ( id, razao_social, nome_fantasia, cnpj )
        `)
        .eq('user_id', session.user.id)
        .eq('ativo', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!active) return
      if (error || !data) return
      // PostgREST devolve FK n:1 como OBJETO (não array). Array é só pra n:N.
      // Como empresa_usuarios_finais.empresa_id → empresas.id é n:1, vem como objeto.
      const row = data as {
        empresa_id: string
        role: EmpresaUsuarioRole
        empresas: { id: string; razao_social: string; nome_fantasia: string | null; cnpj: string | null } | null
      }
      const emp = row.empresas
      if (!emp) return
      setEmpresa({
        id: emp.id,
        nome: emp.nome_fantasia ?? emp.razao_social,
        cnpj: emp.cnpj,
        role: row.role,
      })
    })()
    return () => {
      active = false
    }
  }, [session])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      empresa,
      signOut: async () => {
        await getSupabase().auth.signOut()
      },
    }),
    [status, session, empresa],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}

/** Hook pra páginas que exigem login. Redireciona pra /login se não autenticado. */
export function useRequireAuth(): AuthContextValue {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      navigate('/login', { replace: true, state: { from: location.pathname } })
    }
  }, [auth.status, navigate, location.pathname])

  return auth
}
