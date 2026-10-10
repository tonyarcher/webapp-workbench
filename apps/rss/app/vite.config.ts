import { defineConfig } from 'vite';

export default defineConfig({
    base: process.env.APP_BASE_PATH ?? '/',
    build: {
        target: 'es2022',
        // Emit dist/.vite/manifest.json so the deploy task can resolve the
        // hashed module entry (SHELL_ENTRY) for the JVM-rendered shell.
        manifest: true,
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
            '/user-api': {
                target: 'http://localhost:3004',
                rewrite: (path) => path.replace(/^\/user-api/, ''),
            },
        },
    },
});
