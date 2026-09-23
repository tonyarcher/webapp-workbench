// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/auth', () => ({
    getAccessToken: vi.fn(async () => 'test-token' as string | null),
    refreshTokens: vi.fn(async () => null as string | null),
}));

import './sg-trade-view';
import type { SgTradeView } from './sg-trade-view';
import { getQueryClient } from '../lib/queryClient';

const CONFIG = {
    startingCashCents: 123400,
    startDate: Date.parse('2024-01-01'),
    provider: 'yahoo',
    quoteDelayMinutes: 15,
    commissionCentsPerTrade: 0,
};

const HOLDING = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    qty: 10,
    avgCostCents: 10000,
    costBasisCents: 100000,
    currentPrice: 234.56,
    marketValueCents: 234560,
    unrealizedPnlCents: 134560,
    unrealizedPnlPct: 134.56,
};

const TRADE = {
    id: 1,
    symbol: 'AAPL',
    side: 'buy',
    qty: 10,
    price: 100,
    cashDeltaCents: -100000,
    mode: 'backdated',
    executedAt: Date.parse('2024-01-02T14:30:00Z'),
    createdAt: Date.parse('2024-01-03T00:00:00Z'),
};

const QUOTE = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 234.56,
    currency: 'USD',
    exchange: 'NasdaqGS',
    time: Date.parse('2024-01-02T14:30:00Z'),
    delayMinutes: 15,
};

const RESULT = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NMS',
    type: 'EQUITY',
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function settled(): Promise<void> {
    for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

function stubTrading(): void {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            if (url.includes('/search?')) return jsonResponse([RESULT]);
            if (url.includes('/quote?')) return jsonResponse(QUOTE);
            if (url.endsWith('/holdings')) return jsonResponse([HOLDING]);
            if (url.endsWith('/trades')) return jsonResponse([TRADE]);
            if (url.endsWith('/cash')) return jsonResponse({ cashCents: 50000 });
            if (url.endsWith('/config')) return jsonResponse(CONFIG);
            throw new Error(`unexpected fetch ${url}`);
        }),
    );
}

function tradeForm(el: SgTradeView): Element | null {
    return el.shadowRoot?.querySelector('sg-trade-form') ?? null;
}

describe('sg-trade-view', () => {
    beforeEach(() => {
        getQueryClient().clear();
        vi.unstubAllGlobals();
    });

    it('loads the form with quote, cash, and recent trades', async () => {
        stubTrading();
        const el = document.createElement('sg-trade-view') as SgTradeView;
        el.symbol = 'AAPL';
        document.body.appendChild(el);
        await settled();
        const form = tradeForm(el);
        expect(form?.shadowRoot?.textContent).toContain('$234.56');
        expect(form?.shadowRoot?.textContent).toContain('Cash available');
        const trades = el.shadowRoot?.querySelector('sg-trades-table');
        expect(trades?.shadowRoot?.textContent).toContain('backdated');
        el.remove();
    });

    it('searches symbols and jumps on select', async () => {
        const calls: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => {
                calls.push(url);
                if (url.includes('/search?')) return jsonResponse([RESULT]);
                if (url.includes('/quote?')) return jsonResponse(QUOTE);
                if (url.endsWith('/holdings')) return jsonResponse([HOLDING]);
                if (url.endsWith('/trades')) return jsonResponse([TRADE]);
                if (url.endsWith('/cash')) return jsonResponse({ cashCents: 50000 });
                if (url.endsWith('/config')) return jsonResponse(CONFIG);
                throw new Error(`unexpected fetch ${url}`);
            }),
        );
        const before = window.location.href;
        try {
            const el = document.createElement('sg-trade-view') as SgTradeView;
            document.body.appendChild(el);
            await settled();
            tradeForm(el)?.dispatchEvent(new CustomEvent('sg-symbol-search-input', { detail: { query: 'aa' } }));
            await settled();
            expect(calls.some((c) => c.includes('/search?q=aa'))).toBe(true);
            tradeForm(el)?.dispatchEvent(new CustomEvent('sg-symbol-select', { detail: RESULT }));
            await settled();
            expect(window.location.hash).toBe('#/trade?symbol=AAPL');
            expect(tradeForm(el)?.shadowRoot?.textContent).toContain('$234.56');
            el.remove();
        } finally {
            window.history.replaceState(null, '', before);
        }
    });

    it('places a backdated trade on submit', async () => {
        const posts: Array<{ url: string; body: unknown }> = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string, init?: RequestInit) => {
                if (init?.method === 'POST') {
                    posts.push({ url, body: JSON.parse(init.body as string) });
                    return jsonResponse({ ...TRADE, id: 2 });
                }
                if (url.endsWith('/holdings')) return jsonResponse([HOLDING]);
                if (url.endsWith('/trades')) return jsonResponse([TRADE]);
                if (url.endsWith('/cash')) return jsonResponse({ cashCents: 50000 });
                if (url.endsWith('/config')) return jsonResponse(CONFIG);
                throw new Error(`unexpected fetch ${url}`);
            }),
        );
        const el = document.createElement('sg-trade-view') as SgTradeView;
        el.symbol = 'AAPL';
        document.body.appendChild(el);
        await settled();
        tradeForm(el)?.dispatchEvent(
            new CustomEvent('sg-trade-submit', {
                detail: { mode: 'backdated', data: { symbol: 'AAPL', side: 'buy', qty: 1, at: Date.now() } },
            }),
        );
        await settled();
        expect(posts.length).toBe(1);
        expect(posts[0]?.url).toContain('/trades');
        expect(posts[0]?.body).toMatchObject({ symbol: 'AAPL', side: 'buy', qty: 1 });
        expect(el.shadowRoot?.textContent).toContain('Order placed.');
        el.remove();
    });

    it('shows submit errors without the success message', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string, init?: RequestInit) => {
                if (init?.method === 'POST') return jsonResponse({ error: 'boom' }, 500);
                if (url.endsWith('/holdings')) return jsonResponse([HOLDING]);
                if (url.endsWith('/trades')) return jsonResponse([TRADE]);
                if (url.endsWith('/cash')) return jsonResponse({ cashCents: 50000 });
                if (url.endsWith('/config')) return jsonResponse(CONFIG);
                throw new Error(`unexpected fetch ${url}`);
            }),
        );
        const el = document.createElement('sg-trade-view') as SgTradeView;
        el.symbol = 'AAPL';
        document.body.appendChild(el);
        await settled();
        tradeForm(el)?.dispatchEvent(
            new CustomEvent('sg-trade-submit', {
                detail: { mode: 'backdated', data: { symbol: 'AAPL', side: 'buy', qty: 1, at: Date.now() } },
            }),
        );
        await settled();
        expect(el.shadowRoot?.textContent).toContain('boom');
        expect(el.shadowRoot?.textContent).not.toContain('Order placed.');
        el.remove();
    });

    it('drops the stale quote when the selection changes', async () => {
        const msft = { ...RESULT, symbol: 'MSFT', name: 'Microsoft Corp.' };
        const priorDefaults = getQueryClient().getDefaultOptions();
        getQueryClient().setDefaultOptions({ queries: { retry: false } });
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => {
                if (url.includes('/quote?symbol=MSFT')) return jsonResponse({ error: 'unknown symbol' }, 404);
                if (url.includes('/quote?')) return jsonResponse(QUOTE);
                if (url.endsWith('/holdings')) return jsonResponse([HOLDING]);
                if (url.endsWith('/trades')) return jsonResponse([TRADE]);
                if (url.endsWith('/cash')) return jsonResponse({ cashCents: 50000 });
                if (url.endsWith('/config')) return jsonResponse(CONFIG);
                throw new Error(`unexpected fetch ${url}`);
            }),
        );
        const before = window.location.href;
        try {
            const el = document.createElement('sg-trade-view') as SgTradeView;
            el.symbol = 'AAPL';
            document.body.appendChild(el);
            await settled();
            expect(tradeForm(el)?.shadowRoot?.textContent).toContain('$234.56');
            tradeForm(el)?.dispatchEvent(new CustomEvent('sg-symbol-select', { detail: msft }));
            await settled();
            const formText = tradeForm(el)?.shadowRoot?.textContent ?? '';
            expect(formText).toContain('unknown symbol');
            expect(formText).not.toContain('$234.56');
            el.remove();
        } finally {
            getQueryClient().setDefaultOptions(priorDefaults);
            window.history.replaceState(null, '', before);
        }
    });

    it('keeps good data when one base fetch fails', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => {
                if (url.endsWith('/config')) return jsonResponse({ error: 'boom' }, 500);
                if (url.endsWith('/holdings')) return jsonResponse([HOLDING]);
                if (url.endsWith('/trades')) return jsonResponse([TRADE]);
                if (url.endsWith('/cash')) return jsonResponse({ cashCents: 50000 });
                throw new Error(`unexpected fetch ${url}`);
            }),
        );
        const el = document.createElement('sg-trade-view') as SgTradeView;
        document.body.appendChild(el);
        await settled();
        expect(tradeForm(el)?.shadowRoot?.textContent).toContain('Cash available: $500.00');
        el.remove();
    });

    it('ignores a superseded quote that resolves late', async () => {
        const msft = { ...RESULT, symbol: 'MSFT', name: 'Microsoft Corp.' };
        const msftQuote = { ...QUOTE, symbol: 'MSFT', name: 'Microsoft Corp.', price: 500 };
        let resolveAapl: ((res: Response) => void) | undefined;
        vi.stubGlobal(
            'fetch',
            vi.fn((url: string) => {
                if (url.includes('/quote?symbol=AAPL')) {
                    return new Promise<Response>((resolve) => {
                        resolveAapl = resolve;
                    });
                }
                if (url.includes('/quote?')) return Promise.resolve(jsonResponse(msftQuote));
                if (url.endsWith('/holdings')) return Promise.resolve(jsonResponse([HOLDING]));
                if (url.endsWith('/trades')) return Promise.resolve(jsonResponse([TRADE]));
                if (url.endsWith('/cash')) return Promise.resolve(jsonResponse({ cashCents: 50000 }));
                if (url.endsWith('/config')) return Promise.resolve(jsonResponse(CONFIG));
                throw new Error(`unexpected fetch ${url}`);
            }),
        );
        const before = window.location.href;
        try {
            const el = document.createElement('sg-trade-view') as SgTradeView;
            el.symbol = 'AAPL';
            document.body.appendChild(el);
            await settled();
            tradeForm(el)?.dispatchEvent(new CustomEvent('sg-symbol-select', { detail: msft }));
            await settled();
            resolveAapl?.(jsonResponse(QUOTE));
            await settled();
            const formText = tradeForm(el)?.shadowRoot?.textContent ?? '';
            expect(formText).toContain('$500.00');
            expect(formText).not.toContain('$234.56');
            el.remove();
        } finally {
            window.history.replaceState(null, '', before);
        }
    });
});
