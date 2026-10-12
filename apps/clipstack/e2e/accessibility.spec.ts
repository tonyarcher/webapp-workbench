import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

/**
 * Accessibility audit with the official axe integration, run against the real
 * app rather than against components mounted in isolation. That matters for
 * colour contrast: an audit on a bare test canvas measures a background the app
 * never ships with and reports failures that are not there.
 *
 * This audits the initial screen and, with a seeded session, the watch view.
 * Screens behind a sign-in or a navigation are per-app work and belong here
 * as they are covered.
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
 * A saved session renders the watch view, whose height:100% chain crosses
 * the <main> landmark. An unstyled main collapses it to zero height (blank
 * screen) while the import view above keeps rendering, so the audit alone
 * cannot catch the regression: assert the rendered height too.
 */
test('a saved session renders a full-height watch view with no violations', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem(
            'cs-session',
            JSON.stringify({
                version: 1,
                items: [{ id: '1234567890', url: 'https://www.tiktok.com/@user/video/1234567890' }],
                skipped: [],
                activeIndex: 0,
                maxSeen: 0,
            }),
        );
    });
    // The embed player is third-party: TikTok's error art for the seeded
    // (nonexistent) video carries nodes axe can see but we cannot fix, and it
    // loads racing the audit. Block it before navigating so the audit reads
    // only our DOM; the titled iframe shell stays in place. A regex, not a
    // glob: it matches every TikTok host and path unambiguously.
    await page.route(/tiktok\.com/, (route) => route.abort());
    await page.goto('/');
    const watch = page.locator('cs-watch-view').first();
    await expect(watch).toBeAttached();
    const box = await watch.boundingBox();
    expect(box?.height).toBeGreaterThan(0);
    expect(await audit(page)).toEqual([]);
});
