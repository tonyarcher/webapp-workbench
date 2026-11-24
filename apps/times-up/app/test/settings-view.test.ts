// The settings search, in a real DOM: it filters the index, its results are
// links to a tab, and activating one focuses the actual control rather than
// just changing the tab.
import './test-setup';
import { expect } from '@esm-bundle/chai';
import '../src/web-components/settings-view/settings-view';
import type { SettingsView } from '../src/web-components/settings-view/settings-view';

function deepActiveElement(): HTMLElement | null {
    let element: Element | null = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    return element instanceof HTMLElement ? element : null;
}

function searchInput(el: SettingsView): HTMLInputElement {
    return el.shadowRoot!.querySelector<HTMLInputElement>('#settings-search-input')!;
}

function results(el: SettingsView): HTMLAnchorElement[] {
    return Array.from(el.shadowRoot!.querySelectorAll<HTMLAnchorElement>('.results a'));
}

function type(el: SettingsView, value: string): void {
    const input = searchInput(el);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

describe('settings search', () => {
    let el: SettingsView | undefined;

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        el?.remove();
        el = undefined;
    });

    it('filters the index and jumps to the control on the same tab', async () => {
        el = document.createElement('settings-view') as SettingsView;
        document.body.append(el);
        type(el, 'reader font');
        const links = results(el);
        expect(links.length).to.be.greaterThan(0);
        expect(links[0]!.textContent).to.equal('Reader font');
        expect(links[0]!.getAttribute('href')).to.equal('#/settings');
        links[0]!.click();
        await nextFrame();
        expect(deepActiveElement()?.getAttribute('data-focus-key')).to.equal('select:Font');
        // The jump clears the query, so the list is closed again.
        expect(el.shadowRoot!.querySelector('#settings-results')!.hasAttribute('hidden')).to.equal(true);
    });

    it('filters live in the page and restores the panel when cleared', async () => {
        el = document.createElement('settings-view') as SettingsView;
        document.body.append(el);
        const panel = el.shadowRoot!.querySelector<HTMLElement>('.panel')!;
        expect(panel.hasAttribute('hidden')).to.equal(false);
        type(el, 'forget');
        expect(results(el).length).to.be.greaterThan(0);
        expect(el.shadowRoot!.querySelector('.results')!.hasAttribute('hidden')).to.equal(false);
        expect(panel.hasAttribute('hidden')).to.equal(true);
        expect(el.shadowRoot!.querySelector('.count')!.textContent).to.include('matching');
        type(el, 'zzzz');
        expect(results(el).length).to.equal(0);
        expect(el.shadowRoot!.querySelector('.empty')).to.not.equal(null);
        type(el, '');
        expect(panel.hasAttribute('hidden')).to.equal(false);
        expect(el.shadowRoot!.querySelector('.results')!.hasAttribute('hidden')).to.equal(true);
    });

    it('changes tab for a setting on another panel and focuses it', async () => {
        el = document.createElement('settings-view') as SettingsView;
        document.body.append(el);
        type(el, 'forget');
        const link = results(el).find((node) => node.textContent === 'Forget everything');
        expect(link).to.not.equal(undefined);
        link!.click();
        await nextFrame();
        expect(el.shadowRoot!.querySelector('privacy-view')).to.not.equal(null);
        expect(el.shadowRoot!.querySelector('.tab[aria-current="page"]')!.textContent).to.equal('Privacy');
        expect(deepActiveElement()?.getAttribute('data-action')).to.equal('forget');
    });

    it('moves through results with arrow keys from the input and the list', async () => {
        el = document.createElement('settings-view') as SettingsView;
        document.body.append(el);
        type(el, 'theme');
        const links = results(el);
        expect(links.length).to.be.greaterThan(2);
        searchInput(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(deepActiveElement()).to.equal(links[1]);
        links[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(deepActiveElement()).to.equal(links[2]);
    });

    it('Escape clears the query and closes the results', async () => {
        el = document.createElement('settings-view') as SettingsView;
        document.body.append(el);
        type(el, 'theme');
        expect(results(el).length).to.be.greaterThan(0);
        searchInput(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(searchInput(el).value).to.equal('');
        expect(el.shadowRoot!.querySelector('#settings-results')!.hasAttribute('hidden')).to.equal(true);
    });
});
