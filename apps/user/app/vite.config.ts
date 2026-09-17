import {defineConfig} from 'vite';

export default defineConfig({
    base: './',
    build: {
        target: 'es2022',
        sourcemap: true,
    },
    server: {
        proxy: {
            '/user-api': {
                target: 'http://localhost:3004',
                rewrite: (path) => path.replace(/^\/user-api/, ''),
            },
        },
    },
});
