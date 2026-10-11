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
