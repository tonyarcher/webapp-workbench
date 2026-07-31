import { expect } from '@esm-bundle/chai';
import '../src/leagues/baseball-league-card/baseball-league-card.ts';
import '../src/leagues/baseball-leagues-tab/baseball-leagues-tab.ts';
import '../src/lineup/baseball-lineup-setup/baseball-lineup-setup.ts';
import '../src/welcome/baseball-welcome-screen/baseball-welcome-screen.ts';
import { BaseballLeagueCard } from '../src/leagues/baseball-league-card/baseball-league-card.ts';
import { BaseballLeaguesTab } from '../src/leagues/baseball-leagues-tab/baseball-leagues-tab.ts';
import { BaseballLineupSetup } from '../src/lineup/baseball-lineup-setup/baseball-lineup-setup.ts';
import { BaseballWelcomeScreen } from '../src/welcome/baseball-welcome-screen/baseball-welcome-screen.ts';

describe('Leagues, Lineup & Welcome Components', () => {
  describe('BaseballLeagueCard', () => {
    let element: BaseballLeagueCard;

    beforeEach(async () => {
      element = document.createElement('baseball-league-card') as BaseballLeagueCard;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders league card properties', async () => {
      element.setAttribute('league-name', 'Major League');
      element.setAttribute('league-details', 'Season 2026');
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Major League');
      expect(shadow.textContent).to.include('Season 2026');
    });
  });

  describe('BaseballLeaguesTab', () => {
    let element: BaseballLeaguesTab;

    beforeEach(async () => {
      element = document.createElement('baseball-leagues-tab') as BaseballLeaguesTab;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders empty state when leagues array is empty', async () => {
      element.setAttribute('leagues-json', '[]');
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('No leagues available');
    });

    it('renders league cards from leagues-json attribute', async () => {
      const leagues = [{ id: 1, name: 'National League' }, { id: 2, name: 'American League' }];
      element.setAttribute('leagues-json', JSON.stringify(leagues));
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      const cards = shadow.querySelectorAll('baseball-league-card');
      expect(cards.length).to.equal(2);
      expect(cards[0].getAttribute('league-name')).to.equal('National League');
      expect(cards[1].getAttribute('league-name')).to.equal('American League');
    });
  });

  describe('BaseballLineupSetup', () => {
    let element: BaseballLineupSetup;

    beforeEach(async () => {
      element = document.createElement('baseball-lineup-setup') as BaseballLineupSetup;
      element.setAttribute('is-open', 'true');
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders team lineup slot headers', () => {
      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Lineup & Bench Setup');
    });

    it('emits close-lineup-setup on close and cancel button click', async () => {
      let closed = false;
      element.addEventListener('close-lineup-setup', () => { closed = true; });

      const shadow = element.shadowRoot!;
      const cancelBtn = shadow.querySelector('.btn-secondary') as HTMLElement;
      cancelBtn.click();
      expect(closed).to.be.true;
    });

    it('emits save-lineup-setup on confirm button click', async () => {
      let saved = false;
      element.addEventListener('save-lineup-setup', () => { saved = true; });

      const shadow = element.shadowRoot!;
      const saveBtn = shadow.querySelector('.btn-primary') as HTMLElement;
      saveBtn.click();
      expect(saved).to.be.true;
    });
  });

  describe('BaseballWelcomeScreen', () => {
    let element: BaseballWelcomeScreen;

    beforeEach(async () => {
      element = document.createElement('baseball-welcome-screen') as BaseballWelcomeScreen;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders welcome modes and title', () => {
      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('GRAND SLAM BASEBALL');
      expect(shadow.textContent).to.include('Single Game Mode');
      expect(shadow.textContent).to.include('League & Season Mode');
    });

    it('emits mode-selected event when mode card is clicked', async () => {
      let selectedMode = '';
      element.addEventListener('mode-selected', (e: Event) => {
        const target = e.target as HTMLElement;
        selectedMode = target.getAttribute('selected-mode') || '';
      });

      const shadow = element.shadowRoot!;
      const cards = shadow.querySelectorAll('.mode-card');
      (cards[0] as HTMLElement).click();

      expect(selectedMode).to.equal('single');
    });
  });
});
