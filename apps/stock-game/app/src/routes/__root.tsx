import type { ReactNode } from 'react'
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '../lib/queryClient'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Stock Game' },
    ],
  }),
  component: RootComponent,
})

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/trade', label: 'Trade' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/orders', label: 'Orders' },
  { to: '/settings', label: 'Settings' },
] as const

function RootComponent() {
  return (
    <RootDocument>
      <QueryClientProvider client={getQueryClient()}>
        <div className="shell">
          <nav className="nav">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: 'nav-link active' }}
                className="nav-link"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <main className="content">
            <Outlet />
          </main>
        </div>
      </QueryClientProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
