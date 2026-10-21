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

const SCENE_VIEWPORTS = [
    { width: 1280, height: 720, name: 'desktop' },
    { width: 640, height: 800, name: 'narrow' },
    { width: 360, height: 740, name: 'mobile' },
] as const;

for (const viewport of SCENE_VIEWPORTS) {
    test(`the fish stay inside the scene at ${viewport.name} width`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        await page.getByRole('button', { name: /Walleye/ }).click();
        await page.getByRole('button', { name: 'Enter the lake' }).click();
        await page.locator('.encounter').evaluate((element) => {
            element.classList.remove('shallow', 'both');
            element.classList.add('deep');
        });
        const scene = await page.locator('.scene').boundingBox();
        expect(scene).not.toBeNull();
        if (!scene) return;
        for (const selector of ['.player', '.encounter']) {
            const box = await page.locator(selector).boundingBox();
            expect(box, selector).not.toBeNull();
            if (!box) continue;
            expect(box.x, selector).toBeGreaterThanOrEqual(scene.x);
            expect(box.y, selector).toBeGreaterThanOrEqual(scene.y);
            expect(box.x + box.width, selector).toBeLessThanOrEqual(scene.x + scene.width - 1);
            expect(box.y + box.height, selector).toBeLessThanOrEqual(scene.y + scene.height - 1);
        }
    });

    test(`the big gulp lands at the mouth at ${viewport.name} width`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.goto('/');
        await page.getByRole('button', { name: /Mackinaw/ }).click();
        await page.getByRole('button', { name: 'Enter the lake' }).click();
        // Force the rare mackinaw/walleye meal; the seeded bag would make this flaky.
        await page.locator('cw-game-screen').evaluate((element) => {
            const screen = element as HTMLElement & {
                run: Record<string, unknown> & {
                    speciesId: string;
                    encounterId: string;
                    phase: string;
                    outcome: unknown;
                };
            };
            screen.run = {
                ...screen.run,
                speciesId: 'mackinaw',
                encounterId: 'walleye',
                phase: 'resolved',
                outcome: {
                    tone: 'good',
                    title: 'Caught it',
                    detail: 'You catch the walleye.',
                    points: 15,
                    survived: true,
                    action: 'eat',
                },
            };
        });
        // The swallow scales the prey down as it translates; wait for the
        // scale-down before measuring the final mouth target.
        await expect
            .poll(async () => {
                const box = await page.locator('.encounter').boundingBox();
                return box?.width ?? Number.POSITIVE_INFINITY;
            })
            .toBeLessThan(30);

        const scene = await page.locator('.scene').boundingBox();
        const player = await page.locator('.player').boundingBox();
        const encounter = await page.locator('.encounter').boundingBox();
        expect(scene).not.toBeNull();
        expect(player).not.toBeNull();
        expect(encounter).not.toBeNull();
        if (!scene || !player || !encounter) return;

        const mouthX = player.x + player.width * (119 / 160);
        const encounterCenterX = encounter.x + encounter.width / 2;
        expect(Math.abs(encounterCenterX - mouthX)).toBeLessThan(3);
        expect(encounter.x).toBeGreaterThanOrEqual(scene.x);
        expect(encounter.y).toBeGreaterThanOrEqual(scene.y);
        expect(encounter.x + encounter.width).toBeLessThanOrEqual(scene.x + scene.width - 1);
        expect(encounter.y + encounter.height).toBeLessThanOrEqual(scene.y + scene.height - 1);
    });
}
