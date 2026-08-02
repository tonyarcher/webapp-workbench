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

    it('renders a run dot and RBI badge on a scoring cell', async () => {
      element.setAttribute('max-inning', '9');

      const slots = [
        {
          slotIdx: 1,
          batterName: 'Ian Happ',
          position: 'LF',
          innings: {
            1: { notation: 'HR', base: 0, run: true, rbiCount: 2 }
          }
        }
      ];
      element.setAttribute('slots-json', JSON.stringify(slots));
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.querySelector('.run-dot')).to.not.be.null;
      expect(shadow.textContent).to.include('RBI 2');
    });

    it('omits run marks when the cell did not score', async () => {
      element.setAttribute('max-inning', '9');

      const slots = [
        {
          slotIdx: 1,
          batterName: 'Ian Happ',
          position: 'LF',
          innings: {
            1: { notation: 'GO', base: 0, outNum: 1, run: false }
          }
        }
      ];
      element.setAttribute('slots-json', JSON.stringify(slots));
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.querySelector('.run-dot')).to.be.null;
    });

    it('renders basepath arcs for runner advancements', async () => {
      element.setAttribute('max-inning', '9');

      const slots = [
        {
          slotIdx: 1,
          batterName: 'Dansby Swanson',
          position: 'SS',
          innings: {
            1: {
              notation: '3B',
              base: 3,
              advancements: [
                { from: 1, to: 3, scored: false },
                { from: 2, to: 4, scored: true }
              ]
            }
          }
        }
      ];
      element.setAttribute('slots-json', JSON.stringify(slots));
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      const svg = shadow.querySelector('.advancement-svg');
      expect(svg).to.not.be.null;
      expect(svg!.querySelectorAll('line.advancement-line')).to.have.length(2);
      expect(shadow.querySelector('line.advancement-line.scored')).to.not.be.null;
    });

    it('renders no arcs when a cell has no advancements', async () => {
      element.setAttribute('max-inning', '9');

      const slots = [
        {
          slotIdx: 1,
          batterName: 'Nico Hoerner',
          position: '2B',
          innings: { 1: { notation: 'K', base: 0 } }
        }
      ];
      element.setAttribute('slots-json', JSON.stringify(slots));
      await element.updateComplete;

      expect(element.shadowRoot!.querySelector('.advancement-svg')).to.be.null;
    });
  });
});
