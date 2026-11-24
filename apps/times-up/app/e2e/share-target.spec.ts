import { test, expect } from '@playwright/test';

async function seedReader(page: import('@playwright/test').Page): Promise<void> {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('times-up.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
    });
    await page.route('**/api/library/folders', (route) => route.fulfill({ status: 200, body: '{"folders":[]}' }));
    await page.route('**/api/library/feeds', (route) => route.fulfill({ status: 200, body: '{"feeds":[]}' }));
    await page.route('**/api/library/counts', (route) => route.fulfill({ status: 200, body: '{"counts":{}}' }));
    await page.route('**/api/saved-articles', (route) => route.fulfill({ status: 200, body: '{"items":[]}' }));
}

test('a shared link can be saved locally and removed', async ({ page }) => {
    await seedReader(page);
    await page.goto('/?url=https%3A%2F%2Fexample.com%2Fstory&title=Shared%20story');
    await expect(page.getByRole('heading', { name: 'Shared link' })).toBeVisible();
    await page.getByRole('button', { name: 'Save for later' }).click();
    await expect(page).toHaveURL(/#\/saved$/);
    await expect(page.getByRole('button', { name: /Shared story/ })).toBeVisible();
    await page.getByRole('button', { name: /Shared story/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Shared story' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Star', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Find in article', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('No saved articles yet.', { exact: false })).toBeVisible();
});

test('a direct shared route rejects an unsafe URL', async ({ page }) => {
    await seedReader(page);
    await page.goto('/#/shared?url=javascript%3Aalert(1)');
    await expect(page.getByText('No valid web link was shared.')).toBeVisible();
    await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
});

test('a shared link opens the add-feed form with its URL', async ({ page }) => {
    await seedReader(page);
    await page.goto('/?url=https%3A%2F%2Fexample.com%2Ffeed&title=Shared%20feed');
    await page.getByRole('button', { name: 'Subscribe to feed', exact: true }).click();
    await expect(page).toHaveURL(/#\/settings\/organize$/);
    await expect(page.getByRole('textbox', { name: 'Feed URL' })).toHaveValue('https://example.com/feed');
});
