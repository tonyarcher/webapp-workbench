import { test, expect } from '@playwright/test';

test('restores an in-progress game after a reload and clears on New Game', async ({ page }) => {
  await page.goto('/');

  const startButton = page.getByTestId('start-game-button');
  await expect(startButton).toBeVisible();

  await page.getByTestId('away-team-input').fill('St. Louis Cardinals');
  await page.getByTestId('home-team-input').fill('Chicago Cubs');
  await startButton.click();

  await expect(page.getByTestId('local-game-state')).toBeVisible();
  const badge = page.getByTestId('engine-state-badge');
  await expect(badge).toHaveText('Top 1 · 0 balls · 0 strikes · 0 outs');

  await page.getByRole('button', { name: 'STRIKE LOOKING' }).click();
  await page.getByRole('button', { name: 'STRIKEOUT (K)' }).click();
  await expect(badge).toHaveText('Top 1 · 0 balls · 0 strikes · 1 outs');

  await page.reload();

  await expect(page.getByTestId('local-game-state')).toBeVisible();
  await expect(page.getByText('Live Scoring: St. Louis Cardinals @ Chicago Cubs')).toBeVisible();
  await expect(badge).toHaveText('Top 1 · 0 balls · 0 strikes · 1 outs');

  const awayScorebook = page.locator('baseball-scorebook-grid').first();
  await expect(awayScorebook.locator('.play-desc').first()).toHaveText('K');

  await page.getByTestId('new-game-button').click();
  await expect(startButton).toBeVisible();

  await page.reload();
  await expect(startButton).toBeVisible();
  await expect(page.getByTestId('local-game-state')).toBeHidden();
});
