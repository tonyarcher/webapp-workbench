import {createHashHistory, createRouter} from '@tanstack/react-router'
import {routeTree} from './routeTree'

export function getRouter() {
  const router = createRouter({
    routeTree,
    history: createHashHistory(),
    scrollRestoration: true,
    defaultPreload: 'intent',
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
