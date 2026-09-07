import { test, expect } from '@playwright/test';

test('generates teams and watches a simulated game', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/');

  await page.getByTestId('generate-teams-button').click();
  await expect(page.getByTestId('home-team-input')).not.toHaveValue('Chicago Cubs');
  await expect(page.getByTestId('away-team-input')).not.toHaveValue('St. Louis Cardinals');

  await page.getByTestId('watch-game-button').click();

  await expect(page.getByTestId('sim-transport')).toBeVisible();
  await expect(page.getByTestId('sim-badge')).toHaveText('SIMULATING');
  await expect(page.getByTestId('watch-title')).toHaveText(/Watching:/);
  await expect(page.getByTestId('plate-view')).toBeVisible();
  await expect(page.getByTestId('defense-diagram')).toBeVisible();

  await expect(page.getByTestId('event-log-list').locator('li').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('active-play')).toContainText('eventType');
  await expect(page.getByTestId('plate-result')).toHaveText(/BALL|STRIKE|FOUL|IN PLAY|OUT/, { timeout: 15000 });

  await page.getByTestId('sim-pause-button').click();
  await expect(page.getByTestId('sim-badge')).toHaveText('PAUSED');
  const pausedCount = await page.getByTestId('event-log-list').locator('li').count();
  await page.waitForTimeout(700);
  expect(await page.getByTestId('event-log-list').locator('li').count()).toBe(pausedCount);

  await page.getByTestId('sim-speed-select').selectOption('0');
  await page.getByTestId('sim-play-button').click();
  await expect(page.getByTestId('engine-state-badge')).toContainText('FINAL', { timeout: 40000 });
  await expect(page.getByTestId('sim-badge')).toHaveText('FINAL');
});
