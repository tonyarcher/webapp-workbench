import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5206',
        headless: true,
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run dev -- --port 5206 --strictPort',
        url: 'http://localhost:5206',
        reuseExistingServer: false,
        timeout: 60000,
    },
});
