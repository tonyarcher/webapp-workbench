import {defineConfig} from 'vite';

export default defineConfig({
    base: './',
    build: {
        target: 'es2022',
        sourcemap: true,
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
