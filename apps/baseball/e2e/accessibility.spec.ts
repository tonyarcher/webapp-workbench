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
