import './test-setup';
import { expect } from '@esm-bundle/chai';
import '../src/web-components/brief-view/brief-view';

const edition = {
    id: 'e1',
    status: 'ready',
    generatedAt: 1,
    windowHours: 24,
    model: 'test',
    sections: [1, 2, 3].map((n) => ({
        id: `s${n}`,
        title: `Section ${n}`,
        topic: `Topic ${n}`,
        summary: `Why section ${n} matters`,
        articleIds: [1, 2, 3, 4, 5, 6].map((i) => `s${n}-a${i}`),
        excerpts: [1, 2, 3, 4, 5, 6].map((i) => ({
            articleId: `s${n}-a${i}`,
            title: `Source ${n}-${i}`,
            text: `Excerpt ${n}-${i}`,
        })),
        scores: { worthy: n / 10, interest: n / 10, newness: 0.1, popularity: 0.1 },
    })),
};

function json(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function waitFor(done: () => boolean): Promise<void> {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
        if (done()) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('timed out waiting for brief view');
}

describe('brief view tiers', function () {
    this.timeout(5000);
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        localStorage.setItem(
            'times-up.auth.tokens',
            JSON.stringify({ access: 't', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 3600 }),
        );
        localStorage.removeItem('times-up:brief-tier');
        globalThis.fetch = async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/editions?')) {
                return json({ editions: [{ id: 'e1', status: 'ready', generatedAt: 1, windowHours: 24 }] });
            }
            if (url.includes('/editions/e1')) return json(edition);
            return json({});
        };
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        localStorage.removeItem('times-up.auth.tokens');
        localStorage.removeItem('times-up:brief-tier');
    });

    it('renders five cited excerpts in the default minute tier', async () => {
        const view = document.createElement('brief-view');
        document.body.appendChild(view);
        try {
            await waitFor(() => view.shadowRoot?.querySelectorAll('.excerpt').length === 5);
            const root = view.shadowRoot!;
            expect(root.querySelector('.excerpt')?.textContent).to.contain('Source 3-1');
            const pressed = [...root.querySelectorAll<HTMLButtonElement>('.tier')].filter(
                (button) => button.getAttribute('aria-pressed') === 'true',
            );
            expect(pressed.length).to.equal(1);
            expect(pressed[0]?.textContent).to.equal('The minute');
        } finally {
            view.remove();
        }
    });

    it('switches depth without losing cited sources', async () => {
        const view = document.createElement('brief-view');
        document.body.appendChild(view);
        try {
            await waitFor(() => view.shadowRoot?.querySelectorAll('.excerpt').length === 5);
            const root = view.shadowRoot!;
            const buttons = [...root.querySelectorAll<HTMLButtonElement>('.tier')];
            const five = buttons.find((button) => button.textContent === 'Five minutes');
            const deep = buttons.find((button) => button.textContent === 'Deep read');
            expect(five).to.not.equal(undefined);
            expect(deep).to.not.equal(undefined);

            five?.click();
            await waitFor(() => root.querySelectorAll('.excerpt').length === 9);
            expect(root.querySelectorAll('.section-summary').length).to.equal(3);
            expect(localStorage.getItem('times-up:brief-tier')).to.equal('five');

            deep?.click();
            await waitFor(() => root.querySelectorAll('.excerpt').length === 18);
            expect(root.querySelectorAll('.sources').length).to.equal(3);
            expect(root.querySelector('.source')?.textContent).to.equal('Source 3-1');
            expect(localStorage.getItem('times-up:brief-tier')).to.equal('deep');
        } finally {
            view.remove();
        }
    });
});
