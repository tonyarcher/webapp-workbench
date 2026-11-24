import { test, expect } from '@playwright/test';

test('the card image saves the article and active stars are gold', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('times-up.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
        localStorage.setItem('times-up:default-view-settings', JSON.stringify({ listView: 'cards' }));
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
                        unread: 2,
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
                    {
                        id: 'a2',
                        feedId: 'f1',
                        guid: 'g2',
                        title: 'Second story',
                        link: 'https://example.com/second',
                        summary: 'Summary',
                        published: now - 1_000,
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
    await page.route('**/api/articles/a*/**', (route) => route.fulfill({ status: 404, body: '{}' }));
    await page.route('**/api/articles/state', (route) =>
        route.fulfill({ status: 200, body: '{"ok":true,"updated":1}' }),
    );
    let savedBody: unknown = null;
    let saved = false;
    await page.route('**/api/saved-articles', async (route) => {
        if (route.request().method() === 'GET') {
            const items = saved ? [{ id: 'saved-a1', articleId: 'a1', title: 'Bookmark story', savedAt: now }] : [];
            await route.fulfill({ status: 200, body: JSON.stringify({ items }) });
            return;
        }
        saved = true;
        savedBody = route.request().postDataJSON() as unknown;
        await route.fulfill({
            status: 200,
            body: JSON.stringify({ id: 'saved-a1', articleId: 'a1', title: 'Bookmark story', savedAt: now }),
        });
    });
    await page.route('**/api/saved-articles/a1', (route) => {
        saved = false;
        return route.fulfill({ status: 200, body: '{"ok":true}' });
    });

    await page.goto('/#/all');
    const save = page.locator('.card-action[aria-label="Save for later"]').first();
    await page.locator('.grid-card').first().hover();
    await expect(save).toBeVisible();
    await expect(page.locator('article-list .toolbar .save-for-later')).toHaveCount(0);
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
    const cardStar = page.locator('.card-action.star[aria-pressed="true"]');
    await expect(cardStar).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(cardStar).toHaveCSS('color', 'rgb(245, 158, 11)');
    await expect(page.locator('.card-action.star[aria-pressed="false"]').first()).toHaveCSS(
        'background-color',
        'rgb(255, 255, 255)',
    );
    await expect(page.locator('article-list .toolbar .save-for-later')).toHaveCount(0);
    await page.locator('.grid-card').first().hover();
    await expect(save).toBeVisible();
    await save.click();
    await expect(save).toHaveAttribute('aria-pressed', 'true');
    await expect(save.locator('path')).toHaveAttribute('fill', 'currentColor');
    await expect(page.getByText('1 article saved for later', { exact: true })).toBeVisible();
    await save.click();
    await expect(save).toHaveAttribute('aria-pressed', 'false');
    await expect(save.locator('path')).toHaveAttribute('fill', 'none');
    await expect(page.getByText('Article removed from saved', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Bookmark story', exact: true }).click();
    await dialog.getByRole('button', { name: /Save for later/ }).click();
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    await page.locator('.grid-card').first().hover();
    await expect(save).toHaveAttribute('aria-pressed', 'true');
    expect(savedBody).toEqual({ articleId: 'a1' });
});

test('the slideshow saves the visible article', async ({ page }) => {
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
    let saved = false;
    await page.route('**/api/saved-articles', async (route) => {
        if (route.request().method() === 'GET') {
            const savedItems = saved ? [{ id: 'saved', articleId: 'a2', title: 'Slide 2', savedAt: now }] : [];
            await route.fulfill({ status: 200, body: JSON.stringify({ items: savedItems }) });
            return;
        }
        saved = true;
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
    const save = page.getByRole('button', { name: /Save for later/ });
    await save.click();
    await expect(page.locator('.slideshow-actions button[aria-pressed="true"]')).toContainText('Saved');
    expect(savedBody).toEqual({ articleId: 'a2' });
});
