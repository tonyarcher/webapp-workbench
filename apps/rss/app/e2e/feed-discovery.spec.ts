import { test, expect } from '@playwright/test';

/** Paste a site address, detect its feeds, preview recent items, subscribe. */
test('settings finds feeds on a site and subscribes to one', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('rss.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
    });
    await page.route('**/api/library/folders', (route) =>
        route.fulfill({ status: 200, body: '{"folders":[],"savedSearches":[]}' }),
    );
    await page.route('**/api/library/feeds', (route) => route.fulfill({ status: 200, body: '{"feeds":[]}' }));
    await page.route('**/api/library/counts', (route) => route.fulfill({ status: 200, body: '{"counts":{}}' }));
    await page.route('**/api/articles?**', (route) => route.fulfill({ status: 200, body: '{"items":[]}' }));

    await page.route('**/api/sources/discover', (route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                baseUrl: 'https://example.com/',
                siteTitle: 'Example',
                feeds: [
                    {
                        url: 'https://example.com/feed.xml',
                        title: 'Main feed',
                        type: 'rss',
                        source: 'advertised',
                        confidence: 0.9,
                        recentTitles: ['Newest story', 'Older story'],
                        lastPublished: 1_795_046_400_000,
                    },
                ],
            }),
        }),
    );
    let subscribed = '';
    await page.route('**/api/feeds', (route) => {
        subscribed = route.request().postData() ?? '';
        return route.fulfill({
            status: 200,
            body: JSON.stringify({
                id: 'fd1',
                title: 'Main feed',
                url: 'https://example.com/feed.xml',
                folderIds: [],
                unread: 0,
                addedAt: 1,
            }),
        });
    });

    await page.goto('/#/settings');
    await page.getByRole('button', { name: 'Find feeds on a site' }).click();
    await page.getByLabel('Site address').fill('https://example.com/');
    await page.getByRole('button', { name: 'Find feeds', exact: true }).click();

    await expect(page.getByText('1 feeds found on Example.')).toBeVisible();
    await expect(page.getByText('Newest story')).toBeVisible();
    await expect(page.getByText('rss | advertised')).toBeVisible();

    await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
    expect(subscribed).toContain('https://example.com/feed.xml');
    await expect(page.getByLabel('Site address')).toHaveCount(0);
});
