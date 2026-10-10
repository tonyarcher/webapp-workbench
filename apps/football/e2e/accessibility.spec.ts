import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

/**
 * Accessibility audit with the official axe integration, run against the real
 * app rather than against components mounted in isolation. That matters for
 * colour contrast: these components are transparent and take their surface
 * from the page, so an audit on a bare test canvas measures a background the
 * app never ships with and reports failures that are not there.
 *
 * Two states, because the setup screen and the scorekeeping screen do not
 * render the same components. An audit of one alone would leave half the app
 * unmeasured.
 */

/** `violations` as one assertion-friendly string, so a failure names the rule. */
function describe(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']): string[] {
    return violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
}

async function audit(page: Page): Promise<string[]> {
    // No withTags here on purpose. The default ruleset already includes the
    // best-practice rules, which is how landmark-one-main, region and
    // page-has-heading-one were found. Adding withTags narrows the run: against
    // axe-core 4.13 it drops seven rules the default would run, including
    // target-size (WCAG 2.2 AA) and duplicate-id.
    const results = await new AxeBuilder({ page }).analyze();
    return describe(results.violations);
}

test('the setup screen has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Score a game' })).toBeVisible();
    expect(await audit(page)).toEqual([]);
});

test('the scorekeeping screen has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Score a game' }).click();
    await expect(page.locator('fb-game-shell')).toBeVisible();
    expect(await audit(page)).toEqual([]);
});

/**
 * A third state, because the first two leave the log empty. The same
 * components render, but with a kickoff and a scrimmage play recorded the
 * scorebug, the play pad and the play log all take their populated paths,
 * which is a different set of DOM for axe to read.
 */
test('a live down has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Score a game' }).click();
    await expect(page.locator('fb-game-shell')).toBeVisible();
    await page.getByRole('button', { name: 'Kickoff TB' }).click();
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.locator('ol.log li').first()).toBeVisible();
    expect(await audit(page)).toEqual([]);
});
