import { test, expect } from '@playwright/test';

test('a practice run moves from the menu through a turn', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Mackinaw/ }).click();
    await page.getByRole('button', { name: 'Enter the lake' }).click();
    await expect(page.getByRole('heading', { name: 'Mackinaw' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Shallow escape/ })).toHaveCount(0);
    await page.getByRole('button', { name: /Deep escape/ }).click();
    await expect(page.getByRole('button', { name: /Continue|Start over/ })).toBeVisible();
});

test('the field guide returns to the lake', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Field guide' }).click();
    await expect(page.getByRole('heading', { name: 'Field guide' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Walleye' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to the lake' }).click();
    await expect(page.getByRole('heading', { name: 'Coldwater' })).toBeVisible();
});

test('a points run hides the fish name and runs a clock', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Play for points/ }).click();
    await page.getByRole('button', { name: 'Enter the lake' }).click();
    await expect(page.getByRole('heading', { name: 'Unidentified fish' })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Decision time' })).toBeVisible();
});

test('keyboard shortcuts choose a move', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Enter the lake' }).click();
    await page.keyboard.press('e');
    await expect(page.getByRole('button', { name: /Continue|Start over/ })).toBeVisible();
});
