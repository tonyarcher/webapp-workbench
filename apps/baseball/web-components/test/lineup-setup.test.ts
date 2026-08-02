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
    expect(shadow.textContent).to.include('#3 Brendan Donovan');
    expect(shadow.textContent).to.include('#2 Nico Hoerner');
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
