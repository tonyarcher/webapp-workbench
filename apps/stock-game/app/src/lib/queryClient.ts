import { QueryClient } from '@tanstack/react-query'

const isServer = typeof window === 'undefined'

let browserQueryClient: QueryClient | undefined

export function getQueryClient(): QueryClient {
  if (isServer) {
    return new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
    })
  }
  if (browserQueryClient === undefined) {
    browserQueryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
    })
  }
  return browserQueryClient
}
