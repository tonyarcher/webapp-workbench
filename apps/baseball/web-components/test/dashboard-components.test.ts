import { expect } from '@esm-bundle/chai';
import '../src/dashboard/baseball-dashboard-tab/baseball-dashboard-tab.ts';
import '../src/dashboard/baseball-schedule-list/baseball-schedule-list.ts';
import '../src/dashboard/baseball-standings-table/baseball-standings-table.ts';
import { BaseballDashboardTab } from '../src/dashboard/baseball-dashboard-tab/baseball-dashboard-tab.ts';
import { BaseballScheduleList } from '../src/dashboard/baseball-schedule-list/baseball-schedule-list.ts';
import { BaseballStandingsTable } from '../src/dashboard/baseball-standings-table/baseball-standings-table.ts';

describe('Dashboard Components', () => {
  describe('BaseballDashboardTab', () => {
    let element: BaseballDashboardTab;

    beforeEach(async () => {
      element = document.createElement('baseball-dashboard-tab') as BaseballDashboardTab;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders dashboard header by default', () => {
      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Season Dashboard');
    });

    it('displays error message when error-message attribute is set', async () => {
      element.setAttribute('error-message', 'Failed to connect');
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Failed to connect');
    });

    it('displays no-season message when no-season attribute is true', async () => {
      element.setAttribute('no-season', 'true');
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('No season selected');
    });
  });

  describe('BaseballScheduleList', () => {
    let element: BaseballScheduleList;

    beforeEach(async () => {
      element = document.createElement('baseball-schedule-list') as BaseballScheduleList;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders schedule games from games-json attribute', async () => {
      const games = [
        {
          id: 1,
          awayTeam: { name: 'Cubs' },
          homeTeam: { name: 'Cardinals' },
          awayScore: 4,
          homeScore: 3,
          status: 'COMPLETED',
          scheduledDate: '2026-08-01'
        }
      ];
      element.setAttribute('games-json', JSON.stringify(games));
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Cubs');
      expect(shadow.textContent).to.include('Cardinals');
    });
  });

  describe('BaseballStandingsTable', () => {
    let element: BaseballStandingsTable;

    beforeEach(async () => {
      element = document.createElement('baseball-standings-table') as BaseballStandingsTable;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders standings from standings-json attribute', async () => {
      const standings = [
        { teamName: 'Cubs', wins: 10, losses: 2, winPercentage: 0.833, gamesBehind: '0.0' }
      ];
      element.setAttribute('standings-json', JSON.stringify(standings));
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Cubs');
      expect(shadow.textContent).to.include('10');
      expect(shadow.textContent).to.include('2');
    });
  });
});
