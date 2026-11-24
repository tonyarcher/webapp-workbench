import { test, expect } from '@playwright/test';

/**
 * Reading controls live on the list toolbar where their effect is visible.
 * Applying the current view as the global default is one of them.
 */
test('the list toolbar applies its own reading settings to all views', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('rss.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
        localStorage.setItem(
            'rss-reader:view-settings',
            JSON.stringify({ all: { listView: 'detailed', sort: 'oldest', pageSize: 10, maxCardCols: 4 } }),
        );
    });
    await page.route('**/api/library/folders', (route) =>
        route.fulfill({ status: 200, body: '{"folders":[],"savedSearches":[]}' }),
    );
    await page.route('**/api/library/feeds', (route) => route.fulfill({ status: 200, body: '{"feeds":[]}' }));
    await page.route('**/api/library/counts', (route) => route.fulfill({ status: 200, body: '{"counts":{}}' }));
    await page.route('**/api/articles?**', (route) => route.fulfill({ status: 200, body: '{"items":[]}' }));

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Advanced' })).toBeVisible();
    await page.getByRole('button', { name: 'Advanced' }).click();
    await page.getByRole('button', { name: 'Apply this view to all views' }).click();

    const stored = await page.evaluate(() => ({
        defaults: JSON.parse(localStorage.getItem('rss-reader:default-view-settings') ?? 'null') as {
            listView: string;
            sort: string;
            pageSize: number;
        } | null,
        perView: localStorage.getItem('rss-reader:view-settings'),
    }));
    expect(stored.defaults).not.toBeNull();
    expect(stored.defaults!.listView).toBe('detailed');
    expect(stored.defaults!.sort).toBe('oldest');
    expect(stored.defaults!.pageSize).toBe(10);
    expect(stored.perView).toBeNull();
});

test('find in article counts matches and Escape closes only find', async ({ page }) => {
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
                        id: 'feed1',
                        title: 'Feed One',
                        url: 'https://example.com/feed',
                        folderIds: [],
                        unread: 1,
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
                        feedId: 'feed1',
                        guid: 'g1',
                        title: 'Find story',
                        link: 'https://example.com/story',
                        summary: 'Signal one. Signal two.',
                        published: now,
                        fetchedAt: now,
                        read: 0,
                        starred: false,
                        popularity: 1,
                        hot: 1,
                    },
                ],
            }),
        }),
    );
    await page.route('**/api/articles/a1/**', (route) => route.fulfill({ status: 404, body: '{}' }));

    await page.goto('/#/all');
    await page.getByRole('button', { name: 'Find story', exact: true }).click();
    await page.keyboard.press('Control+f');
    const input = page.getByRole('searchbox', { name: 'Find in article' });
    await expect(input).toBeVisible();
    await input.fill('signal');
    await expect(page.getByRole('status').filter({ hasText: '1/2' })).toBeVisible();
    await input.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: '2/2' })).toBeVisible();
    await input.press('Escape');
    await expect(input).toBeHidden();
    await expect(page.getByRole('button', { name: 'Find in article', exact: true })).toBeFocused();
    await page.keyboard.press('Control+f');
    await expect(input).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Find story' })).toBeVisible();
});
