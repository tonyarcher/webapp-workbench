import './test-setup';
import { expect } from '@esm-bundle/chai';
import '../src/web-components/privacy-view/privacy-view';

/** The component renders into a shadow root; tests read through it like the app. */
function shadow(host: HTMLElement): ShadowRoot {
    const root = host.shadowRoot;
    if (!root) throw new Error('privacy-view has no shadow root');
    return root;
}

function mount(): HTMLElement {
    const host = document.createElement('privacy-view');
    document.body.append(host);
    return host;
}

describe('privacy dashboard (H3)', () => {
    let host: HTMLElement | undefined;

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        host?.remove();
        host = undefined;
        localStorage.clear();
    });

    it('renders a rigged learned profile', () => {
        localStorage.setItem('rss-reader:word-map', JSON.stringify({ rust: 8, crypto: -6 }));
        localStorage.setItem('rss-reader:engagement-totals', JSON.stringify({ 'a1:share': 8 }));
        localStorage.setItem('rss-reader:deranked-ids', JSON.stringify(['a9']));
        host = mount();
        const root = shadow(host);
        expect(root.textContent).to.include('Privacy dashboard');
        expect(root.textContent).to.include('rust');
        expect(root.textContent).to.include('+8');
        expect(root.textContent).to.include('crypto');
        expect(root.textContent).to.include('-6');
        expect(root.textContent).to.include('a9');
        expect(root.querySelectorAll('input[type="checkbox"]').length).to.equal(8);
    });

    it('switches one signal off without touching the learned profile', () => {
        localStorage.setItem('rss-reader:word-map', JSON.stringify({ rust: 8 }));
        host = mount();
        const root = shadow(host);
        const dwell = root.querySelector<HTMLInputElement>('#learning-signal-dwell');
        expect(dwell?.checked).to.equal(true);
        dwell?.click();
        const stored = JSON.parse(localStorage.getItem('rss-reader:learning-signals') ?? '{}') as {
            dwell?: boolean;
        };
        expect(stored.dwell).to.equal(false);
        expect(root.querySelector('[role="status"]')?.textContent).to.include('Headline dwell learning off');
        expect(localStorage.getItem('rss-reader:word-map')).to.not.equal(null);
    });

    it('asks before forgetting, then clears every learned signal', () => {
        localStorage.setItem('rss-reader:word-map', JSON.stringify({ rust: 8 }));
        localStorage.setItem('rss-reader:deranked-ids', JSON.stringify(['a9']));
        host = mount();
        const root = shadow(host);
        root.querySelector<HTMLButtonElement>('[data-action="forget"]')?.click();
        expect(root.textContent).to.include('Forget everything?');
        expect(localStorage.getItem('rss-reader:word-map')).to.not.equal(null);
        root.querySelector<HTMLButtonElement>('[data-action="confirm-forget"]')?.click();
        expect(localStorage.getItem('rss-reader:word-map')).to.equal(null);
        expect(localStorage.getItem('rss-reader:deranked-ids')).to.equal(null);
        expect(root.textContent).to.include('Learned profile forgotten.');
        expect(root.textContent).to.include('No articles are marked not interesting.');
    });

    it('cancels a forget without clearing anything', () => {
        localStorage.setItem('rss-reader:word-map', JSON.stringify({ rust: 8 }));
        host = mount();
        const root = shadow(host);
        root.querySelector<HTMLButtonElement>('[data-action="forget"]')?.click();
        root.querySelector<HTMLButtonElement>('[data-action="cancel-forget"]')?.click();
        expect(root.textContent).to.not.include('Forget everything?');
        expect(localStorage.getItem('rss-reader:word-map')).to.not.equal(null);
    });
});
