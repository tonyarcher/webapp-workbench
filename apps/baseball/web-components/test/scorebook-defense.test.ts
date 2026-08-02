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
      expect(shadow.querySelector('.diamond.scored')).to.not.be.null;
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

    describe('base-path line rendering', () => {
      async function renderCell(cell: Record<string, unknown>): Promise<HTMLElement> {
        element.setAttribute('max-inning', '9');
        element.setAttribute('slots-json', JSON.stringify([
          {
            slotIdx: 1,
            batterName: 'Ian Happ',
            position: 'LF',
            innings: { 1: cell }
          }
        ]));
        await element.updateComplete;
        return element.shadowRoot!.querySelector('.diamond') as HTMLElement;
      }

      function borderColors(before: CSSStyleDeclaration): Record<string, string> {
        return {
          top: before.borderTopColor,
          right: before.borderRightColor,
          bottom: before.borderBottomColor,
          left: before.borderLeftColor,
        };
      }

      const RED = 'rgb(255, 42, 59)';
      const GRAY = 'rgb(156, 147, 132)';

      it('draws only the home-to-first edge for a single', async () => {
        const diamond = await renderCell({ notation: '1B', base: 1 });
        const colors = borderColors(getComputedStyle(diamond, '::before'));
        expect(colors.right).to.equal(RED);
        expect(colors.top).to.equal(GRAY);
        expect(colors.bottom).to.equal(GRAY);
        expect(colors.left).to.equal(GRAY);
      });

      it('draws the home-to-second path for a double', async () => {
        const diamond = await renderCell({ notation: '2B', base: 2 });
        const colors = borderColors(getComputedStyle(diamond, '::before'));
        expect(colors.right).to.equal(RED);
        expect(colors.top).to.equal(RED);
        expect(colors.bottom).to.equal(GRAY);
        expect(colors.left).to.equal(GRAY);
      });

      it('draws the home-to-third path for a triple', async () => {
        const diamond = await renderCell({ notation: '3B', base: 3 });
        const colors = borderColors(getComputedStyle(diamond, '::before'));
        expect(colors.right).to.equal(RED);
        expect(colors.top).to.equal(RED);
        expect(colors.left).to.equal(RED);
        expect(colors.bottom).to.equal(GRAY);
      });

      it('fills the full diamond for a home run', async () => {
        const diamond = await renderCell({ notation: 'HR', base: 4, run: true });
        const colors = borderColors(getComputedStyle(diamond, '::before'));
        expect(colors.right).to.equal(RED);
        expect(colors.top).to.equal(RED);
        expect(colors.left).to.equal(RED);
        expect(colors.bottom).to.equal(RED);
      });

      it('leaves the diamond unhighlighted for an out', async () => {
        const diamond = await renderCell({ notation: 'K', base: 0 });
        const colors = borderColors(getComputedStyle(diamond, '::before'));
        expect(colors.top).to.equal(GRAY);
        expect(colors.right).to.equal(GRAY);
        expect(colors.bottom).to.equal(GRAY);
        expect(colors.left).to.equal(GRAY);
      });
    });

    describe('advancement arc coordinates', () => {
      it('maps runner advancements onto the correct diamond vertices', async () => {
        element.setAttribute('max-inning', '9');

        const slots = [
          {
            slotIdx: 1,
            batterName: 'Dansby Swanson',
            position: 'SS',
            innings: {
              1: {
                notation: '2B',
                base: 2,
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

        const lines = Array.from(element.shadowRoot!.querySelectorAll('line.advancement-line'));
        expect(lines).to.have.length(2);

        for (const line of lines) {
          expect(line.namespaceURI, 'advancement lines must be SVG-namespaced').to.equal('http://www.w3.org/2000/svg');
          expect(line.getBBox, 'advancement lines must be real SVG elements').to.be.a('function');
        }

        const firstToThird = lines[0];
        expect(firstToThird.getAttribute('x1')).to.equal('46');
        expect(firstToThird.getAttribute('y1')).to.equal('26');
        expect(firstToThird.getAttribute('x2')).to.equal('6');
        expect(firstToThird.getAttribute('y2')).to.equal('26');

        const scoring = lines[1];
        expect(scoring.classList.contains('scored')).to.be.true;
        expect(scoring.getAttribute('x1')).to.equal('26');
        expect(scoring.getAttribute('y1')).to.equal('6');
        expect(scoring.getAttribute('x2')).to.equal('26');
        expect(scoring.getAttribute('y2')).to.equal('46');
      });
    });
  });
});
