import { expect } from '@esm-bundle/chai';
import '../src/layout/baseball-nav-bar/baseball-nav-bar.ts';
import '../src/layout/baseball-tab-page-wrapper/baseball-tab-page-wrapper.ts';
import { BaseballNavBar } from '../src/layout/baseball-nav-bar/baseball-nav-bar.ts';
import { BaseballTabPageWrapper } from '../src/layout/baseball-tab-page-wrapper/baseball-tab-page-wrapper.ts';

describe('Layout Components', () => {
  describe('BaseballNavBar', () => {
    let element: BaseballNavBar;

    beforeEach(async () => {
      element = document.createElement('baseball-nav-bar') as BaseballNavBar;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders logo and navigation items', () => {
      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('GRAND SLAM BASEBALL');
      expect(shadow.textContent).to.include('Live Scorer');
      expect(shadow.textContent).to.include('Leagues');
    });

    it('displays active tab correctly', async () => {
      element.setAttribute('active-tab', 'teams');
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      const activeBtn = shadow.querySelector('.nav-item.active');
      expect(activeBtn).to.not.be.null;
      expect(activeBtn!.textContent).to.include('Teams');
    });

    it('displays user name when user-name attribute is set', async () => {
      element.setAttribute('user-name', 'Tony');
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Tony');
    });

    it('emits tab-selected event when a nav button is clicked', async () => {
      let selectedTab = '';
      element.addEventListener('tab-selected', (e: Event) => {
        const target = e.target as HTMLElement;
        selectedTab = target.getAttribute('active-tab') || '';
      });

      const shadow = element.shadowRoot!;
      const navBtns = shadow.querySelectorAll('.nav-item');
      const teamsBtn = Array.from(navBtns).find(btn => btn.textContent?.includes('Teams')) as HTMLElement;
      teamsBtn.click();
      await element.updateComplete;

      expect(selectedTab).to.equal('teams');
    });
  });

  describe('BaseballTabPageWrapper', () => {
    let element: BaseballTabPageWrapper;

    beforeEach(async () => {
      element = document.createElement('baseball-tab-page-wrapper') as BaseballTabPageWrapper;
      document.body.appendChild(element);
      await element.updateComplete;
    });

    afterEach(() => {
      element.remove();
    });

    it('renders page-title when attribute is set', async () => {
      element.setAttribute('page-title', 'Team Rosters');
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Team Rosters');
    });

    it('renders loading message when loading-message attribute is set', async () => {
      element.setAttribute('loading-message', 'Loading data...');
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('Loading data...');
    });

    it('renders empty message when empty-message attribute is set', async () => {
      element.setAttribute('empty-message', 'No items found');
      await element.updateComplete;

      const shadow = element.shadowRoot!;
      expect(shadow.textContent).to.include('No items found');
    });
  });
});
