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

test('draws advancement arcs when a runner advances on a double', async ({ page }) => {
  await startGame(page);

  await page.getByRole('button', { name: 'SINGLE (1B)' }).click();
  await page.getByRole('button', { name: 'Right Field' }).click();
  await page.getByRole('button', { name: 'DOUBLE (2B)' }).click();
  await page.getByRole('button', { name: 'Right Field' }).click();

  const awayScorebook = page.locator('baseball-scorebook-grid').first();
  await expect(awayScorebook.locator('.advancement-line')).toHaveCount(1);
  await expect(awayScorebook.locator('.diamond').nth(0).locator('.advancement-line')).toHaveCount(1);
  await expect(awayScorebook.locator('.diamond').nth(9).locator('.advancement-line')).toHaveCount(0);
});

test('marks the runner who scores in his own cell, not the batter\'s', async ({ page }) => {
  await startGame(page);

  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'SINGLE (1B)' }).click();
    await page.getByRole('button', { name: 'Right Field' }).click();
  }

  const awayScorebook = page.locator('baseball-scorebook-grid').first();
  const firstBatterCell = awayScorebook.locator('.diamond').nth(0);
  const fourthBatterCell = awayScorebook.locator('.diamond').nth(27);
  await expect(firstBatterCell.locator('.advancement-line.scored')).toHaveCount(1);
  await expect(firstBatterCell).toHaveClass(/scored/);
  await expect(fourthBatterCell.locator('.advancement-line')).toHaveCount(0);
});

test('shows the batter on first base in the field after a single', async ({ page }) => {
  await startGame(page);

  await page.getByRole('button', { name: 'SINGLE (1B)' }).click();
  await page.getByRole('button', { name: 'Right Field' }).click();

  const scoreboard = page.locator('baseball-scoreboard').first();
  await expect(scoreboard).toContainText('1B: Brendan Donovan');
  await expect(scoreboard).toContainText('SINGLE · Right Field');
});

test('records a 6-4-3 double play for two outs', async ({ page }) => {
  await startGame(page);

  await page.getByRole('button', { name: 'SINGLE (1B)' }).click();
  await page.getByRole('button', { name: 'Right Field' }).click();
  await page.getByRole('button', { name: 'GROUNDOUT', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Double Play (two outs)' }).check();
  await page.getByRole('button', { name: 'Shortstop (6)' }).click();

  const awayScorebook = page.locator('baseball-scorebook-grid').first();
  await expect(awayScorebook.locator('.play-desc').nth(1)).toHaveText('6-4-3');
  await expect(page.locator('baseball-scoreboard').first()).toContainText('2 Outs');
});
