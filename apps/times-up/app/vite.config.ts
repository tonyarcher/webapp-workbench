import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string;
};

function gitCommit(): string {
    try {
        return execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
        return 'unknown';
    }
}

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(version),
        __APP_COMMIT__: JSON.stringify(gitCommit()),
        __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
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
            '/user-api': {
                target: 'http://localhost:3004',
                rewrite: (path) => path.replace(/^\/user-api/, ''),
            },
        },
    },
});
