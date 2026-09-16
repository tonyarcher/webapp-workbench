import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env['APP_BASE_PATH'] ?? '/',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/user-api': {
        target: 'http://localhost:3004',
        rewrite: (path) => path.replace(/^\/user-api/, ''),
      },
    },
  },
})
