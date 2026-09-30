import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5200',
        headless: true,
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run dev -- --port 5200 --strictPort',
        url: 'http://localhost:5200',
        reuseExistingServer: false,
        timeout: 60000,
    },
});
