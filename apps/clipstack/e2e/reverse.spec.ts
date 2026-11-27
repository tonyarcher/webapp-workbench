import { test, expect } from '@playwright/test';

/**
 * The reverse control lives in the slideout, not over the watch view. Seed two
 * clips with distinct authors so the flipped stack order is observable in the
 * sidebar rows, and so the control can be checked as unusable while collapsed.
 */
test('the sidebar reverse control flips the stack order', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem(
            'cs-session',
            JSON.stringify({
                version: 1,
                items: [
                    { id: '1111111111', url: 'https://www.tiktok.com/@alice/video/1111111111', author: 'alice' },
                    { id: '2222222222', url: 'https://www.tiktok.com/@bob/video/2222222222', author: 'bob' },
                ],
                skipped: [],
                activeIndex: 0,
                maxSeen: 0,
            }),
        );
    });
    // The embeds are third-party and irrelevant here; keep them off the network.
    await page.route(/tiktok\.com/, (route) => route.abort());
    await page.goto('/');

    const reverse = page.getByRole('button', { name: 'Reverse' });
    await expect(reverse).toBeHidden();

    await page.getByRole('button', { name: 'Open list' }).click();
    await expect(reverse).toBeVisible();

    const labels = page.locator('cs-progress-sidebar .row-label');
    await expect(labels).toHaveText(['@alice', '@bob']);

    await reverse.click();
    await expect(labels).toHaveText(['@bob', '@alice']);

    // Reversing is its own inverse, so the same control restores the order.
    await reverse.click();
    await expect(labels).toHaveText(['@alice', '@bob']);
});
