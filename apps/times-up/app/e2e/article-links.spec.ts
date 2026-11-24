import { test, expect } from '@playwright/test';

test('an article deep link opens the target and closing it removes the query', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('times-up.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
    });
    const now = Date.now();
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
                        unread: 2,
                        addedAt: now,
                    },
                ],
            }),
        }),
    );
    await page.route('**/api/library/counts', (route) => route.fulfill({ status: 200, body: '{"counts":{}}' }));
    await page.route('**/api/articles?**', (route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                items: ['a1', 'a2'].map((id, index) => ({
                    id,
                    feedId: 'feed1',
                    guid: id,
                    title: index === 0 ? 'First story' : 'Second story',
                    link: `https://example.com/${id}`,
                    summary: 'Summary',
                    published: now - index * 60_000,
                    fetchedAt: now,
                    read: 0,
                    starred: false,
                    popularity: 1,
                    hot: 2 - index,
                })),
            }),
        }),
    );
    await page.route('**/api/articles/a*/**', (route) => route.fulfill({ status: 404, body: '{}' }));

    await page.goto('/#/all?article=a2');
    const dialog = page.getByRole('dialog', { name: 'Second story' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/#\/all\?article=a2$/);
    await expect(page.locator('.row[data-article-id="a2"]')).toHaveClass(/selected/);
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/#\/all$/);
});

test('a deep link opens an article outside the loaded list window', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('times-up.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
    });
    const now = Date.now();
    const article = (id: string, title: string) => ({
        id,
        feedId: 'feed1',
        guid: id,
        title,
        link: `https://example.com/${id}`,
        summary: 'Summary',
        published: now,
        fetchedAt: now,
        read: 0,
        starred: false,
        popularity: 1,
        hot: 1,
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
                        unread: 2,
                        addedAt: now,
                    },
                ],
            }),
        }),
    );
    await page.route('**/api/library/counts', (route) => route.fulfill({ status: 200, body: '{"counts":{}}' }));
    await page.route('**/api/articles?**', (route) =>
        route.fulfill({ status: 200, body: JSON.stringify({ items: [article('a1', 'First story')] }) }),
    );
    await page.route('**/api/articles/a2', (route) =>
        route.fulfill({ status: 200, body: JSON.stringify(article('a2', 'Archived story')) }),
    );
    await page.route('**/api/articles/a2/**', (route) => route.fulfill({ status: 404, body: '{}' }));

    await page.goto('/#/all?article=a2');
    await expect(page.getByRole('dialog', { name: 'Archived story' })).toBeVisible();
    await expect(page.locator('.row[data-article-id="a2"]')).toHaveClass(/selected/);
});
