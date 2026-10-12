import { test, expect } from '@playwright/test';

/**
 * Bulk mark-as-read over a large library takes tens of seconds server-side.
 * While one is in flight the menu must refuse a second (overlapping bulk
 * writes pile transactions onto the database until one dies) and say so: an
 * info toast plus disabled options. Auth is seeded and every read is stubbed
 * so the only live wire is the gated mark call; the gate holds it open, so
 * the in-flight window lasts as long as the assertions need — no races.
 */
test('a second mark waits while one is in flight', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp })}.sig`;
        localStorage.setItem('rss.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
    });
    await page.route('**/api/library/folders', (route) => route.fulfill({ status: 200, body: '{"folders":[]}' }));
    await page.route('**/api/library/feeds', (route) => route.fulfill({ status: 200, body: '{"feeds":[]}' }));
    await page.route('**/api/library/counts', (route) => route.fulfill({ status: 200, body: '{"counts":{}}' }));
    await page.route('**/api/articles', (route) => route.fulfill({ status: 200, body: '{"items":[]}' }));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route('**/api/articles/read-before', async (route) => {
        await gate;
        await route.fulfill({ status: 200, body: '{}' });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Advanced' }).click();
    await page.getByRole('button', { name: 'Older than 3 days' }).click();
    await expect(page.getByRole('button', { name: 'Marking articles as read' })).toBeVisible();
    await page.getByRole('button', { name: 'Advanced' }).click();
    const options = page.locator('advanced-menu .mark-opt');
    await expect(options.first()).toBeDisabled();
    release();
    await expect(options.first()).toBeEnabled();
});
