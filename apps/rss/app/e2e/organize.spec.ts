import { test, expect, type Page } from '@playwright/test';

/**
 * Organize is a real organizer: feeds move between folders and out to
 * Uncategorized, folders can be renamed, and their order can be changed.
 * Every write goes through the API and the section list repaints from it.
 */
type Folder = { id: string; title: string; createdAt: number; sortOrder: number };
type Feed = { id: string; title: string; url: string; folderIds: string[]; unread: number; addedAt: number };

test('Organize moves feeds, renames folders, and reorders them', async ({ page }) => {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp, preferred_username: 'tester' })}.sig`;
        localStorage.setItem('rss.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
    });

    let folders: Folder[] = [
        { id: 'f1', title: 'Tech', createdAt: 1, sortOrder: 0 },
        { id: 'f2', title: 'Sport', createdAt: 2, sortOrder: 1 },
    ];
    let feeds: Feed[] = [
        { id: 'fd1', title: 'Feed One', url: 'https://example.com/one', folderIds: ['f1'], unread: 0, addedAt: 1 },
        { id: 'fd2', title: 'Feed Two', url: 'https://example.com/two', folderIds: [], unread: 0, addedAt: 2 },
    ];
    let moved: string[] = [];
    let renamed = '';
    let reordered: string[] = [];

    await stub(page, '**/api/library/folders', () => ({ folders, savedSearches: [] }));
    await stub(page, '**/api/library/feeds', () => ({ feeds }));
    await stub(page, '**/api/library/counts', () => ({ counts: {} }));
    await stub(page, '**/api/articles?**', () => ({ items: [] }));
    await stub(
        page,
        '**/api/feeds/fd1/folders',
        (body) => {
            moved = (body as { folderIds: string[] }).folderIds;
            feeds = feeds.map((f) => (f.id === 'fd1' ? { ...f, folderIds: moved } : f));
            return { ok: true };
        },
        'PUT',
    );
    await stub(
        page,
        '**/api/folders/f2',
        (body) => {
            renamed = (body as { title: string }).title;
            folders = folders.map((f) => (f.id === 'f2' ? { ...f, title: renamed } : f));
            return folders.find((f) => f.id === 'f2');
        },
        'PUT',
    );
    await stub(
        page,
        '**/api/folders/reorder',
        (body) => {
            reordered = (body as { ids: string[] }).ids;
            const byId = new Map(folders.map((f) => [f.id, f]));
            folders = reordered.map((id) => byId.get(id)!).filter(Boolean);
            return { ok: true };
        },
        'POST',
    );

    await page.goto('/#/settings/organize');
    await expect(page.getByRole('heading', { name: 'Tech (1)' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sport (0)' })).toBeVisible();

    // Move a feed out of Tech into Sport.
    await page.getByLabel('Move Feed One to folder').selectOption('f2');
    await expect(page.getByRole('heading', { name: 'Tech (0)' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sport (1)' })).toBeVisible();
    expect(moved).toEqual(['f2']);

    // Rename the folder.
    page.once('dialog', (dialog) => void dialog.accept('Outdoor'));
    await page.getByRole('button', { name: 'Rename Sport' }).click();
    await expect(page.getByRole('heading', { name: 'Outdoor (1)' })).toBeVisible();
    expect(renamed).toBe('Outdoor');

    // Move it above Tech.
    await page.getByRole('button', { name: 'Move Outdoor up' }).click();
    const heads = page.locator('.folder-head h3');
    await expect(heads.nth(1)).toHaveText('Outdoor (1)');
    await expect(heads.nth(2)).toHaveText('Tech (0)');
    expect(reordered).toEqual(['f2', 'f1']);

    // And the feed can go back to Uncategorized.
    await page.getByLabel('Move Feed One to folder').selectOption('');
    await expect(page.getByRole('heading', { name: 'Uncategorized (2)' })).toBeVisible();
    expect(moved).toEqual([]);
});

async function stub(page: Page, pattern: string, body: (request: unknown) => unknown, method = 'GET') {
    await page.route(pattern, async (route) => {
        if (route.request().method() !== method) return route.continue();
        const raw = route.request().postData();
        await route.fulfill({ status: 200, body: JSON.stringify(body(raw ? JSON.parse(raw) : undefined)) });
    });
}
