import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {RouterProvider} from '@tanstack/react-router'
import {getRouter} from './router'
import {finishLoginFromCallback} from './lib/auth'
import './components/index'
import './styles.css'

const router = getRouter()

async function boot(): Promise<void> {
  const loggedIn = await finishLoginFromCallback().catch((err: unknown) => {
    try {
      sessionStorage.setItem('sg.auth.error', err instanceof Error ? err.message : 'Sign-in failed')
    } catch {
      // ignore storage failures; the sign-in card still renders
    }
    return false
  })
  if (loggedIn) window.dispatchEvent(new CustomEvent('sg-auth-changed'))
  const root = document.getElementById('root')
  if (!root) throw new Error('Missing #root element')
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

void boot()
