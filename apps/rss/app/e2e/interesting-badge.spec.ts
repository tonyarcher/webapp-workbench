import { test, expect } from '@playwright/test';

/**
 * Interesting is a subset of All: its badge must never be larger than the
 * unread total beside All, even when the ranking batch contains read rows.
 */
test('the Interesting badge never exceeds the All unread badge', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('rss.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
        localStorage.setItem('rss-reader:interesting-shadow', JSON.stringify({ f1: true }));
        localStorage.setItem('rss-reader:word-map', JSON.stringify({ rust: 8 }));
        localStorage.removeItem('rss-reader:interesting-counts');
    });

    const now = Date.now();
    await page.route('**/api/library/folders', (route) =>
        route.fulfill({
            status: 200,
            body: '{"folders":[{"id":"f1","title":"Tech","sortOrder":0}],"savedSearches":[]}',
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
                        folderIds: ['f1'],
                        unread: 3,
                        addedAt: now,
                    },
                ],
            }),
        }),
    );
    await page.route('**/api/library/counts', (route) =>
        route.fulfill({ status: 200, body: '{"counts":{"feed1":3}}' }),
    );
    // Ten matching stories, but only three unread. The count refresh fetches
    // the whole batch for ranking; the badge must still count three.
    const articles = Array.from({ length: 10 }, (_, i) => ({
        id: `a${i}`,
        feedId: 'feed1',
        guid: `g${i}`,
        title: `Rust Story ${i}`,
        link: `https://example.com/${i}`,
        summary: 'body',
        published: now - i * 60_000,
        fetchedAt: now,
        hot: 10 - i,
        popularity: 1,
        engagement: 1,
        read: i < 3 ? 0 : 1,
        starred: false,
    }));
    await page.route('**/api/articles?**', (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.get('q') === 'is:starred') {
            return route.fulfill({ status: 200, body: '{"items":[]}' });
        }
        return route.fulfill({ status: 200, body: JSON.stringify({ items: articles }) });
    });

    await page.goto('/');
    const allBadge = page.locator('source-list .item.active .badge').first();
    await expect(allBadge).toHaveText('3');
    const interestingBadge = page.locator('source-list .item[data-interesting-id="f1"] .badge');
    await expect(interestingBadge).toBeVisible({ timeout: 8000 });
    const interesting = Number(await interestingBadge.textContent());
    expect(interesting).toBeGreaterThan(0);
    expect(interesting).toBeLessThanOrEqual(3);
});
