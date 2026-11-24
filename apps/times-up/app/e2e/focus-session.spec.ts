import { test, expect, type Page } from '@playwright/test';

const now = Date.now();
const article = (id: string, title: string) => ({
    id,
    feedId: 'feed1',
    guid: id,
    title,
    link: `https://example.com/${id}`,
    summary: `${title} summary`,
    published: now,
    fetchedAt: now,
    read: 0,
    starred: false,
    popularity: 1,
    hot: 1,
});
const articles = [article('a1', 'First story'), article('a2', 'Saved story'), article('a3', 'Third story')];

async function seedReader(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('times-up.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
    });
    await page.route('**/api/library/folders', (route) => route.fulfill({ status: 200, body: '{"folders":[]}' }));
    await page.route('**/api/library/feeds', (route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                feeds: [
                    {
                        id: 'feed1',
                        title: 'Feed One',
                        url: 'https://example.com/feed',
                        folderIds: [],
                        unread: 3,
                        addedAt: now,
                    },
                ],
            }),
        }),
    );
    await page.route('**/api/library/counts', (route) => route.fulfill({ status: 200, body: '{"counts":{}}' }));
    await page.route('**/api/articles?**', (route) =>
        route.fulfill({ status: 200, body: JSON.stringify({ items: articles }) }),
    );
    await page.route('**/api/saved-articles', (route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                items: [
                    {
                        id: 'saved-a2',
                        articleId: 'a2',
                        title: 'Saved story',
                        link: 'https://example.com/a2',
                        savedAt: now,
                    },
                ],
            }),
        }),
    );
    await page.route('**/api/articles/a*/**', (route) => route.fulfill({ status: 404, body: '{}' }));
}

test('a focus session puts saved articles first and has a done screen', async ({ page }) => {
    await seedReader(page);
    await page.goto('/#/focus');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const queue = page.locator('.queue');
    await expect(queue.locator('.q-title').first()).toHaveText('Saved story');
    await queue.locator('.q-title').first().click();
    const dialog = page.getByRole('dialog', { name: 'Saved story' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(queue.locator('.q-item').first()).toHaveClass(/done/);
    await page.getByRole('button', { name: 'Finish', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
    await page.getByRole('button', { name: 'Keep remaining unread' }).click();
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
});

test('finishing every queued article records one kept session', async ({ page }) => {
    await seedReader(page);
    await page.goto('/#/focus');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const queue = page.locator('.queue');
    await expect(queue.locator('.q-title')).toHaveCount(3);
    for (let index = 0; index < 3; index++) {
        await queue.locator('.q-title').nth(index).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    }
    await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
    const streak = await page.evaluate(
        () => JSON.parse(localStorage.getItem('times-up:focus-streak') ?? '{}') as { kept?: number },
    );
    expect(streak.kept).toBe(1);
});

test('alerts open a ready focus session seeded with their hits', async ({ page }) => {
    await seedReader(page);
    await page.route('**/api/alerts', (route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                alerts: [{ id: 'alert1', title: 'Batteries', query: 'battery', hits: [articles[2]] }],
            }),
        }),
    );
    await page.goto('/#/alerts');
    await page.getByRole('button', { name: 'Focus these' }).click();
    await expect(page).toHaveURL(/#\/focus$/);
    await expect(page.locator('.queue .q-title').first()).toHaveText('Saved story');
    await expect(page.locator('.queue .q-title').filter({ hasText: 'Third story' })).toBeVisible();
});
