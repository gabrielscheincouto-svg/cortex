/**
 * Configuração do TanStack Query.
 * - staleTime 30s evita refetch agressivo em telas que abrem juntas.
 * - retry só em falhas de rede; 4xx não retenta.
 * - refetchOnWindowFocus desligado pra não bombardear a API a cada troca de aba.
 */
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error: unknown) => {
        // 4xx não retenta — é erro de negócio/validação
        if (error instanceof Error && 'status' in error) {
          const status = (error as { status: number }).status
          if (status >= 400 && status < 500) return false
        }
        return failureCount < 2
      },
    },
    mutations: {
      retry: 0,
    },
  },
})
