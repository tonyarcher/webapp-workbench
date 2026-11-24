import { test, expect, type Page } from '@playwright/test';

/** Narrow screens must keep popouts inside the viewport and give the reader
 *  the full width instead of a fixed sidebar. */
async function seed(page: Page, folders: unknown[], feeds: unknown[]) {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('times-up.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
    });
    await page.route('**/api/library/folders', (route) =>
        route.fulfill({ status: 200, body: JSON.stringify({ folders, savedSearches: [] }) }),
    );
    await page.route('**/api/library/feeds', (route) =>
        route.fulfill({ status: 200, body: JSON.stringify({ feeds }) }),
    );
    await page.route('**/api/library/counts', (route) => route.fulfill({ status: 200, body: '{"counts":{}}' }));
    await page.route('**/api/articles?**', (route) => route.fulfill({ status: 200, body: '{"items":[]}' }));
}

test('folder popover stays inside a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    const folders = Array.from({ length: 12 }, (_, i) => ({
        id: `f${i}`,
        title: `Folder ${i}`,
        sortOrder: i,
        createdAt: i,
    }));
    const feeds = [
        { id: 'fd1', title: 'Feed One', url: 'https://example.com/1', folderIds: ['f0'], unread: 1, addedAt: 1 },
    ];
    await seed(page, folders, feeds);
    await page.goto('/#/settings/organize');

    await page.getByRole('button', { name: 'Folders for Feed One' }).first().click();
    const box = await page.locator('organize-view').evaluate((el) => {
        const node = el.shadowRoot?.querySelector<HTMLElement>('.folders-popover');
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return { open: node.matches(':popover-open'), x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    });
    expect(box?.open).toBe(true);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.right).toBeLessThanOrEqual(390);
    expect(box!.bottom).toBeLessThanOrEqual(600);
});

test('narrow layout gives the reader the full width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const oneFeed = [
        { id: 'fd1', title: 'Feed One', url: 'https://example.com/1', folderIds: [], unread: 1, addedAt: 1 },
    ];
    await seed(page, [], oneFeed);
    await page.goto('/');
    await page.locator('source-list').waitFor();
    const widths = await page.locator('app-shell').evaluate((shell) => {
        const root = shell.shadowRoot!;
        const sidebar = root.querySelector('source-list')!.getBoundingClientRect();
        const main = root.querySelector('.layout main')!.getBoundingClientRect();
        return { sidebar: sidebar.width, main: main.width, viewport: window.innerWidth };
    });
    expect(widths.sidebar).toBeLessThanOrEqual(20);
    expect(widths.main).toBeGreaterThan(widths.viewport - 24);

    // The sidebar expands as an overlay when hovered, without pushing main.
    await page.locator('source-list').hover();
    await page.waitForTimeout(250);
    const hovered = await page.locator('app-shell').evaluate((shell) => {
        const root = shell.shadowRoot!;
        return {
            sidebar: root.querySelector('source-list')!.getBoundingClientRect().width,
            main: root.querySelector('.layout main')!.getBoundingClientRect().width,
        };
    });
    expect(hovered.sidebar).toBeGreaterThan(100);
    expect(hovered.main).toBeGreaterThan(widths.viewport - 24);
});
