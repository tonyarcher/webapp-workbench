import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5203',
        headless: true,
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run dev -- --port 5203 --strictPort',
        url: 'http://localhost:5203',
        reuseExistingServer: false,
        timeout: 60000,
    },
});
