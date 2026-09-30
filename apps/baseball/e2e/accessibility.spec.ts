import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

/**
 * Accessibility audit with the official axe integration, run against the real
 * app rather than against components mounted in isolation. That matters for
 * colour contrast: these components are transparent and take their surface
 * from the page, so an audit on a bare test runner canvas measures a
 * background the app never ships with and reports failures that are not there.
 *
 * Two states, because the components that render on the setup screen are not
 * on the scorekeeping screen. An audit of one of them alone would leave half
 * the package unaudited.
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

/** The scorekeeping screen: scoreboard, action grid, scorebook, cards. */
async function startGame(page: Page): Promise<void> {
    await page.getByTestId('away-slot-1-name').fill('Tony Gwynn');
    await page.getByTestId('home-pitcher-input').fill('Trevor Hoffman');
    await page.getByTestId('start-game-button').click();
    await expect(page.getByTestId('local-game-state')).toBeVisible();
}

test('the setup screen has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('start-game-button')).toBeVisible();
    expect(await audit(page)).toEqual([]);
});

test('the scorekeeping screen has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/');
    await startGame(page);
    expect(await audit(page)).toEqual([]);
});

/**
 * A third state, because the first two leave the game empty. The same
 * components render in both, but with a play recorded the scoreboard, the
 * scorebook grid, the play-by-play and the box-score button all take their
 * populated paths, which is a different set of DOM for axe to read.
 */
test('a live at-bat has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/');
    await startGame(page);
    await page.getByRole('button', { name: 'SINGLE (1B)' }).click();
    await page.getByRole('button', { name: 'Right Field' }).click();
    await expect(page.locator('baseball-scoreboard').first()).toContainText('1B');
    expect(await audit(page)).toEqual([]);
});
