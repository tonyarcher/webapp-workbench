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

  await page.getByRole('button', { name: 'BALL', exact: true }).click();
  await expect(page.getByTestId('event-log-list')).toContainText('trigger-scoring-event');
  await expect(page.getByTestId('event-log-list')).toContainText('BALL');

  await page.getByTestId('new-game-button').click();
  await expect(startButton).toBeVisible();
});
