import { expect } from '@esm-bundle/chai';
import '../src/lineup/baseball-lineup-setup/baseball-lineup-setup.ts';
import { BaseballLineupSetup } from '../src/lineup/baseball-lineup-setup/baseball-lineup-setup.ts';

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

  it('renders player slots from lineup json attributes', async () => {
    element.setAttribute('away-team-name', 'Cardinals');
    element.setAttribute('home-team-name', 'Cubs');
    element.setAttribute('away-lineup-json', JSON.stringify([{ id: 1, name: 'Brendan Donovan', jerseyNumber: 3, position: 'LF' }]));
    element.setAttribute('home-lineup-json', JSON.stringify([{ id: 2, name: 'Nico Hoerner', jerseyNumber: 2, position: '2B' }]));
    await element.updateComplete;

    const shadow = element.shadowRoot!;
    const awayName = shadow.querySelector('[data-testid="away-slot-1-name"]') as HTMLInputElement;
    const homeName = shadow.querySelector('[data-testid="home-slot-1-name"]') as HTMLInputElement;
    expect(awayName.value).to.equal('Brendan Donovan');
    expect(homeName.value).to.equal('Nico Hoerner');
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
    element.setAttribute(
      'away-lineup-json',
      JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: `Away ${i + 1}`, jerseyNumber: i + 1, position: 'DH' })))
    );
    element.setAttribute(
      'home-lineup-json',
      JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: `Home ${i + 1}`, jerseyNumber: i + 1, position: 'DH' })))
    );
    await element.updateComplete;

    let savedName = '';
    element.addEventListener('save-lineup-setup', ((event: CustomEvent) => {
      savedName = event.detail?.awayLineup?.[0]?.name ?? '';
    }) as EventListener);

    const saveBtn = element.shadowRoot!.querySelector('[data-testid="lineup-save-button"]') as HTMLElement;
    saveBtn.click();
    expect(savedName).to.equal('Away 1');
  });

  it('lets a scorer edit a batter name before saving', async () => {
    element.setAttribute(
      'away-lineup-json',
      JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: `Away ${i + 1}`, jerseyNumber: i + 1, position: 'RF' })))
    );
    element.setAttribute(
      'home-lineup-json',
      JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: `Home ${i + 1}`, jerseyNumber: i + 1, position: '2B' })))
    );
    await element.updateComplete;

    const nameInput = element.shadowRoot!.querySelector('[data-testid="away-slot-1-name"]') as HTMLInputElement;
    nameInput.value = 'Tony Gwynn';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await element.updateComplete;

    let savedName = '';
    element.addEventListener('save-lineup-setup', ((event: CustomEvent) => {
      savedName = event.detail?.awayLineup?.[0]?.name ?? '';
    }) as EventListener);
    (element.shadowRoot!.querySelector('[data-testid="lineup-save-button"]') as HTMLElement).click();
    expect(savedName).to.equal('Tony Gwynn');
  });

  it('renders nothing when is-open is not set', async () => {
    element.removeAttribute('is-open');
    await element.updateComplete;
    expect(element.shadowRoot!.textContent).to.equal('');
  });

  it('is hidden and never intercepts pointer events when closed', async () => {
    element.removeAttribute('is-open');
    await element.updateComplete;
    expect(getComputedStyle(element).display).to.equal('none');
  });

  it('becomes a full-screen overlay only when open', async () => {
    element.setAttribute('is-open', '');
    await element.updateComplete;
    const styles = getComputedStyle(element);
    expect(styles.display).to.equal('flex');
    expect(styles.position).to.equal('fixed');
    expect(styles.zIndex).to.equal('1000');
  });
});
