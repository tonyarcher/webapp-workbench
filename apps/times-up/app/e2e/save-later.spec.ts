import { test, expect } from '@playwright/test';

test('the list toolbar saves the current article and active stars are gold', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('times-up.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
    });
    const now = Date.now();
    await page.route('**/api/library/folders', (route) => route.fulfill({ status: 200, body: '{"folders":[]}' }));
    await page.route('**/api/library/feeds', (route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                feeds: [
                    {
                        id: 'f1',
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
                        feedId: 'f1',
                        guid: 'g1',
                        title: 'Bookmark story',
                        link: 'https://example.com/story',
                        summary: 'Summary',
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
    await page.route('**/api/articles/state', (route) =>
        route.fulfill({ status: 200, body: '{"ok":true,"updated":1}' }),
    );
    let savedBody: unknown = null;
    await page.route('**/api/saved-articles', async (route) => {
        savedBody = route.request().postDataJSON() as unknown;
        await route.fulfill({
            status: 200,
            body: JSON.stringify({ id: 'saved-a1', articleId: 'a1', title: 'Bookmark story', savedAt: now }),
        });
    });

    await page.goto('/#/all');
    const save = page.getByRole('button', { name: /Save for later/ });
    await expect(save).toBeDisabled();
    await page.getByRole('button', { name: 'Bookmark story', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Bookmark story' });
    const star = dialog.getByRole('button', { name: 'Star', exact: true });
    await star.click();
    await expect(dialog.getByRole('button', { name: 'Unstar', exact: true })).toHaveClass(/star-action/);
    const starColor = await dialog
        .getByRole('button', { name: 'Unstar', exact: true })
        .evaluate((node) => getComputedStyle(node).color);
    expect(starColor).toBe('rgb(245, 158, 11)');
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.locator('.row .star')).toHaveAttribute('aria-pressed', 'true');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText('1 article saved for later', { exact: true })).toBeVisible();
    expect(savedBody).toEqual({ articleId: 'a1' });
});

test('the list toolbar saves the visible slideshow article', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('times-up.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
    });
    const now = Date.now();
    const items = ['a1', 'a2'].map((id, index) => ({
        id,
        feedId: 'f1',
        guid: id,
        title: `Slide ${index + 1}`,
        link: `https://example.com/${id}`,
        summary: 'Summary',
        published: now - index * 1_000,
        fetchedAt: now,
        read: 0,
        starred: false,
        popularity: 1,
        hot: 2 - index,
    }));
    await page.route('**/api/library/folders', (route) => route.fulfill({ status: 200, body: '{"folders":[]}' }));
    await page.route('**/api/library/feeds', (route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                feeds: [
                    {
                        id: 'f1',
                        title: 'Feed One',
                        url: 'https://example.com/feed',
                        folderIds: [],
                        unread: 2,
                        addedAt: now,
                    },
                ],
            }),
        }),
    );
    await page.route('**/api/library/counts', (route) => route.fulfill({ status: 200, body: '{"counts":{}}' }));
    await page.route('**/api/articles?**', (route) => route.fulfill({ status: 200, body: JSON.stringify({ items }) }));
    await page.route('**/api/articles/a*/**', (route) => route.fulfill({ status: 404, body: '{}' }));
    let savedBody: unknown = null;
    await page.route('**/api/saved-articles', async (route) => {
        savedBody = route.request().postDataJSON() as unknown;
        await route.fulfill({
            status: 200,
            body: JSON.stringify({ id: 'saved', articleId: 'a2', title: 'Slide 2', savedAt: now }),
        });
    });

    await page.goto('/#/all');
    await page.getByRole('combobox', { name: 'List view' }).selectOption('slideshow');
    await page.getByRole('button', { name: 'Next →' }).click();
    await expect(page.getByRole('heading', { name: 'Slide 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Save for later', exact: true }).click();
    await expect(page.getByText('1 article saved for later', { exact: true })).toBeVisible();
    expect(savedBody).toEqual({ articleId: 'a2' });
});
