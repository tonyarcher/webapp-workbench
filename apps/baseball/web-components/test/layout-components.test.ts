import { expect } from '@esm-bundle/chai';
import '../src/layout/baseball-tab-page-wrapper/baseball-tab-page-wrapper.ts';
import { BaseballTabPageWrapper } from '../src/layout/baseball-tab-page-wrapper/baseball-tab-page-wrapper.ts';

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

  it('projects slotted content by default', () => {
    const child = document.createElement('span');
    child.textContent = 'slotted content';
    element.appendChild(child);
    const slot = element.shadowRoot!.querySelector('slot') as HTMLSlotElement;
    expect(slot).to.not.be.null;
    expect(child.assignedSlot).to.equal(slot);
  });
});
