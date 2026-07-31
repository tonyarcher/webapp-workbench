import { expect } from '@esm-bundle/chai';
import '../src/scorebook/baseball-defense-diagram/baseball-defense-diagram.ts';
import '../src/scorebook/baseball-scorebook-grid.ts';
import '../src/stats/baseball-stats-table.ts';
import '../src/teams/baseball-roster-table/baseball-roster-table.ts';
import { BaseballDefenseDiagram } from '../src/scorebook/baseball-defense-diagram/baseball-defense-diagram.ts';
import { BaseballScorebookGrid } from '../src/scorebook/baseball-scorebook-grid.ts';
import { BaseballStatsTable } from '../src/stats/baseball-stats-table.ts';
import { BaseballRosterTable } from '../src/teams/baseball-roster-table/baseball-roster-table.ts';

describe('Scorebook, Stats & Teams Components', () => {
  describe('BaseballDefenseDiagram', () => {
    let element: BaseballDefenseDiagram;

    beforeEach(async () => {
      element = document.createElement('baseball-defense-diagram') as BaseballDefenseDiagram;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders field position labels', () => {
      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Defensive Alignment');
    });
  });

  describe('BaseballScorebookGrid', () => {
    let element: BaseballScorebookGrid;

    beforeEach(async () => {
      element = document.createElement('baseball-scorebook-grid') as BaseballScorebookGrid;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders scorecard grid headers and team info', async () => {
      element.setAttribute('team-name', 'Chicago Cubs');
      element.setAttribute('pitcher-opponent', 'St. Louis Cardinals');
      element.setAttribute('half-tag', 'TOP');
      element.setAttribute('max-inning', '9');

      const slots = [
        {
          slotIdx: 1,
          batterName: 'Nico Hoerner',
          position: '2B',
          atBats: 4,
          runs: 1,
          hits: 2,
          rbi: 1,
          innings: {
            1: { notation: '1B', base: 1, outNum: 1, count: '2-1', hasEndedInningLine: true }
          }
        }
      ];
      element.setAttribute('slots-json', JSON.stringify(slots));
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Chicago Cubs');
      expect(shadow.textContent).to.include('Nico Hoerner');
      expect(shadow.textContent).to.include('1B');
      expect(shadow.textContent).to.include('2-1');
    });
  });

  describe('BaseballStatsTable', () => {
    let element: BaseballStatsTable;

    beforeEach(async () => {
      element = document.createElement('baseball-stats-table') as BaseballStatsTable;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders player batting statistics table', async () => {
      const rows = [
        { playerName: 'Ian Happ', teamName: 'Cubs', games: 50, stat1: '.280', stat2: '12', stat3: '45' }
      ];
      element.setAttribute('rows-json', JSON.stringify(rows));
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Ian Happ');
      expect(shadow.textContent).to.include('.280');
      expect(shadow.textContent).to.include('12');
      expect(shadow.textContent).to.include('45');
    });
  });

  describe('BaseballRosterTable', () => {
    let element: BaseballRosterTable;

    beforeEach(async () => {
      element = document.createElement('baseball-roster-table') as BaseballRosterTable;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders team player roster', async () => {
      element.setAttribute('team-name', 'Cubs');
      const players = [
        { id: 1, name: 'Justin Steele', position: 'P', jerseyNumber: 35, battingHand: 'L', throwingHand: 'L' }
      ];
      element.setAttribute('players-json', JSON.stringify(players));
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Justin Steele');
      expect(shadow.textContent).to.include('#35');
      expect(shadow.textContent).to.include('P');
    });
  });
});
