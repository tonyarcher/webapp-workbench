// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Quote } from '@stock-game/shared';
import './sg-trade-form';
import { SgTradeForm } from './sg-trade-form';

type Internals = Record<string, unknown>;
type SubmitDetail = { mode: string; data: Record<string, unknown> };

const QUOTE: Quote = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 100,
    currency: 'USD',
    exchange: 'NasdaqGS',
    time: Date.parse('2024-01-02T14:30:00Z'),
    delayMinutes: 15,
};

async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function mount(patch: Internals = {}): { el: SgTradeForm; seen: SubmitDetail[] } {
    const el = document.createElement('sg-trade-form') as SgTradeForm;
    const seen: SubmitDetail[] = [];
    el.addEventListener('sg-trade-submit', (event) => {
        seen.push((event as CustomEvent<SubmitDetail>).detail);
    });
    Object.assign(el as unknown as Internals, { typedSymbol: 'AAPL', qty: 1, ...patch });
    document.body.appendChild(el);
    return { el, seen };
}

function internals(el: SgTradeForm): Internals {
    return el as unknown as Internals;
}

function privateCall<T>(el: SgTradeForm, name: string): T {
    return internals(el)[name] as T;
}

async function submit(el: SgTradeForm): Promise<void> {
    (internals(el)['onSubmit'] as () => void)();
    await tick();
}

function textOf(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (value === null || value === undefined) return '';
    const parts: string[] = [];
    const walk = (node: unknown): void => {
        if (node === null || node === undefined) return;
        if (typeof node === 'string' || typeof node === 'number') {
            parts.push(String(node));
            return;
        }
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        const record = node as { strings?: unknown[]; values?: unknown[] };
        if (Array.isArray(record.strings)) {
            record.strings.forEach((chunk, i) => {
                parts.push(String(chunk));
                walk(record.values?.[i]);
            });
        }
    };
    walk(value);
    return parts.join(' ');
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('payload guards', () => {
    it('rejects a trade payload whose symbol is not a usable string', async () => {
        const { el } = mount();
        const check = (p: Record<string, unknown>): boolean =>
            privateCall<(p: Record<string, unknown>) => boolean>(el, 'isValidTradePayload').call(el, p);
        const base = { qty: 1, at: Date.parse('2024-01-02T16:00'), orderType: 'market' };

        expect(check({ ...base, symbol: 5 })).toBe(false);
        expect(check({ ...base, symbol: '' })).toBe(false);
        expect(check({ ...base, symbol: 'A'.repeat(17) })).toBe(false);
        expect(check({ ...base, symbol: 'A'.repeat(16) })).toBe(true);
    });

    it('rejects a trade payload whose quantity or time is not a positive integer', async () => {
        const { el } = mount();
        const check = (p: Record<string, unknown>): boolean =>
            privateCall<(p: Record<string, unknown>) => boolean>(el, 'isValidTradePayload').call(el, p);
        const base = { symbol: 'AAPL', at: Date.parse('2024-01-02T16:00'), orderType: 'market' };

        expect(check({ ...base, qty: '1' })).toBe(false);
        expect(check({ ...base, qty: 0 })).toBe(false);
        expect(check({ ...base, qty: 1.5 })).toBe(false);
        expect(check({ ...base, qty: 1, at: 1.5 })).toBe(false);
    });

    it('rejects an order payload whose execute time is not a whole number', async () => {
        const { el } = mount();
        const check = (p: Record<string, unknown>): boolean =>
            privateCall<(p: Record<string, unknown>) => boolean>(el, 'isValidOrderPayload').call(el, p);
        const base = { symbol: 'AAPL', qty: 1, orderType: 'market' };

        expect(check({ ...base, executeAt: 1.5 })).toBe(false);
        expect(check({ ...base, executeAt: Date.parse('2099-01-01T10:00') })).toBe(true);
        expect(check({ ...base })).toBe(true);
    });

    it('rejects a backdated trade whose symbol is too long for the API', async () => {
        const { el, seen } = mount({
            mode: 'backdated',
            useCalendar: true,
            when: '2024-01-02T16:00',
            typedSymbol: 'A'.repeat(20),
        });
        await submit(el);

        expect(internals(el)['error']).toBe('Invalid trade details');
        expect(seen).toEqual([]);
    });
});

describe('sizing', () => {
    it('reports no holding for an empty symbol even when a holding matches', async () => {
        const holdings = [{ symbol: 'AAPL', name: 'Apple Inc.', qty: 12, avgCostCents: 10000 }];

        const blank = mount({ typedSymbol: '   ', holdings });
        expect(internals(blank.el)['heldQty']).toBe(0);

        const matching = mount({ typedSymbol: 'aapl', holdings });
        expect(internals(matching.el)['heldQty']).toBe(12);
    });

    it('does not match a malformed holding that has a blank symbol', async () => {
        const { el } = mount({
            typedSymbol: '   ',
            holdings: [{ symbol: '', name: 'Unknown', qty: 5, avgCostCents: 0 }],
        });

        expect(internals(el)['heldQty']).toBe(0);
    });

    it('uses the limit price to size when the order is a limit', async () => {
        const { el } = mount({ orderType: 'limit', limitPrice: 25, quote: QUOTE, cashCents: 250_000 });
        expect(privateCall<() => number | undefined>(el, 'sizingPrice').call(el)).toBe(25);
    });

    it('falls back to the last price for a backdated trade', async () => {
        const { el } = mount({ mode: 'backdated', quote: QUOTE, orderType: 'market' });
        expect(privateCall<() => number | undefined>(el, 'sizingPrice').call(el)).toBe(100);
    });

    it('costs a backdated trade at the last price rather than the fill source', async () => {
        const { el } = mount({ mode: 'backdated', quote: QUOTE, qty: 2, side: 'buy', commissionCents: 99 });
        expect(internals(el)['estimatedCostCents']).toBe(20_099);
    });

    it('tells a cover back when there is no cash for the shares', async () => {
        const { el } = mount({ side: 'cover', quote: QUOTE, cashCents: 100 });
        privateCall<() => void>(el, 'onMaxQty').call(el);
        await tick();

        expect(internals(el)['error']).toBe('No shares held');
    });

    it('warns a short order that costs more cash than is available', async () => {
        const { el } = mount({ side: 'short', quote: QUOTE, qty: 5, cashCents: 100, holdings: [] });
        const warn = privateCall<(c: number | undefined) => string | undefined>(el, 'getWarning');

        expect(warn.call(el, 50_000)).toBe('Not enough cash for this order');
        expect(warn.call(el, undefined)).toBeUndefined();
    });

    it('leaves a short order alone when the cash covers it', async () => {
        const { el } = mount({ side: 'short', quote: QUOTE, qty: 5, cashCents: 1_000_000, holdings: [] });
        const warn = privateCall<(c: number | undefined) => string | undefined>(el, 'getWarning');

        expect(warn.call(el, 50_000)).toBeUndefined();
    });

    it('warns a sell of more than it holds', async () => {
        const { el } = mount({ side: 'sell', quote: QUOTE, qty: 5, cashCents: 0 });
        const warn = privateCall<(c: number | undefined) => string | undefined>(el, 'getWarning');
        expect(warn.call(el, 50_000)).toBe('Only 0 share(s) held');
    });
});

describe('rendering details', () => {
    it('marks the short and cover sides as active', async () => {
        const short = mount({ side: 'short' });
        await tick();
        const shortButton = short.el.shadowRoot?.querySelectorAll('.segmented')[0]?.children[2];
        expect(shortButton?.className).toBe('active-sell');

        const cover = mount({ side: 'cover' });
        await tick();
        const coverButton = cover.el.shadowRoot?.querySelectorAll('.segmented')[0]?.children[3];
        expect(coverButton?.className).toBe('active-buy');
    });

    it('marks the last and mid fill sources as active', async () => {
        const last = mount({ mode: 'scheduled', fillPriceSource: 'last' });
        await tick();
        expect(last.el.shadowRoot?.querySelectorAll('.segmented')[2]?.children[0]?.className).toBe('active-mode');

        const mid = mount({ mode: 'scheduled', fillPriceSource: 'mid' });
        await tick();
        expect(mid.el.shadowRoot?.querySelectorAll('.segmented')[2]?.children[3]?.className).toBe('active-mode');
    });

    it('shows the limit and stop inputs with and without a value', async () => {
        const empty = mount({ orderType: 'stopLimit' });
        await tick();
        const emptyInputs = empty.el.shadowRoot?.querySelectorAll<HTMLInputElement>('input[type="number"]');
        expect(emptyInputs?.[0]?.value).toBe('');
        expect(emptyInputs?.[1]?.value).toBe('');

        const filled = mount({ orderType: 'stopLimit', limitPrice: 99, stopPrice: 90 });
        await tick();
        const filledInputs = filled.el.shadowRoot?.querySelectorAll<HTMLInputElement>('input[type="number"]');
        expect(filledInputs?.[0]?.value).toBe('99');
        expect(filledInputs?.[1]?.value).toBe('90');
    });

    it('omits the estimated cost when there is none to show', async () => {
        const { el } = mount({ quote: QUOTE });
        const render = privateCall<(c: number | undefined) => unknown>(el, 'renderQuoteDetails');

        expect(textOf(render.call(el, undefined))).not.toContain('Est.');
        expect(textOf(render.call(el, 12_345))).toContain('Est.');
    });

    it('copes with a quote detail render that has no quote', async () => {
        const { el } = mount({ quote: null });
        const render = privateCall<(c: number | undefined) => unknown>(el, 'renderQuoteDetails');
        expect(textOf(render.call(el, undefined))).toContain('Select a symbol');
    });

    it('draws a bid line without an ask and an ask line without a bid', async () => {
        const { el } = mount({ quote: null });
        const render = privateCall<(q: Quote) => unknown>(el, 'renderBidAskLine');

        const bid = textOf(render.call(el, { ...QUOTE, bid: 99 }));
        const ask = textOf(render.call(el, { ...QUOTE, ask: 101 }));
        const neither = textOf(render.call(el, { ...QUOTE }));

        expect(bid).toContain('Bid');
        expect(bid).not.toContain('Ask');
        expect(ask).toContain('Ask');
        expect(ask).not.toContain('Bid');
        expect(neither).not.toContain('Bid');
    });

    it('leaves the search box alone when it is not there yet', async () => {
        const el = document.createElement('sg-trade-form') as SgTradeForm;
        Object.assign(el as unknown as Internals, { symbol: 'MSFT', typedSymbol: '' });
        const bare = { querySelector: () => null } as unknown as ShadowRoot;
        Object.defineProperty(el, 'renderRoot', { value: bare, configurable: true });
        privateCall<() => void>(el, 'applyExternalSymbol').call(el);

        expect(internals(el)['typedSymbol']).toBe('MSFT');
    });
});

describe('mode selection', () => {
    it('leaves the calendar as it was when scheduled is chosen', async () => {
        const { el } = mount({ mode: 'backdated', useCalendar: true });
        privateCall<(m: string) => void>(el, 'selectMode').call(el, 'scheduled');
        await tick();

        expect(internals(el)['useCalendar']).toBe(true);
    });
});
