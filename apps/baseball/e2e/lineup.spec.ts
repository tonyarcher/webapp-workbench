import { test, expect } from '@playwright/test';

test('custom lineup names appear in the scorebook after first pitch', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('away-slot-1-name').fill('Tony Gwynn');
  await page.getByTestId('away-slot-1-jersey').fill('19');
  await page.getByTestId('away-slot-1-position').selectOption('RF');
  await page.getByTestId('home-pitcher-input').fill('Trevor Hoffman');

  await page.getByTestId('start-game-button').click();
  await expect(page.getByTestId('local-game-state')).toBeVisible();

  const awayScorebook = page.locator('baseball-scorebook-grid').first();
  await expect(awayScorebook).toContainText('Tony Gwynn');

  await page.getByRole('button', { name: 'SINGLE (1B)' }).click();
  await page.getByRole('button', { name: 'Right Field' }).click();

  await expect(page.locator('baseball-scoreboard').first()).toContainText('1B: Tony Gwynn');
  await expect(page.getByText(/Trevor Hoffman/)).toBeVisible();
});

test('setup lineups modal saves a substitution onto the live game', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-game-button').click();
  await expect(page.getByTestId('local-game-state')).toBeVisible();

  await page.getByRole('button', { name: 'Setup Lineups' }).click();
  const editor = page.getByTestId('lineup-editor');
  await expect(editor).toBeVisible();
  await editor.getByTestId('away-slot-1-name').fill('Tommy Edman');
  await editor.getByTestId('lineup-save-button').click();

  const awayScorebook = page.locator('baseball-scorebook-grid').first();
  await expect(awayScorebook).toContainText('Tommy Edman');
});
