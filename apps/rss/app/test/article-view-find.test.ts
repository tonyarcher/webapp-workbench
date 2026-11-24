import './test-setup';
import { expect } from '@esm-bundle/chai';
import { ArticleFind, findRanges, stepFindIndex } from '../src/web-components/article-view/article-view-find';

function fixture(): { host: HTMLDivElement; content: HTMLDivElement; find: ArticleFind; scrolls: number[] } {
    const host = document.createElement('div');
    host.tabIndex = -1;
    const content = document.createElement('div');
    content.className = 'content';
    content.innerHTML = '<p>Alpha beta</p><p>alpha and ALPHA</p>';
    const find = new ArticleFind(host, () => {});
    const scrolls: number[] = [];
    Object.defineProperties(host, {
        scrollTop: { value: 0, writable: true },
        clientHeight: { value: 200 },
    });
    host.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600);
    host.scrollTo = (options) => {
        if (typeof options === 'object' && options.top !== undefined) scrolls.push(options.top);
    };
    host.append(find.bar, content);
    document.body.append(host);
    find.refresh(content);
    return { host, content, find, scrolls };
}

describe('article find (A5)', () => {
    let host: HTMLDivElement | undefined;

    afterEach(() => {
        host?.remove();
        host = undefined;
    });

    it('finds case-insensitive matches across text nodes', () => {
        const content = document.createElement('div');
        content.innerHTML = '<p>Alpha beta</p><p>alpha</p>';
        expect(findRanges(content, 'alpha').map((range) => range.toString())).to.deep.equal(['Alpha', 'alpha']);
        expect(findRanges(content, '')).to.deep.equal([]);
    });

    it('wraps keyboard stepping and handles an empty result', () => {
        expect(stepFindIndex(0, 3, -1)).to.equal(2);
        expect(stepFindIndex(2, 3, 1)).to.equal(0);
        expect(stepFindIndex(0, 0, 1)).to.equal(0);
    });

    it('shows a live count and steps through matches', () => {
        const state = fixture();
        host = state.host;
        state.find.toggle();
        const input = state.find.bar.querySelector<HTMLInputElement>('.find-input')!;
        input.value = 'alpha';
        input.dispatchEvent(new Event('input'));
        const count = state.find.bar.querySelector<HTMLElement>('.find-count')!;
        expect(count.textContent).to.equal('1/3');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(count.textContent).to.equal('2/3');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
        expect(count.textContent).to.equal('1/3');
        expect(state.scrolls.length).to.be.greaterThan(0);
    });

    it('closes on Escape and clears the query', () => {
        const state = fixture();
        host = state.host;
        state.find.toggle();
        const input = state.find.bar.querySelector<HTMLInputElement>('.find-input')!;
        input.value = 'alpha';
        input.dispatchEvent(new Event('input'));
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        input.dispatchEvent(event);
        expect(event.defaultPrevented).to.equal(true);
        expect(state.find.open).to.equal(false);
        expect(input.value).to.equal('');
        expect(document.activeElement).to.equal(state.host);
    });

    it('restores focus without selecting the whole query', () => {
        const state = fixture();
        host = state.host;
        state.find.toggle();
        const input = state.find.bar.querySelector<HTMLInputElement>('.find-input')!;
        input.value = 'alpha';
        input.setSelectionRange(2, 3);
        state.find.focusInput(false);
        expect(input.selectionStart).to.equal(2);
        expect(input.selectionEnd).to.equal(3);
    });

    it('opens with Ctrl+F without invoking the browser find', () => {
        const state = fixture();
        host = state.host;
        const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true });
        state.find.bar.dispatchEvent(event);
        expect(event.defaultPrevented).to.equal(true);
        expect(state.find.open).to.equal(true);
    });
});
