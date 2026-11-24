import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

/**
 * Accessibility audit with the official axe integration, run against the real
 * app rather than against components mounted in isolation. That matters for
 * colour contrast: an audit on a bare test canvas measures a background the app
 * never ships with and reports failures that are not there.
 *
 * This audits the initial screen only. Screens behind a sign-in or a navigation
 * are per-app work and belong here as they are covered.
 */

/** `violations` as one assertion-friendly string, so a failure names the rule. */
function describe(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']): string[] {
    return violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
}

async function audit(page: Page): Promise<string[]> {
    // No withTags here on purpose. The default ruleset already includes the
    // best-practice rules, which is how landmark-one-main, region and
    // page-has-heading-one get found. Adding withTags narrows the run.
    const results = await new AxeBuilder({ page }).analyze();
    return describe(results.violations);
}

test('the initial screen has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(await audit(page)).toEqual([]);
});

/**
 * Authenticated screens, behind the sign-in the initial audit never passes.
 * Auth is seeded and every read is stubbed, following mark-read-busy: the
 * only real code under audit is the list, the cards, and the article overlay.
 * The initial screen stays untouched above; these cover what it cannot see.
 */

const FEED = { id: 'f1', title: 'Example', url: 'https://example.com/rss', folderIds: [], unread: 3, addedAt: 0 };

function article(id: string, title: string, extra: Record<string, unknown> = {}) {
    return {
        id,
        feedId: 'f1',
        guid: id,
        title,
        published: 1_700_000_000_000,
        fetchedAt: 1_700_000_000_000,
        read: 0,
        starred: false,
        popularity: 1,
        hot: 1,
        summary: `${title} summary`,
        content: `<p>${title} body</p>`,
        ...extra,
    };
}

const ARTICLES = [
    article('a1', 'First article'),
    article('a2', 'Second article'),
    article('a3', 'Video article', { link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
];

async function seedAuth(page: Page) {
    await page.addInitScript(() => {
        const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${b64({ alg: 'RS256' })}.${b64({ exp })}.sig`;
        localStorage.setItem('times-up.auth.tokens', JSON.stringify({ access: token, refresh: 'r', exp }));
    });
}

async function stubLibrary(page: Page, items: unknown[]) {
    await page.route('**/api/library/folders', (route) => route.fulfill({ status: 200, body: '{"folders":[]}' }));
    await page.route('**/api/library/feeds', (route) =>
        route.fulfill({ status: 200, body: JSON.stringify({ feeds: [FEED] }) }),
    );
    await page.route('**/api/library/counts', (route) => route.fulfill({ status: 200, body: '{"counts":{}}' }));
    await page.route('**/api/articles?**', (route) => route.fulfill({ status: 200, body: JSON.stringify({ items }) }));
    await page.route('**/api/articles/state', (route) =>
        route.fulfill({ status: 200, body: '{"ok":true,"updated":1}' }),
    );
    await page.route('**/api/affinity', (route) => route.fulfill({ status: 200, body: '{"ok":true}' }));
    // Favicons, YouTube posters, and embed players never load test fixtures:
    // fail them fast so the audit reads the placeholder and unloaded-player
    // states deterministically instead of whatever the live third party
    // serves that run.
    await page.route('**/favicon.ico', (route) => route.fulfill({ status: 404 }));
    await page.route('https://i.ytimg.com/**', (route) => route.fulfill({ status: 404 }));
    await page.route('https://www.youtube-nocookie.com/**', (route) => route.fulfill({ status: 404 }));
    await page.route('https://player.vimeo.com/**', (route) => route.fulfill({ status: 404 }));
    await page.route('https://www.dailymotion.com/embed/**', (route) => route.fulfill({ status: 404 }));
    await page.route('https://www.tiktok.com/embed/**', (route) => route.fulfill({ status: 404 }));
    await page.route('https://rumble.com/embed/**', (route) => route.fulfill({ status: 404 }));
    await page.route('https://player.twitch.tv/**', (route) => route.fulfill({ status: 404 }));
}

test('the article list has no automatic accessibility violations', async ({ page }) => {
    await seedAuth(page);
    await stubLibrary(page, [ARTICLES[0], ARTICLES[1]]);
    await page.goto('/');
    await expect(page.getByText('First article', { exact: true })).toBeVisible();
    expect(await audit(page)).toEqual([]);
});

test('the cards view has no automatic accessibility violations', async ({ page }) => {
    await seedAuth(page);
    await page.addInitScript(() => {
        localStorage.setItem(
            'times-up:view-settings',
            JSON.stringify({
                all: { listView: 'cards', sort: 'newest', pageSize: 50, maxCardCols: 4, unreadOnly: false },
            }),
        );
    });
    await stubLibrary(page, ARTICLES);
    await page.goto('/');
    await expect(page.locator('.grid-card').first()).toBeVisible();
    expect(await audit(page)).toEqual([]);
});

test('the slideshow view has no automatic accessibility violations', async ({ page }) => {
    await seedAuth(page);
    await page.addInitScript(() => {
        localStorage.setItem(
            'times-up:view-settings',
            JSON.stringify({
                all: { listView: 'slideshow', sort: 'newest', pageSize: 50, maxCardCols: 4, unreadOnly: false },
            }),
        );
    });
    await stubLibrary(page, ARTICLES);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Exit slideshow' })).toBeVisible();
    expect(await audit(page)).toEqual([]);
});

test('the open article has no automatic accessibility violations', async ({ page }) => {
    await seedAuth(page);
    await stubLibrary(page, [ARTICLES[0], ARTICLES[2]]);
    await page.goto('/');
    await expect(page.getByText('First article', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Video article', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
    // The panel slides in over 180ms; auditing mid-fade blends every color
    // with the backdrop and fails contrast at random. Wait for the entrance
    // to settle instead of sleeping a fixed margin.
    await page.waitForFunction(() => {
        const panel = document
            .querySelector('app-shell')
            ?.shadowRoot?.querySelector('.article-panel') as HTMLElement | null;
        if (!panel) return false;
        return (
            panel.getAnimations().every((a) => a.playState === 'finished') && getComputedStyle(panel).opacity === '1'
        );
    });
    expect(await audit(page)).toEqual([]);
});

test('the search screen has no automatic accessibility violations', async ({ page }) => {
    await seedAuth(page);
    await stubLibrary(page, ARTICLES);
    await page.goto('/#/search');
    await expect(page.locator('article-list').getByRole('heading', { name: 'Search', exact: true })).toBeVisible();
    await expect(page.getByLabel('Search articles')).toBeVisible();
    expect(await audit(page)).toEqual([]);
});

test('the shared-link screen has no automatic accessibility violations', async ({ page }) => {
    await seedAuth(page);
    await stubLibrary(page, ARTICLES);
    await page.goto('/?url=https%3A%2F%2Fexample.com%2Fstory&title=Shared%20story');
    await expect(page.getByRole('heading', { name: 'Shared link' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Subscribe to feed', exact: true })).toBeVisible();
    expect(await audit(page)).toEqual([]);
});

test('the focus session has no automatic accessibility violations', async ({ page }) => {
    await seedAuth(page);
    await stubLibrary(page, ARTICLES);
    await page.route('**/api/saved-articles', (route) => route.fulfill({ status: 200, body: '{"items":[]}' }));
    await page.goto('/#/focus');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByRole('progressbar', { name: 'Focus session progress' })).toBeVisible();
    expect(await audit(page)).toEqual([]);
});

test('the related-stories panel has no automatic accessibility violations', async ({ page }) => {
    await seedAuth(page);
    const related = [
        article('a1', 'Battery grid storage', { link: 'https://example.com/battery' }),
        article('a2', 'Battery grid policy', { link: 'https://example.com/policy' }),
    ];
    await stubLibrary(page, related);
    await page.route('**/api/saved-articles', (route) => route.fulfill({ status: 200, body: '{"items":[]}' }));
    await page.goto('/#/all');
    await page.getByRole('button', { name: 'Battery grid storage', exact: true }).click();
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('button', { name: 'More like this' }).click();
    await expect(page.getByRole('dialog', { name: 'More like this' })).toBeVisible();
    expect(await audit(page)).toEqual([]);
});

test('the command palette has no automatic accessibility violations', async ({ page }) => {
    await seedAuth(page);
    await stubLibrary(page, [ARTICLES[0]]);
    await page.goto('/');
    await expect(page.getByText('First article', { exact: true })).toBeVisible();
    await page.keyboard.press('Control+K');
    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Commands')).toBeVisible();
    expect(await audit(page)).toEqual([]);
});

test('the privacy dashboard has no automatic accessibility violations', async ({ page }) => {
    await seedAuth(page);
    await page.addInitScript(() => {
        localStorage.setItem('times-up:word-map', JSON.stringify({ rust: 8, crypto: -6 }));
        localStorage.setItem('times-up:engagement-totals', JSON.stringify({ 'a1:share': 8 }));
        localStorage.setItem('times-up:deranked-ids', JSON.stringify(['a1']));
        localStorage.setItem('times-up:engagement-decayed-at', '1700000000000');
    });
    await stubLibrary(page, ARTICLES);
    await page.goto('/#/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy dashboard' })).toBeVisible();
    await expect(page.getByText('rust', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export learned profile' })).toBeVisible();
    await page.getByRole('button', { name: 'Forget everything' }).click();
    await expect(page.getByRole('heading', { name: 'Forget everything?' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(await audit(page)).toEqual([]);
});

test('the settings area has no automatic accessibility violations', async ({ page }) => {
    await seedAuth(page);
    await stubLibrary(page, ARTICLES);
    await page.goto('/#/settings');
    await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();
    await page.getByLabel('Filter settings').fill('font');
    await expect(page.getByRole('link', { name: 'Reader font' })).toBeVisible();
    expect(await audit(page)).toEqual([]);
});
