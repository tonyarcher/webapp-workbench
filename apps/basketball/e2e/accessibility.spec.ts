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
    // No withTags, same reasoning as the baseball spec: the default ruleset
    // already runs the best-practice rules, and narrowing it with withTags
    // drops target-size and duplicate-id along with the rest.
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
    await expect(page.locator('bball-game-shell')).toBeVisible();
    expect(await audit(page)).toEqual([]);
});
