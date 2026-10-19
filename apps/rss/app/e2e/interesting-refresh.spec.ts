import { test, expect } from '@playwright/test';

/**
 * Switching the folder filter to ✨ Interesting while a folder refresh is in
 * flight must not loop. The interesting filter fetches one bounded newest
 * batch and replaces the list; a refresh finishes by resetting the list. If
 * the two resets feed each other the tab never yields.
 */
test('the interesting filter settles while a refresh finishes', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('rss.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
        localStorage.setItem('rss-reader:interesting-shadow', JSON.stringify({ f1: true }));
        localStorage.setItem('rss-reader:word-map', JSON.stringify({ rust: 4 }));
    });

    const now = Date.now();
    const articles = Array.from({ length: 60 }, (_, i) => ({
        id: `a${i}`,
        feedId: 'feed1',
        guid: `g${i}`,
        title: i % 7 === 0 ? `Rust Story ${i}` : `Zebra Story ${i}`,
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
                        unread: 60,
                        addedAt: now,
                        lastFetchedAt: now,
                    },
                ],
            }),
        }),
    );
    await page.route('**/api/library/counts', (route) =>
        route.fulfill({ status: 200, body: JSON.stringify({ counts: { feed1: 60 } }) }),
    );
    // Only the ✨ filter asks for `sort=newest` (its one bounded batch); the
    // folder's own page loads use `sort=hot`, so this counts filter batches.
    let interestingRequests = 0;
    await page.route('**/api/articles?**', (route) => {
        if (route.request().url().includes('sort=newest')) interestingRequests += 1;
        return route.fulfill({ status: 200, body: JSON.stringify({ items: articles }) });
    });

    let releaseSync!: () => void;
    const syncGate = new Promise<void>((resolve) => {
        releaseSync = resolve;
    });
    await page.route('**/api/sync', async (route) => {
        await syncGate;
        await route.fulfill({ status: 200, body: JSON.stringify({ queued: 1 }) });
    });

    await page.goto('/#/folder/f1');
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
    await expect(page.getByText('Zebra Story 1', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByRole('button', { name: 'Refreshing…' })).toBeVisible();

    const before = interestingRequests;
    await page.getByRole('button', { name: '✨ Interesting' }).click();

    releaseSync();

    // Ranking, not source order: the stubbed hot order puts Zebra Story 1
    // second, while the learned word map (`rust: 4`) puts Rust titles first.
    // Asserting row 0 would not discriminate, because Rust Story 0 is also
    // first in the unfiltered list.
    const rows = page.locator('.row');
    await expect(rows.nth(1)).toContainText('Rust Story');

    // A settle is the toggle's batch plus the refresh's trailing reset: two,
    // never a stream. The lower bound fails if the filter silently stops
    // fetching; before the fix the tab never yielded, so the liveness probe
    // below is the real freeze detector.
    await page.waitForTimeout(1000);
    const batches = interestingRequests - before;
    expect(batches).toBeGreaterThanOrEqual(1);
    expect(batches).toBeLessThan(4);

    // The tab must still answer: a blocked main thread never runs this.
    const alive = await page.evaluate(() => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 50)));
    expect(alive).toBe(true);
});
