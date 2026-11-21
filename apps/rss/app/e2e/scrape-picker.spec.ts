import { test, expect } from '@playwright/test';

/** A page with no feed can be previewed and followed from Settings. */
test('the settings page previews and follows a watched page', async ({ page }) => {
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

    let previewBody = '';
    await page.route('**/api/sources/preview', (route) => {
        previewBody = route.request().postData() ?? '';
        return route.fulfill({
            status: 200,
            body: JSON.stringify({
                strategy: 'semantic-list',
                label: 'Article list',
                confidence: 0.7,
                title: 'Blog',
                candidates: [{ title: 'First story', url: 'https://example.com/one' }],
            }),
        });
    });
    let sourceBody = '';
    await page.route('**/api/sources', (route) => {
        sourceBody = route.request().postData() ?? '';
        return route.fulfill({
            status: 200,
            body: JSON.stringify({
                id: 'fd1',
                title: 'Blog',
                url: 'https://example.com/blog',
                folderIds: [],
                unread: 0,
                addedAt: 1,
                sourceKind: 'scrape',
                itemSelector: '.post',
            }),
        });
    });

    await page.goto('/#/settings');
    await page.getByRole('button', { name: 'Add from a page' }).click();
    await page.getByLabel('Page URL').fill('https://example.com/blog');
    await page.getByLabel('Article list selector').fill('.post');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByText('First story')).toBeVisible();
    expect(previewBody).toContain('.post');

    await page.getByRole('button', { name: 'Follow page' }).click();
    await expect(page.getByRole('button', { name: 'Add from a page' })).toBeVisible();
    await expect(page.getByLabel('Page URL')).toHaveCount(0);
    expect(sourceBody).toContain('https://example.com/blog');
});
