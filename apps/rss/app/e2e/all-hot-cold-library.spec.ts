import { test, expect } from '@playwright/test';

/**
 * `fetchLibrary()` paints in stages: folders, then feeds, then unread counts.
 * The All / Hot view loads through the feed set, so the folder stage paints an
 * empty feed list. This guards that the feeds stage (and every later stage)
 * reloads the view instead of leaving the first page empty for the session.
 */
test('the all/hot view paints after the staged library arrives', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('rss.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
    });

    const now = Date.now();
    await page.route('**/api/library/folders', (route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({ folders: [{ id: 'f1', title: 'Folder', sortOrder: 0 }] }),
        }),
    );
    await page.route('**/api/library/feeds', (route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                feeds: [
                    {
                        id: 'feed1',
                        title: 'Feed One',
                        url: 'https://example.com/feed',
                        siteUrl: 'https://example.com',
                        folderIds: ['f1'],
                        unread: 2,
                        addedAt: now,
                        lastFetchedAt: now,
                    },
                ],
            }),
        }),
    );
    await page.route('**/api/library/counts', (route) =>
        route.fulfill({ status: 200, body: JSON.stringify({ counts: { feed1: 2 } }) }),
    );
    await page.route('**/api/articles?**', (route) => {
        const items = Array.from({ length: 2 }, (_, i) => ({
            id: `a${i}`,
            feedId: 'feed1',
            guid: `g${i}`,
            title: `Zebra Story ${i}`,
            link: `https://example.com/${i}`,
            summary: 'body',
            published: now - i * 60_000,
            fetchedAt: now,
            hot: 100 - i,
            popularity: 1,
            engagement: 1,
            read: 0,
            starred: false,
        }));
        return route.fulfill({ status: 200, body: JSON.stringify({ items }) });
    });

    await page.goto('/#/');
    await expect(page.getByText('Zebra Story 0', { exact: true })).toBeVisible();
});
