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
                            {
                                title: 'First story',
                                url: 'https://example.com/one',
                                elementSelector: 'article:nth-child(1)',
                            },
                            {
                                title: 'Second story',
                                url: 'https://example.com/two',
                                elementSelector: 'article:nth-child(2)',
                            },
                        ],
                    },
                    {
                        id: 'json-ld-list',
                        label: 'Structured list',
                        confidence: 0.8,
                        selector: 'strategy:json-ld-list',
                        candidates: [{ title: 'Second story', url: 'https://example.com/two' }],
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

    const frame = page.frameLocator('scrape-preview iframe');
    await expect(frame.locator('.rss-scrape-box')).toHaveCount(2);
    await expect(frame.getByRole('button', { name: /Selected: Second story/ })).toBeVisible();

    // Clicking a highlight box toggles the matching checkbox.
    await frame.getByRole('button', { name: /Selected: Second story/ }).click();
    await expect(page.getByRole('checkbox', { name: 'Second story' })).not.toBeChecked();
    await page.getByRole('checkbox', { name: 'Second story' }).check();

    // Switching list type redraws the boxes and the story list.
    await page.getByRole('button', { name: /Structured list/ }).click();
    await expect(frame.locator('.rss-scrape-box')).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Second story' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'First story' })).toHaveCount(0);
    await page.getByRole('button', { name: /Article list/ }).click();
    await expect(frame.locator('.rss-scrape-box')).toHaveCount(2);

    await page.getByRole('checkbox', { name: 'Second story' }).uncheck();
    await page.getByRole('button', { name: 'Follow page' }).click();
    await expect(page.getByRole('button', { name: 'Add from a page' })).toBeVisible();
    await expect(page.getByLabel('Page URL')).toHaveCount(0);
    expect(sourceBody).toContain('https://example.com/blog');
    expect(sourceBody).toContain('"urls":["https://example.com/one"]');
});
