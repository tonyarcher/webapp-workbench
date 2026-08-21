import {defineConfig} from 'vite';

export default defineConfig({
    base: process.env.APP_BASE_PATH ?? '/',
    build: {
        target: 'es2022',
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
});
