import { test, expect } from '@playwright/test';

/** A page with no feed can be previewed and followed from Organize. */
test('Organize previews and follows a watched page', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('times-up.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
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
                html: '<article>First story</article><article>Second story</article>',
                baseUrl: 'https://example.com/blog',
                title: 'Blog',
                strategies: [
                    {
                        id: 'semantic-list',
                        label: 'Article list',
                        confidence: 0.7,
                        selector: 'strategy:semantic-list',
                        candidates: [
                            { title: 'First story', url: 'https://example.com/one' },
                            { title: 'Second story', url: 'https://example.com/two' },
                        ],
                    },
                ],
            }),
        });
    });
    let sourceBody = '';
    await page.route('**/api/sources', (route) => {
        sourceBody = route.request().postData() ?? '';
        return route.fulfill({
            status: 200,
            body: JSON.stringify({
                id: 'src1',
                title: 'Blog',
                url: 'https://example.com/blog',
                folderIds: [],
                unread: 0,
                addedAt: 1,
            }),
        });
    });
    await page.route('**/api/sync', (route) => route.fulfill({ status: 200, body: '{"queued":1}' }));

    await page.goto('/#/settings/organize');
    await page.getByLabel('Page URL').fill('https://example.com/blog');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByText('1 strategies found.')).toBeVisible();
    expect(previewBody).toContain('https://example.com/blog');

    await page.getByRole('button', { name: 'Follow page' }).click();
    expect(sourceBody).toContain('https://example.com/blog');
});
