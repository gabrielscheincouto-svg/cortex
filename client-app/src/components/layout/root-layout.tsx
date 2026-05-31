/**
 * RootLayout — wrapper das rotas que monta o AuthProvider.
 * AuthProvider depende dos hooks `useNavigate`/`useLocation`, então precisa estar
 * dentro do contexto do React Router (Data Router).
 */
import { Outlet } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'

export function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
