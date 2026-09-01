import { expect } from '@esm-bundle/chai';
import '../src/scoring/baseball-action-grid.ts';
import '../src/scoring/baseball-matchup-card/baseball-matchup-card.ts';
import '../src/scoring/baseball-scorer-tab/baseball-scorer-tab.ts';
import '../src/scoring/baseball-scoring-controls/baseball-scoring-controls.ts';
import '../src/scoring/baseball-step2-panel/baseball-step2-panel.ts';
import { BaseballActionGrid } from '../src/scoring/baseball-action-grid.ts';
import { BaseballMatchupCard } from '../src/scoring/baseball-matchup-card/baseball-matchup-card.ts';
import { BaseballScorerTab } from '../src/scoring/baseball-scorer-tab/baseball-scorer-tab.ts';
import { BaseballScoringControls } from '../src/scoring/baseball-scoring-controls/baseball-scoring-controls.ts';
import { BaseballStep2Panel } from '../src/scoring/baseball-step2-panel/baseball-step2-panel.ts';

describe('Scoring Components', () => {
  describe('BaseballActionGrid', () => {
    let element: BaseballActionGrid;

    beforeEach(async () => {
      element = document.createElement('baseball-action-grid') as BaseballActionGrid;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders pitch selection and action buttons', () => {
      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('PITCH SELECTION');
      expect(shadow.textContent).to.include('PITCH RESULTS');
      expect(shadow.textContent).to.include('PLATE & IN-PLAY RESULTS');
      expect(shadow.textContent).to.include('BASERUNNING');
      expect(shadow.textContent).to.include('SB 2B');
      expect(shadow.textContent).to.include('SAC BUNT');
    });

    it('emits pitch-type-selected event when pitch type button is clicked', async () => {
      let pitchType = '';
      element.addEventListener('pitch-type-selected', (e: any) => {
        pitchType = e.detail?.pitchType || '';
      });

      const shadow = element.shadowRoot!;
      const buttons = shadow.querySelectorAll('.pitch-types-row button');
      (buttons[0] as HTMLElement).click();

      expect(pitchType).to.equal('Fastball');
    });

    it('emits trigger-scoring-event when outcome button is clicked', async () => {
      let eventType = '';
      element.addEventListener('trigger-scoring-event', (e: any) => {
        eventType = e.detail?.eventType || '';
      });

      const shadow = element.shadowRoot!;
      const ballBtn = shadow.querySelector('.btn-ball') as HTMLElement;
      ballBtn.click();

      expect(eventType).to.equal('BALL');
    });

    it('emits render-step2 when hit button is clicked', async () => {
      let step2Event = '';
      let step2Label = '';
      element.addEventListener('render-step2', (e: any) => {
        step2Event = e.detail?.eventType || '';
        step2Label = e.detail?.baseLabel || '';
      });

      const shadow = element.shadowRoot!;
      const singleBtn = shadow.querySelector('.btn-hit') as HTMLElement;
      singleBtn.click();

      expect(step2Event).to.equal('SINGLE');
      expect(step2Label).to.equal('Single (1B)');
    });
  });

  describe('BaseballMatchupCard', () => {
    let element: BaseballMatchupCard;

    beforeEach(async () => {
      element = document.createElement('baseball-matchup-card') as BaseballMatchupCard;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders matchup batter and pitcher info', async () => {
      element.setAttribute('batter-name', 'Aaron Judge');
      element.setAttribute('batter-stats', 'AVG .300 | 40 HR');
      element.setAttribute('pitcher-name', 'Gerrit Cole');
      element.setAttribute('pitcher-stats', 'ERA 2.80 | 200 K');
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Aaron Judge');
      expect(shadow.textContent).to.include('Gerrit Cole');
    });
  });

  describe('BaseballStep2Panel', () => {
    let element: BaseballStep2Panel;

    beforeEach(async () => {
      element = document.createElement('baseball-step2-panel') as BaseballStep2Panel;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders location grid based on is-hit property', async () => {
      element.setAttribute('base-label', 'Double (2B)');
      element.setAttribute('is-hit', 'true');
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Left Field');
      expect(shadow.textContent).to.include('Center Field');
    });

    it('emits location-selected when location button is clicked', async () => {
      element.setAttribute('is-hit', 'true');
      await element.updateComplete;

      let selectedLocation: string | null = null;
      element.addEventListener('location-selected', (e: any) => {
        selectedLocation = e.detail?.location;
      });

      const shadow = element.shadowRoot!;
      const locBtn = shadow.querySelector('.btn-action') as HTMLElement;
      locBtn.click();

      expect(selectedLocation).to.equal('Left Field');
    });

    it('emits cancel-step2 when cancel button is clicked', async () => {
      let cancelled = false;
      element.addEventListener('cancel-step2', () => {
        cancelled = true;
      });

      const shadow = element.shadowRoot!;
      const cancelBtn = shadow.querySelector('.btn-secondary') as HTMLElement;
      cancelBtn.click();

      expect(cancelled).to.be.true;
    });

    it('shows the double play toggle only when double-play-available is set', async () => {
      element.setAttribute('base-label', 'Groundout');
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('.double-play-toggle')).to.be.null;

      element.setAttribute('double-play-available', 'true');
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('.double-play-toggle')).to.not.be.null;
    });

    it('emits doublePlay in location-selected when the toggle is checked', async () => {
      element.setAttribute('double-play-available', 'true');
      await element.updateComplete;

      let emitted = false;
      element.addEventListener('location-selected', (e: any) => {
        emitted = e.detail?.doublePlay === true;
      });

      const shadow = element.shadowRoot!;
      const checkbox = shadow.querySelector('.double-play-toggle input') as HTMLInputElement;
      checkbox.click();
      const locBtn = shadow.querySelector('.btn-action') as HTMLElement;
      locBtn.click();

      expect(emitted).to.be.true;
    });
  });

  describe('BaseballScoringControls', () => {
    let element: BaseballScoringControls;

    beforeEach(async () => {
      element = document.createElement('baseball-scoring-controls') as BaseballScoringControls;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders active scoring mode by default', () => {
      const shadow = element.shadowRoot!;
      expect(shadow.querySelector('baseball-matchup-card')).to.not.be.null;
      expect(shadow.querySelector('baseball-action-grid')).to.not.be.null;
    });

    it('renders completed game mode when game-status is completed', async () => {
      element.setAttribute('game-status', 'completed');
      element.setAttribute('away-name', 'Cubs');
      element.setAttribute('home-name', 'Cardinals');
      element.setAttribute('away-score', '6');
      element.setAttribute('home-score', '4');
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('GAME COMPLETED');
      expect(shadow.textContent).to.include('Final: Cubs 6, Cardinals 4');
    });

    it('emits view-boxscore from completed state', async () => {
      element.setAttribute('game-status', 'completed');
      await element.updateComplete;

      let viewed = false;
      element.addEventListener('view-boxscore', () => { viewed = true; });

      const shadow = element.shadowRoot!;
      const viewBtn = Array.from(shadow.querySelectorAll('.btn')).find(btn => btn.textContent?.includes('View Final Box Score')) as HTMLElement;
      viewBtn.click();

      expect(viewed).to.be.true;
    });
  });

  describe('BaseballScorerTab', () => {
    let element: BaseballScorerTab;

    beforeEach(async () => {
      element = document.createElement('baseball-scorer-tab') as BaseballScorerTab;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders live scoring header and slots', async () => {
      element.setAttribute('away-name', 'Cubs');
      element.setAttribute('home-name', 'Sox');
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Live Scoring: Cubs @ Sox');
    });

    it('displays empty state when no-game attribute is set', async () => {
      element.setAttribute('no-game', 'true');
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('No active game scoring session');
    });

    it('emits start-new-game-click from empty state button', async () => {
      element.setAttribute('no-game', 'true');
      await element.updateComplete;

      let started = false;
      element.addEventListener('start-new-game-click', () => { started = true; });

      const shadow = element.shadowRoot!;
      const startBtn = shadow.querySelector('.btn-primary') as HTMLElement;
      startBtn.click();

      expect(started).to.be.true;
    });

    it('emits open-lineup-setup-click from setup lineups button', async () => {
      element.setAttribute('away-name', 'Cubs');
      element.setAttribute('home-name', 'Sox');
      await element.updateComplete;

      let opened = false;
      element.addEventListener('open-lineup-setup-click', () => { opened = true; });

      const shadow = element.shadowRoot!;
      const setupBtn = Array.from(shadow.querySelectorAll('.btn-secondary')).find(btn => btn.textContent?.includes('Setup Lineups')) as HTMLElement;
      setupBtn.click();

      expect(opened).to.be.true;
    });
  });

  describe('Shadow DOM event boundary regression', () => {
    it('crosses the action-grid shadow boundary to an outer host listener', async () => {
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      document.body.appendChild(host);

      const grid = document.createElement('baseball-action-grid') as BaseballActionGrid;
      shadow.appendChild(grid);
      await grid.updateComplete;

      let received: string | null = null;
      host.addEventListener('trigger-scoring-event', (e: Event) => {
        received = (e as CustomEvent).detail?.eventType ?? null;
      });

      const ballBtn = grid.shadowRoot!.querySelector('.btn-ball') as HTMLElement;
      ballBtn.click();

      expect(received).to.equal('BALL');
      host.remove();
    });

    it('crosses action-grid and scoring-controls shadow roots to a document listener', async () => {
      const controls = document.createElement('baseball-scoring-controls') as BaseballScoringControls;
      document.body.appendChild(controls);
      await controls.updateComplete;

      let received: string | null = null;
      const handler = (e: Event) => {
        received = (e as CustomEvent).detail?.eventType ?? null;
      };
      document.body.addEventListener('trigger-scoring-event', handler);

      const actionGrid = controls.shadowRoot!.querySelector('baseball-action-grid') as BaseballActionGrid;
      const ballBtn = actionGrid.shadowRoot!.querySelector('.btn-ball') as HTMLElement;
      ballBtn.click();

      expect(received).to.equal('BALL');
      document.body.removeEventListener('trigger-scoring-event', handler);
      controls.remove();
    });

    it('reaches a document listener with render-step2 detail', async () => {
      const controls = document.createElement('baseball-scoring-controls') as BaseballScoringControls;
      document.body.appendChild(controls);
      await controls.updateComplete;

      let receivedEventType = '';
      let receivedLabel = '';
      const handler = (e: Event) => {
        receivedEventType = (e as CustomEvent).detail?.eventType ?? '';
        receivedLabel = (e as CustomEvent).detail?.baseLabel ?? '';
      };
      document.body.addEventListener('render-step2', handler);

      const actionGrid = controls.shadowRoot!.querySelector('baseball-action-grid') as BaseballActionGrid;
      const singleBtn = actionGrid.shadowRoot!.querySelector('.btn-hit') as HTMLElement;
      singleBtn.click();

      expect(receivedEventType).to.equal('SINGLE');
      expect(receivedLabel).to.equal('Single (1B)');
      document.body.removeEventListener('render-step2', handler);
      controls.remove();
    });
  });
});
