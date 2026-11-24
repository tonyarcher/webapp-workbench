import { test, expect } from '@playwright/test';

/**
 * The settings area is one page with a tab strip. The tabs are routes, so the
 * browser's back button and an old bookmark both land on the right panel, and
 * the sidebar has a single Settings row instead of five.
 */
test('every Add feed entry point opens the one form', async ({ page }) => {
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

    const formInput = page.locator('input[data-add-url]');
    await page.goto('/');
    await page.getByRole('button', { name: 'Add feed' }).click();
    await expect(page).toHaveURL(/#\/settings\/organize$/);
    await expect(formInput).toBeVisible();
    await expect(formInput).toBeFocused();

    await page.getByRole('link', { name: 'Organize' }).click();
    await page.locator('organize-view').getByRole('button', { name: 'Add feed', exact: true }).click();
    await expect(page).toHaveURL(/#\/settings\/organize$/);
    await expect(formInput).toBeVisible();

    await page.goto('/');
    await page.getByRole('button', { name: 'Feed list options' }).click();
    await page.locator('feed-list-menu').getByRole('button', { name: 'Add feed' }).click();
    await expect(page).toHaveURL(/#\/settings\/organize$/);
    await expect(formInput).toBeVisible();
});

test('the settings area opens from the sidebar and its tabs are routes', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('times-up.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
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
    await page.getByRole('button', { name: /Account/ }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

    // The filter updates the page live, not a dropdown.
    await page.getByLabel('Filter settings').fill('reader font');
    await expect(page.getByRole('heading', { name: 'Filtered settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reader font' })).toBeVisible();
    await page.getByRole('link', { name: 'Reader font' }).click();
    await expect(page.getByRole('combobox', { name: 'Font' })).toBeFocused();
    await expect(page.getByLabel('Filter settings')).toHaveValue('');
    await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

    // A setting on another tab switches the tab and the URL together.
    await page.getByLabel('Filter settings').fill('forget everything');
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
