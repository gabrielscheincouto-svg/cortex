/**
 * Roteamento principal do client-app.
 * `/login` é pública; tudo embaixo de `AppShell` exige autenticação.
 */
import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from './components/layout/root-layout'
import { AppShell } from './components/layout/app-shell'
import { LoginPage } from './pages/login'
import { HomePage } from './pages/home'
import { ObrigacoesListPage } from './pages/obrigacoes/list'
import { SolicitacoesListPage } from './pages/solicitacoes/list'
import { SolicitacaoDetalhePage } from './pages/solicitacoes/detail'
import { DocumentosListPage } from './pages/documentos/list'
import { NotificacoesListPage } from './pages/notificacoes/list'
import { NotFoundPage } from './pages/error/not-found'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'obrigacoes', element: <ObrigacoesListPage /> },
          { path: 'solicitacoes', element: <SolicitacoesListPage /> },
          { path: 'solicitacoes/:id', element: <SolicitacaoDetalhePage /> },
          { path: 'documentos', element: <DocumentosListPage /> },
          { path: 'notificacoes', element: <NotificacoesListPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
