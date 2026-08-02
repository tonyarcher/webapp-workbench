import { test, expect } from '@playwright/test';

async function startGame(page: import('@playwright/test').Page) {
  await page.goto('/');
  const startButton = page.getByTestId('start-game-button');
  await expect(startButton).toBeVisible();
  await page.getByTestId('away-team-input').fill('St. Louis Cardinals');
  await page.getByTestId('home-team-input').fill('Chicago Cubs');
  await startButton.click();
  await expect(page.getByTestId('local-game-state')).toBeVisible();
  return page.getByTestId('engine-state-badge');
}

test('undo and redo revert and re-apply recorded events', async ({ page }) => {
  const badge = await startGame(page);
  const undoButton = page.getByTestId('undo-button');
  const redoButton = page.getByTestId('redo-button');

  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeDisabled();

  await page.getByRole('button', { name: 'BALL', exact: true }).click();
  await expect(badge).toHaveText('Top 1 · 1 balls · 0 strikes · 0 outs');
  await page.getByRole('button', { name: 'STRIKE LOOKING' }).click();
  await expect(badge).toHaveText('Top 1 · 1 balls · 1 strikes · 0 outs');

  await expect(undoButton).toBeEnabled();
  await expect(redoButton).toBeDisabled();

  await undoButton.click();
  await expect(badge).toHaveText('Top 1 · 1 balls · 0 strikes · 0 outs');
  await expect(redoButton).toBeEnabled();

  await undoButton.click();
  await expect(badge).toHaveText('Top 1 · 0 balls · 0 strikes · 0 outs');
  await expect(undoButton).toBeDisabled();

  await redoButton.click();
  await expect(badge).toHaveText('Top 1 · 1 balls · 0 strikes · 0 outs');
  await redoButton.click();
  await expect(badge).toHaveText('Top 1 · 1 balls · 1 strikes · 0 outs');
  await expect(redoButton).toBeDisabled();
});

test('recording a new event after undo clears the redo history', async ({ page }) => {
  const badge = await startGame(page);
  const undoButton = page.getByTestId('undo-button');
  const redoButton = page.getByTestId('redo-button');

  await page.getByRole('button', { name: 'BALL', exact: true }).click();
  await page.getByRole('button', { name: 'STRIKE LOOKING' }).click();
  await undoButton.click();
  await expect(badge).toHaveText('Top 1 · 1 balls · 0 strikes · 0 outs');
  await expect(redoButton).toBeEnabled();

  await page.getByRole('button', { name: 'STRIKE SWINGING' }).click();
  await expect(badge).toHaveText('Top 1 · 1 balls · 1 strikes · 0 outs');
  await expect(redoButton).toBeDisabled();

  await undoButton.click();
  await expect(badge).toHaveText('Top 1 · 1 balls · 0 strikes · 0 outs');
});
