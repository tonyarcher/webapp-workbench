import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        target: 'es2022',
        // No sourcemaps in the published bundle: nothing consumes them, and
        // `true` embeds full source in the object store.
        sourcemap: false,
    },
    server: {
        proxy: {
            '/api/trakt': {
                target: 'https://api.trakt.tv',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/trakt/, ''),
            },
        },
    },
});
