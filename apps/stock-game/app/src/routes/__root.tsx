import {useEffect, useState} from 'react'
import {Link, Outlet, createRootRoute} from '@tanstack/react-router'
import {QueryClientProvider} from '@tanstack/react-query'
import {getQueryClient} from '../lib/queryClient'
import {currentUsername, hasSession, logout, startLogin} from '../lib/auth'
import '../components/index'
import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

const NAV_ITEMS = [
  {to: '/', label: 'Dashboard'},
  {to: '/trade', label: 'Trade'},
  {to: '/portfolio', label: 'Portfolio'},
  {to: '/orders', label: 'Orders'},
  {to: '/settings', label: 'Settings'},
] as const

function useAuthGate() {
  const [authed, setAuthed] = useState(hasSession())
  const [username, setUsername] = useState<string | null>(currentUsername())
  const [error, setError] = useState(takeBootError)
  useEffect(() => {
    const refresh = () => {
      setAuthed(hasSession())
      setUsername(currentUsername())
    }
    const required = () => {
      setAuthed(false)
      setUsername(null)
      getQueryClient().clear()
    }
    window.addEventListener('sg-auth-required', required)
    window.addEventListener('sg-auth-changed', refresh)
    return () => {
      window.removeEventListener('sg-auth-required', required)
      window.removeEventListener('sg-auth-changed', refresh)
    }
  }, [])
  return {authed, username, error, setError, setAuthed, setUsername}
}

function takeBootError(): string {
  try {
    const message = sessionStorage.getItem('sg.auth.error')
    if (message) sessionStorage.removeItem('sg.auth.error')
    return message ?? ''
  } catch {
    return ''
  }
}

function SignInCard({error, onSignIn}: {error: string; onSignIn: () => void}) {
  return (
    <div className="card">
      <h1>Stock Game</h1>
      <p className="muted">Sign in to play with your portfolio.</p>
      <button type="button" onClick={onSignIn}>Sign in</button>
      {error ? <div className="error">{error}</div> : null}
    </div>
  )
}

function signIn(auth: ReturnType<typeof useAuthGate>) {
  auth.setError('')
  startLogin().catch((err: unknown) => {
    auth.setError(err instanceof Error ? err.message : 'Sign-in failed')
  })
}

function signOut(auth: ReturnType<typeof useAuthGate>) {
  logout()
  getQueryClient().clear()
  auth.setAuthed(false)
  auth.setUsername(null)
}

function AuthedShell({auth}: {auth: ReturnType<typeof useAuthGate>}) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <div className="shell">
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{className: 'nav-link active'}}
              className="nav-link"
            >
              {item.label}
            </Link>
          ))}
          <span className="nav-user">{auth.username ?? ''}</span>
          <button type="button" className="nav-link" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </nav>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  )
}

function RootComponent() {
  const auth = useAuthGate()
  if (!auth.authed) {
    return (
      <QueryClientProvider client={getQueryClient()}>
        <div className="shell">
          <main className="content">
            <SignInCard error={auth.error} onSignIn={() => signIn(auth)} />
          </main>
        </div>
      </QueryClientProvider>
    )
  }
  return <AuthedShell auth={auth} />
}
