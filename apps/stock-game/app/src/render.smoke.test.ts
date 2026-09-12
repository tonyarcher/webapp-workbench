// @vitest-environment jsdom
import { StrictMode, act, createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'

describe('app render smoke', () => {
  it('renders the shell without throwing', async () => {
    const router = getRouter()
    await router.load()
    const host = document.createElement('div')
    host.id = 'root'
    document.body.appendChild(host)
    let error: unknown = null
    await act(async () => {
      try {
        createRoot(host).render(
          createElement(StrictMode, null, createElement(RouterProvider, {router})),
        )
      } catch (err) {
        error = err
      }
    })
    expect(error).toBeNull()
    expect(host.innerHTML).toContain('Stock Game')
    document.body.removeChild(host)
  })
})
