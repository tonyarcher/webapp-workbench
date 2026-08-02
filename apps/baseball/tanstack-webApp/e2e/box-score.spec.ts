import { test, expect } from '@playwright/test';

const SAVE_KEY = 'baseball.local-game.v1';

function row(
  slotIdx: number,
  batterName: string,
  position: string,
  atBats: number,
  runs: number,
  hits: number,
  rbi: number,
  walks: number
) {
  return { slotIdx, batterName, position, atBats, runs, hits, rbi, walks, innings: {} };
}

const completedGame = {
  version: 4,
  savedAt: new Date().toISOString(),
  setup: { homeTeamName: 'Chicago Cubs', awayTeamName: 'St. Louis Cardinals', innings: 9 },
  engine: {
    awayLineup: {
      name: 'St. Louis Cardinals',
      rows: [
        row(1, 'Brendan Donovan', '2B', 4, 1, 1, 0, 1),
        row(2, 'Paul Goldschmidt', '1B', 4, 0, 2, 1, 0),
        row(3, 'Nolan Arenado', '3B', 3, 1, 0, 0, 1),
      ],
    },
    homeLineup: {
      name: 'Chicago Cubs',
      rows: [
        row(1, 'Nico Hoerner', '2B', 4, 1, 1, 0, 0),
        row(2, 'Dansby Swanson', 'SS', 4, 0, 1, 1, 1),
        row(3, 'Ian Happ', 'LF', 4, 2, 2, 2, 0),
      ],
    },
    inning: 10,
    half: 'TOP',
    balls: 0,
    strikes: 0,
    outs: 0,
    awayScore: 2,
    homeScore: 3,
    runners: [false, false, false],
    runnerSlots: [null, null, null],
    awayBatterIdx: 0,
    homeBatterIdx: 0,
    awayRunsByInning: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    homeRunsByInning: [0, 0, 0, 0, 0, 0, 0, 0, 1, 2],
    awayErrors: 1,
    homeErrors: 0,
    totalInnings: 9,
    over: true,
  },
  historyIndex: 0,
  events: [],
};

async function seedCompletedGame(page: import('@playwright/test').Page) {
  await page.addInitScript(([key, data]) => {
    localStorage.setItem(key, JSON.stringify(data));
  }, [SAVE_KEY, completedGame] as const);
}

test('shows a final box score for a completed game', async ({ page }) => {
  await seedCompletedGame(page);
  await page.goto('/');

  await expect(page.getByTestId('local-game-state')).toBeVisible();
  await expect(page.getByTestId('engine-state-badge')).toHaveText('10 inn · FINAL · Away 2 · Home 3');
  await expect(page.getByText(/GAME COMPLETED/)).toBeVisible();
  await expect(page.getByText('Final: St. Louis Cardinals 2, Chicago Cubs 3')).toBeVisible();

  await page.getByTestId('box-score-button').click();
  const modal = page.getByTestId('box-score-modal');
  await expect(modal).toBeVisible();

  await expect(page.getByTestId('runs-St. Louis Cardinals')).toHaveText('2');
  await expect(page.getByTestId('hits-St. Louis Cardinals')).toHaveText('3');
  await expect(page.getByTestId('errors-St. Louis Cardinals')).toHaveText('1');
  await expect(page.getByTestId('runs-Chicago Cubs')).toHaveText('3');
  await expect(page.getByTestId('hits-Chicago Cubs')).toHaveText('4');
  await expect(page.getByTestId('errors-Chicago Cubs')).toHaveText('0');

  await expect(page.getByTestId('inning-St. Louis Cardinals-1')).toHaveText('1');
  await expect(page.getByTestId('inning-St. Louis Cardinals-10')).toHaveText('0');
  await expect(page.getByTestId('inning-Chicago Cubs-9')).toHaveText('1');
  await expect(page.getByTestId('inning-Chicago Cubs-10')).toHaveText('2');

  await expect(page.getByTestId('batting-table-St. Louis Cardinals')).toContainText('Brendan Donovan');
  await expect(page.getByTestId('batting-table-Chicago Cubs')).toContainText('Ian Happ');

  await page.getByTestId('close-box-score-button').click();
  await expect(modal).toBeHidden();
});

test('opens the box score from the completed controls', async ({ page }) => {
  await seedCompletedGame(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'View Final Box Score' }).click();
  await expect(page.getByTestId('box-score-modal')).toBeVisible();
});
