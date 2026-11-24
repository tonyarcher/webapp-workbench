import { test, expect } from '@playwright/test';

test('more like this ranks local related stories and opens one', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('rss.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
    });
    const now = Date.now();
    await page.route('**/api/library/folders', (route) => route.fulfill({ status: 200, body: '{"folders":[]}' }));
    await page.route('**/api/library/feeds', (route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                feeds: [
                    {
                        id: 'f1',
                        title: 'Energy',
                        url: 'https://energy.example/feed',
                        folderIds: [],
                        unread: 2,
                        addedAt: now,
                    },
                    {
                        id: 'f2',
                        title: 'Policy',
                        url: 'https://policy.example/feed',
                        folderIds: [],
                        unread: 0,
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
                items: [
                    {
                        id: 'a1',
                        feedId: 'f1',
                        guid: 'g1',
                        title: 'Battery grid storage',
                        link: 'https://energy.example/battery',
                        summary: 'Grid batteries',
                        content: `<p>${'Long article text '.repeat(2_000)}</p>`,
                        published: now,
                        fetchedAt: now,
                        read: 0,
                        starred: false,
                        popularity: 1,
                        hot: 2,
                    },
                    {
                        id: 'a2',
                        feedId: 'f2',
                        guid: 'g2',
                        title: 'Battery grid policy',
                        link: 'https://policy.example/battery',
                        summary: 'Storage policy',
                        published: now - 1_000,
                        fetchedAt: now,
                        read: 0,
                        starred: false,
                        popularity: 1,
                        hot: 1,
                    },
                    {
                        id: 'a3',
                        feedId: 'f2',
                        guid: 'g3',
                        title: 'Gardening notes',
                        link: 'https://policy.example/garden',
                        summary: 'Plants',
                        published: now - 2_000,
                        fetchedAt: now,
                        read: 0,
                        starred: false,
                        popularity: 1,
                        hot: 0,
                    },
                ],
            }),
        }),
    );
    await page.route('**/api/articles/a*/**', (route) => route.fulfill({ status: 404, body: '{}' }));

    await page.goto('/#/all');
    await page.getByRole('button', { name: 'Battery grid storage', exact: true }).click();
    await page.locator('article-view').evaluate((node) => {
        node.scrollTop = 600;
    });
    const scrollBefore = await page.locator('article-view').evaluate((node) => node.scrollTop);
    expect(scrollBefore).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('button', { name: 'More like this' }).click();
    const related = page.getByRole('dialog', { name: 'More like this' });
    await expect(related).toBeVisible();
    expect(await page.locator('article-view').evaluate((node) => node.scrollTop)).toBe(scrollBefore);
    await expect(related.getByRole('button', { name: /Battery grid policy/ })).toBeVisible();
    await expect(related.getByText(/Gardening notes/)).toHaveCount(0);
    await related.getByRole('button', { name: 'Close related stories' }).click();
    await expect(related).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Battery grid storage' })).toBeVisible();
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('button', { name: 'More like this' }).click();
    await expect(related.getByRole('button', { name: /Battery grid policy/ })).toBeVisible();
    await related.getByRole('button', { name: /Battery grid policy/ }).click();
    await expect(page.getByRole('dialog', { name: 'Battery grid policy' })).toBeVisible();
});
