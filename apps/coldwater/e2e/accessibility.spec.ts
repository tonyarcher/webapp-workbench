import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

/** `violations` as one assertion-friendly string, so a failure names the rule. */
function describe(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']): string[] {
    return violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
}

async function audit(page: Page): Promise<string[]> {
    const results = await new AxeBuilder({ page }).analyze();
    return describe(results.violations);
}

test('the start screen has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Coldwater' })).toBeVisible();
    expect(await audit(page)).toEqual([]);
});

test('a practice turn has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Enter the lake' }).click();
    await expect(page.getByRole('button', { name: /Eat/ })).toBeVisible();
    expect(await audit(page)).toEqual([]);
});

test('an outcome has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Enter the lake' }).click();
    await page.getByRole('button', { name: /Eat/ }).click();
    await expect(page.getByRole('button', { name: /Continue|Start over/ })).toBeVisible();
    expect(await audit(page)).toEqual([]);
});

test('the field guide has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Field guide' }).click();
    await expect(page.getByRole('heading', { name: 'Field guide' })).toBeVisible();
    expect(await audit(page)).toEqual([]);
});
