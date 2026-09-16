import { createHashHistory } from '@tanstack/history'
import type { RouterHistory } from '@tanstack/history'

export type View =
  | { kind: 'dashboard' }
  | { kind: 'trade'; symbol?: string | undefined }
  | { kind: 'portfolio' }
  | { kind: 'orders' }
  | { kind: 'settings' }

export const history: RouterHistory = createHashHistory()

function parseTradeSearch(search: string): string | undefined {
  const params = new URLSearchParams(search)
  const symbol = params.get('symbol')?.trim()
  return symbol ? symbol : undefined
}

export function parsePath(pathname: string, search: string): View {
  const parts = pathname.split('/').filter(Boolean)
  const head = parts[0]
  if (!head) return { kind: 'dashboard' }
  if (head === 'trade') {
    const symbol = parseTradeSearch(search)
    return symbol === undefined ? { kind: 'trade' } : { kind: 'trade', symbol }
  }
  if (head === 'portfolio') return { kind: 'portfolio' }
  if (head === 'orders') return { kind: 'orders' }
  if (head === 'settings') return { kind: 'settings' }
  return { kind: 'dashboard' }
}

export function viewToPath(view: View): string {
  switch (view.kind) {
    case 'dashboard':
      return '/'
    case 'trade':
      return view.symbol ? `/trade?symbol=${encodeURIComponent(view.symbol)}` : '/trade'
    case 'portfolio':
      return '/portfolio'
    case 'orders':
      return '/orders'
    case 'settings':
      return '/settings'
  }
}

export function navigate(view: View): void {
  history.push(viewToPath(view))
}
