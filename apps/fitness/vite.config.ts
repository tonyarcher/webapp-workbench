import {defineConfig} from 'vite';

export default defineConfig({
    base: './',
    build: {
        target: 'es2022',
        sourcemap: true,
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3003',
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
});
