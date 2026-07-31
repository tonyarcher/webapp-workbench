import { expect } from '@esm-bundle/chai';
import '../src/auth/baseball-auth-card/baseball-auth-card.ts';
import { BaseballAuthCard } from '../src/auth/baseball-auth-card/baseball-auth-card.ts';

describe('BaseballAuthCard', () => {
  let element: BaseballAuthCard;

  beforeEach(async () => {
    element = document.createElement('baseball-auth-card') as BaseballAuthCard;
    document.body.appendChild(element);
    await element.updateComplete;
  });

  afterEach(() => {
    element.remove();
  });

  it('renders sign in mode by default', () => {
    const shadow = element.shadowRoot!;
    expect(shadow.textContent).to.include('Sign In');
    expect(shadow.textContent).to.include('Access your league account');
  });

  it('shows error banner when error-message attribute is set', async () => {
    element.setAttribute('error-message', 'Invalid credentials');
    await element.updateComplete;

    const shadow = element.shadowRoot!;
    expect(shadow.textContent).to.include('Invalid credentials');
  });

  it('renders logged in state when logged-in-user attribute is set', async () => {
    element.setAttribute('logged-in-user', 'Tony');
    await element.updateComplete;

    const shadow = element.shadowRoot!;
    expect(shadow.textContent).to.include('Welcome back, Tony!');
    expect(shadow.textContent).to.include('Sign Out');
  });

  it('switches between Sign In and Sign Up modes when toggle button is clicked', async () => {
    const shadow = element.shadowRoot!;
    const toggleBtn = shadow.querySelector('.btn-link') as HTMLElement;
    toggleBtn.click();
    await element.updateComplete;

    expect(shadow.textContent).to.include('Create an Account');

    const toggleBackBtn = shadow.querySelector('.btn-link') as HTMLElement;
    toggleBackBtn.click();
    await element.updateComplete;

    expect(shadow.textContent).to.include('Sign In');
  });

  it('emits auth-submit event on form submission', async () => {
    let eventFired = false;
    element.addEventListener('auth-submit', () => {
      eventFired = true;
    });

    const shadow = element.shadowRoot!;
    const form = shadow.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await element.updateComplete;

    expect(eventFired).to.be.true;
  });

  it('emits auth-logout event on logout button click', async () => {
    element.setAttribute('logged-in-user', 'Tony');
    await element.updateComplete;

    let loggedOut = false;
    element.addEventListener('auth-logout', () => {
      loggedOut = true;
    });

    const shadow = element.shadowRoot!;
    const logoutBtn = shadow.querySelector('button')!;
    logoutBtn.click();

    expect(loggedOut).to.be.true;
  });
});
