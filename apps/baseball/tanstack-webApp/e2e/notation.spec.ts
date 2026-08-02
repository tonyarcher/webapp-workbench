import { test, expect } from '@playwright/test';

async function startGame(page: import('@playwright/test').Page) {
  await page.goto('/');
  const startButton = page.getByTestId('start-game-button');
  await expect(startButton).toBeVisible();
  await page.getByTestId('away-team-input').fill('St. Louis Cardinals');
  await page.getByTestId('home-team-input').fill('Chicago Cubs');
  await startButton.click();
  await expect(page.getByTestId('local-game-state')).toBeVisible();
}

test('records fielding positions in the scorebook', async ({ page }) => {
  await startGame(page);

  await page.getByRole('button', { name: 'GROUNDOUT', exact: true }).click();
  await page.getByRole('button', { name: 'Shortstop (6)' }).click();

  const awayScorebook = page.locator('baseball-scorebook-grid').first();
  await expect(awayScorebook.locator('.play-desc').first()).toHaveText('6-3');
  await expect(awayScorebook.locator('.out-circle').first()).toHaveText('1');
});

test('marks a home run with a run dot and RBI badge', async ({ page }) => {
  await startGame(page);

  await page.getByRole('button', { name: 'HOME RUN (HR)' }).click();
  await page.getByRole('button', { name: 'Right Field' }).click();

  const awayScorebook = page.locator('baseball-scorebook-grid').first();
  await expect(awayScorebook.locator('.play-desc').first()).toHaveText('HR');
  await expect(awayScorebook.locator('.run-dot')).toHaveCount(1);
});
