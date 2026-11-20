import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * The square-with-chevron buttons on sidebar rows are context menus. They
 * must open as anchored popouts in the top layer, not as more rows in the
 * left list, and must close again when dismissed.
 */
const popover = (page: Page, tag: string) =>
    page.locator(`source-list ${tag}`).evaluate((el) => {
        const node = el.shadowRoot?.querySelector<HTMLElement>('.menu');
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { open: node.matches(':popover-open'), x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });

async function anchorCheck(page: Page, tag: string, trigger: Locator) {
    const button = await trigger.boundingBox();
    const menu = await popover(page, tag);
    expect(menu?.open, `${tag} open`).toBe(true);
    expect(menu!.x, `${tag} x vs button`).toBeGreaterThanOrEqual(button!.x - 8);
    expect(menu!.y).toBeGreaterThanOrEqual(button!.y);
    expect(menu!.y).toBeLessThan(button!.y + 80);
}

test('sidebar context menus open as anchored popouts', async ({ page }) => {
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
            body: JSON.stringify({
                folders: [{ id: 'f1', title: 'Tech', sortOrder: 0, createdAt: now }],
                savedSearches: [
                    { id: 'ss1', title: 'Saved search', query: 'rust', scopeKind: 'all', createdAt: now, unread: 0 },
                ],
            }),
        }),
    );
    await page.route('**/api/library/feeds', (route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                feeds: [
                    {
                        id: 'fd1',
                        title: 'Feed One',
                        url: 'https://example.com/one',
                        folderIds: ['f1'],
                        unread: 1,
                        addedAt: now,
                    },
                ],
            }),
        }),
    );
    await page.route('**/api/library/counts', (route) => route.fulfill({ status: 200, body: '{"counts":{}}' }));
    await page.route('**/api/articles?**', (route) => route.fulfill({ status: 200, body: '{"items":[]}' }));

    await page.goto('/');

    const folder = page.locator('.item[data-folder-id="f1"] .menu-btn');
    await folder.click();
    await anchorCheck(page, 'folder-menu', folder);

    // Opening another menu closes the first one.
    const feed = page.locator('.feed-row[data-feed-id="fd1"] .menu-btn');
    await feed.click();
    await anchorCheck(page, 'feed-menu', feed);
    expect((await popover(page, 'folder-menu'))?.open).toBe(false);

    const today = page.getByRole('button', { name: 'Today options' });
    await today.click();
    await anchorCheck(page, 'today-menu', today);

    const feedList = page.getByRole('button', { name: 'Feed list options' });
    await feedList.click();
    await anchorCheck(page, 'feed-list-menu', feedList);

    const saved = page.locator('.item[data-saved-search-id="ss1"] .menu-btn');
    await saved.click();
    await anchorCheck(page, 'saved-search-menu', saved);

    // Escape dismisses the popout and the trigger can open it again.
    await page.keyboard.press('Escape');
    expect((await popover(page, 'saved-search-menu'))?.open).toBe(false);
    await saved.click();
    await anchorCheck(page, 'saved-search-menu', saved);
});
