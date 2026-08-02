import { expect } from '@esm-bundle/chai';
import '../src/scorebook/baseball-defense-diagram/baseball-defense-diagram.ts';
import '../src/scorebook/baseball-scorebook-grid.ts';
import { BaseballDefenseDiagram } from '../src/scorebook/baseball-defense-diagram/baseball-defense-diagram.ts';
import { BaseballScorebookGrid } from '../src/scorebook/baseball-scorebook-grid.ts';

describe('Scorebook Components', () => {
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
});
