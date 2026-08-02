import { test, expect } from '@playwright/test';

test('starts a local game without contacting a server', async ({ page }) => {
  const allRequests: string[] = [];
  page.on('request', (request) => allRequests.push(request.url()));

  await page.goto('/');

  const startButton = page.getByTestId('start-game-button');
  await expect(startButton).toBeVisible();

  await page.getByTestId('away-team-input').fill('St. Louis Cardinals');
  await page.getByTestId('home-team-input').fill('Chicago Cubs');
  await startButton.click();

  await expect(page.getByTestId('local-game-state')).toBeVisible();
  await expect(page.getByText('Live Scoring: St. Louis Cardinals @ Chicago Cubs')).toBeVisible();

  const backendCalls = allRequests.filter((url) => url.includes('localhost:8080'));
  expect(backendCalls).toHaveLength(0);

  const badge = page.getByTestId('engine-state-badge');
  const eventLog = page.getByTestId('event-log-list');

  await expect(badge).toHaveText('Top 1 · 0 balls · 0 strikes · 0 outs');

  await page.getByRole('button', { name: 'BALL', exact: true }).click();
  await expect(eventLog).toContainText('BALL');
  await expect(eventLog.locator('li')).toHaveCount(1);
  await expect(badge).toHaveText('Top 1 · 1 balls · 0 strikes · 0 outs');

  await page.getByRole('button', { name: 'STRIKE LOOKING' }).click();
  await expect(badge).toHaveText('Top 1 · 1 balls · 1 strikes · 0 outs');

  await page.getByRole('button', { name: 'STRIKEOUT (K)' }).click();
  await expect(badge).toHaveText('Top 1 · 0 balls · 0 strikes · 1 outs');

  await page.getByRole('button', { name: 'WALK (BB)', exact: true }).click();
  await page.getByRole('button', { name: 'WALK (BB)', exact: true }).click();
  await page.getByRole('button', { name: 'WALK (BB)', exact: true }).click();
  await expect(badge).toHaveText('Top 1 · 0 balls · 0 strikes · 1 outs');

  await page.getByRole('button', { name: 'WALK (BB)', exact: true }).click();
  await expect(badge).toHaveText('Top 1 · 0 balls · 0 strikes · 1 outs');
  await expect(page.getByText('Cardinals - Scorebook Sheet')).toBeVisible();

  const awayLedScore = page.locator('baseball-scoreboard .team-led-score').nth(0);
  await expect(awayLedScore).toHaveText('1');

  await page.getByTestId('new-game-button').click();
  await expect(startButton).toBeVisible();
});
