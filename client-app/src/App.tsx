/**
 * App — montagem dos providers globais + camada PWA.
 *
 * Ordem: QueryClient (cache de dados) → RouterProvider (rotas com data router).
 * AuthProvider precisa estar dentro do Router e é montado pelo RootLayout.
 *
 * Camada PWA: OfflineIndicator (barra topo quando sem rede) + UpdatePrompt
 * (toast quando há nova versão do SW) ficam fora do Router pra não dependerem
 * de rota — sempre visíveis.
 */
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { queryClient } from '@/lib/queryClient'
import { OfflineIndicator } from '@/components/pwa/offline-indicator'
import { UpdatePrompt } from '@/components/pwa/update-prompt'
import { router } from './routes'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OfflineIndicator />
      <RouterProvider router={router} />
      <UpdatePrompt />
    </QueryClientProvider>
  )
}
