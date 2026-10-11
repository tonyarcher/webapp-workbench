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
            '/api': {
                target: 'http://localhost:3002',
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
});
