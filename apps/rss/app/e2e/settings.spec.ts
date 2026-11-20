import { test, expect } from '@playwright/test';

/**
 * The settings area is one page with a tab strip. The tabs are routes, so the
 * browser's back button and an old bookmark both land on the right panel, and
 * the sidebar has a single Settings row instead of five.
 */
test('the settings area opens from the sidebar and its tabs are routes', async ({ page }) => {
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
            body: JSON.stringify({ folders: [{ id: 'f1', title: 'Tech', sortOrder: 0 }] }),
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
                        unread: 0,
                        addedAt: now,
                    },
                ],
            }),
        }),
    );
    await page.route('**/api/library/counts', (route) =>
        route.fulfill({ status: 200, body: JSON.stringify({ counts: {} }) }),
    );
    await page.route('**/api/articles?**', (route) =>
        route.fulfill({ status: 200, body: JSON.stringify({ items: [] }) }),
    );

    await page.goto('/');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

    // The search filters the index and jumps to the control itself.
    await page.getByLabel('Search settings').fill('page size');
    await page.getByRole('link', { name: 'Page size' }).click();
    await expect(page.getByRole('combobox', { name: 'Page size' })).toBeFocused();
    await expect(page.getByLabel('Search settings')).toHaveValue('');

    // A setting on another tab switches the tab and the URL together.
    await page.getByLabel('Search settings').fill('forget everything');
    await page.getByRole('link', { name: 'Forget everything' }).click();
    await expect(page).toHaveURL(/#\/settings\/privacy$/);
    await expect(page.getByRole('heading', { name: 'Privacy dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Forget everything' })).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('heading', { name: 'Privacy dashboard' })).toBeVisible();

    await page.getByRole('link', { name: 'Organize' }).click();
    await expect(page).toHaveURL(/#\/settings\/organize$/);
    await expect(page.getByRole('heading', { name: 'Organize' })).toBeVisible();

    // A saved link from when Privacy was its own route.
    await page.goto('/#/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute('aria-current', 'page');
});
