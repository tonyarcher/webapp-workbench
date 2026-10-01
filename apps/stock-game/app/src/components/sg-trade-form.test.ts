// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

async function submit(el: SgTradeForm): Promise<void> {
    (internals(el)['onSubmit'] as () => void)();
    await tick();
}

function error(el: SgTradeForm): unknown {
    return internals(el)['error'];
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('symbol and quantity validation', () => {
    it('refuses an empty or whitespace symbol', async () => {
        const { el, seen } = mount({ typedSymbol: '' });
        await submit(el);
        expect(error(el)).toBe('Enter a symbol');
        expect(seen).toEqual([]);
    });

    it('refuses a missing symbol', async () => {
        const { el, seen } = mount({ typedSymbol: '   ' });
        await submit(el);
        expect(error(el)).toBe('Enter a symbol');
        expect(seen).toEqual([]);
    });

    it('refuses a quantity that is not a positive whole number', async () => {
        for (const qty of [0, -3, 1.5, Number.NaN]) {
            const { el, seen } = mount({ qty });
            await submit(el);
            expect(error(el)).toBe('Enter a positive whole number of shares');
            expect(seen).toEqual([]);
        }
    });

    it('upper-cases the symbol it sends', async () => {
        const { el, seen } = mount({ typedSymbol: ' aapl ' });
        await submit(el);
        expect(seen[0]?.data['symbol']).toBe('AAPL');
    });
});

describe('scheduled orders', () => {
    it('sends an order without a time when the calendar is off', async () => {
        const { el, seen } = mount({ mode: 'scheduled', useCalendar: false });
        await submit(el);

        expect(seen).toHaveLength(1);
        expect(seen[0]?.mode).toBe('scheduled');
        expect(seen[0]?.data).not.toHaveProperty('executeAt');
    });

    it('refuses a scheduled time in the past', async () => {
        const { el, seen } = mount({
            mode: 'scheduled',
            useCalendar: true,
            when: '2020-01-01T10:00',
        });
        await submit(el);

        expect(error(el)).toBe('Scheduled execution time must be in the future');
        expect(seen).toEqual([]);
    });

    it('refuses an unparseable scheduled time', async () => {
        const { el, seen } = mount({ mode: 'scheduled', useCalendar: true, when: 'not-a-date' });
        await submit(el);

        expect(error(el)).toBe('Enter a valid date and time');
        expect(seen).toEqual([]);
    });

    it('sends a future time as epoch milliseconds', async () => {
        const { el, seen } = mount({
            mode: 'scheduled',
            useCalendar: true,
            when: '2099-01-01T10:00',
        });
        await submit(el);

        expect(seen[0]?.data['executeAt']).toBe(Date.parse('2099-01-01T10:00'));
    });

    it('carries the time in a form, tif and fill source', async () => {
        const { el, seen } = mount({ mode: 'scheduled', useCalendar: false, tif: 'DAY', fillPriceSource: 'bid' });
        await submit(el);

        expect(seen[0]?.data).toMatchObject({ tif: 'DAY', fillPriceSource: 'bid', orderType: 'market' });
    });
});

describe('backdated trades', () => {
    it('sends a trade once the mode and a date are chosen', async () => {
        const { el, seen } = mount({
            mode: 'backdated',
            useCalendar: true,
            when: '2024-01-02T16:00',
        });
        await submit(el);

        expect(seen[0]?.mode).toBe('backdated');
        expect(seen[0]?.data).toMatchObject({ at: Date.parse('2024-01-02T16:00'), side: 'buy', qty: 1 });
    });

    it('refuses a backdated trade with no date', async () => {
        const { el, seen } = mount({ mode: 'backdated', useCalendar: true, when: '' });
        await submit(el);

        expect(error(el)).toBe('Enter a valid date and time');
        expect(seen).toEqual([]);
    });

    it('carries limit and stop prices only when set', async () => {
        const bare = mount({ mode: 'backdated', useCalendar: true, when: '2024-01-02T16:00' });
        await submit(bare.el);
        expect(bare.seen[0]?.data).not.toHaveProperty('limitPrice');
        expect(bare.seen[0]?.data).not.toHaveProperty('stopPrice');

        const priced = mount({
            mode: 'backdated',
            useCalendar: true,
            when: '2024-01-02T16:00',
            limitPrice: 99.5,
            stopPrice: 90,
        });
        await submit(priced.el);
        expect(priced.seen[0]?.data).toMatchObject({ limitPrice: 99.5, stopPrice: 90 });
    });
});

describe('order price requirements', () => {
    it('demands a limit price for limit and stop-limit orders', async () => {
        for (const orderType of ['limit', 'stopLimit']) {
            const { el, seen } = mount({ mode: 'scheduled', useCalendar: false, orderType });
            await submit(el);
            expect(error(el)).toBe('Invalid order details');
            expect(seen).toEqual([]);
        }
    });

    it('demands a stop price for stop and stop-limit orders', async () => {
        for (const orderType of ['stop', 'stopLimit']) {
            const { el, seen } = mount({ mode: 'scheduled', useCalendar: false, orderType });
            await submit(el);
            expect(error(el)).toBe('Invalid order details');
            expect(seen).toEqual([]);
        }
    });

    it('accepts the order once both prices are present', async () => {
        const { el, seen } = mount({
            mode: 'scheduled',
            useCalendar: false,
            orderType: 'stopLimit',
            limitPrice: 99,
            stopPrice: 90,
        });
        await submit(el);
        expect(seen).toHaveLength(1);
    });

    it('refuses a price that is not positive', async () => {
        const { el, seen } = mount({
            mode: 'scheduled',
            useCalendar: false,
            orderType: 'limit',
            limitPrice: 0,
        });
        await submit(el);

        expect(error(el)).toBe('Invalid order details');
        expect(seen).toEqual([]);
    });

    it('rejects a non-positive price whatever the order type', async () => {
        const { el, seen } = mount({
            mode: 'scheduled',
            useCalendar: false,
            orderType: 'market',
            stopPrice: -1,
        });
        await submit(el);

        expect(error(el)).toBe('Invalid order details');
        expect(seen).toEqual([]);
    });
});

describe('quantity limits', () => {
    it('reports no shares held when selling nothing', async () => {
        const { el } = mount({ side: 'sell', holdings: [] });
        (internals(el)['onMaxQty'] as () => void)();
        await tick();

        expect(error(el)).toBe('No shares held');
        expect(internals(el)['qty']).toBe(1);
    });

    it('sizes a sell from the holding', async () => {
        const { el } = mount({
            side: 'sell',
            holdings: [{ symbol: 'AAPL', name: 'Apple Inc.', qty: 40, avgCostCents: 10000 }],
        });
        (internals(el)['onMaxQty'] as () => void)();
        await tick();

        expect(error(el)).toBeUndefined();
        expect(internals(el)['qty']).toBe(40);
    });

    it('asks for a symbol before sizing a max buy', async () => {
        const { el } = mount({ side: 'buy', quote: null, typedSymbol: '' });
        (internals(el)['onMaxQty'] as () => void)();
        await tick();

        expect(error(el)).toBe('Select a symbol to size a max buy');
    });

    it('reports not enough cash', async () => {
        const { el } = mount({ side: 'buy', quote: QUOTE, cashCents: 100 });
        (internals(el)['onMaxQty'] as () => void)();
        await tick();

        expect(error(el)).toBe('Not enough cash');
    });

    it('sizes a max buy from cash, padded against a price rise', async () => {
        const { el } = mount({ side: 'buy', quote: QUOTE, cashCents: 250_000, commissionCents: 0 });
        (internals(el)['onMaxQty'] as () => void)();
        await tick();

        expect(error(el)).toBeUndefined();
        expect(internals(el)['qty']).toBe(24);
    });

    it('keeps the commission out of a sell size', async () => {
        const { el } = mount({
            side: 'sell',
            holdings: [{ symbol: 'AAPL', name: 'Apple Inc.', qty: 7, avgCostCents: 10000 }],
            quote: QUOTE,
        });
        (internals(el)['onMaxQty'] as () => void)();
        await tick();
        expect(internals(el)['qty']).toBe(7);
    });
});

describe('estimated cost', () => {
    it('is unknown until there is a quote', async () => {
        const { el } = mount({ quote: null });
        expect(internals(el)['estimatedCostCents']).toBeUndefined();
    });

    it('adds the commission to a buy and not to a sell', async () => {
        const buy = mount({ side: 'buy', quote: QUOTE, qty: 2, commissionCents: 99 });
        expect(internals(buy.el)['estimatedCostCents']).toBe(20_099);

        const sell = mount({ side: 'sell', quote: QUOTE, qty: 2, commissionCents: 99 });
        expect(internals(sell.el)['estimatedCostCents']).toBe(20_000);
    });
});

describe('mode and side selection', () => {
    it('turns on the calendar when backdated is chosen', async () => {
        const { el } = mount();
        (internals(el)['selectMode'] as (m: string) => void)('backdated');
        await tick();
        expect(internals(el)['useCalendar']).toBe(true);
    });

    it('drops back to now when the calendar is turned off', async () => {
        const { el } = mount({ mode: 'backdated', when: '2024-01-02T16:00' });
        (internals(el)['setUseCalendar'] as (on: boolean) => void)(false);
        await tick();

        expect(internals(el)['useCalendar']).toBe(false);
        expect(internals(el)['mode']).toBe('scheduled');
        expect(internals(el)['when']).toBe('');
    });

    it('marks buy and cover as the buy style', async () => {
        const { el } = mount();
        const sideClass = internals(el)['sideClass'] as (s: string) => string;

        expect(sideClass('buy')).toBe('active-buy');
        expect(sideClass('cover')).toBe('active-buy');
        expect(sideClass('sell')).toBe('active-sell');
    });

    it('picks a default fill source per side', async () => {
        const { el } = mount();
        (internals(el)['selectSide'] as (s: string) => void)('sell');
        await tick();
        expect(internals(el)['fillPriceSource']).toBe('bid');
    });
});

describe('externally supplied symbol', () => {
    it('adopts the symbol prop on first render and pushes it into the search box', async () => {
        const el = document.createElement('sg-trade-form') as SgTradeForm;
        Object.assign(el as unknown as Internals, { symbol: 'MSFT' });
        document.body.appendChild(el);
        await tick();

        expect(internals(el)['typedSymbol']).toBe('MSFT');
    });

    it('ignores an empty symbol prop', async () => {
        const el = document.createElement('sg-trade-form') as SgTradeForm;
        Object.assign(el as unknown as Internals, { typedSymbol: 'KEEP', symbol: '' });
        document.body.appendChild(el);
        await tick();

        expect(internals(el)['typedSymbol']).toBe('KEEP');
    });

    it('takes a symbol typed in the search box', async () => {
        const { el } = mount({ typedSymbol: '' });
        await tick();
        const search = el.shadowRoot?.querySelector('sg-symbol-search');
        search?.dispatchEvent(new CustomEvent('sg-symbol-input', { detail: { value: 'tsla' } }));
        await tick();

        expect(internals(el)['typedSymbol']).toBe('tsla');
    });

    it('takes a symbol picked from the results', async () => {
        const { el } = mount({ typedSymbol: '' });
        await tick();
        const search = el.shadowRoot?.querySelector('sg-symbol-search');
        search?.dispatchEvent(
            new CustomEvent('sg-symbol-select', {
                detail: { symbol: 'NVDA', name: 'NVIDIA', exchange: 'NMS', type: 'EQUITY' },
            }),
        );
        await tick();

        expect(internals(el)['typedSymbol']).toBe('NVDA');
    });
});

describe('quote panel states', () => {
    it('shows the empty, loading and error states', async () => {
        const empty = mount({ quote: null, quoteError: null, quoteLoading: false });
        await tick();
        expect(empty.el.shadowRoot?.textContent).toContain('Select a symbol');

        const loading = mount({ quote: null, quoteError: null, quoteLoading: true });
        await tick();
        expect(loading.el.shadowRoot?.textContent).toContain('Loading quote');

        const failed = mount({ quote: null, quoteError: 'rate limited', quoteLoading: true });
        await tick();
        expect(failed.el.shadowRoot?.textContent).toContain('rate limited');
    });

    it('shows the price, and a bid/ask line when the quote has both', async () => {
        const plain = mount({ quote: QUOTE });
        await tick();
        expect(plain.el.shadowRoot?.textContent).toContain('100');

        const spread = mount({ quote: { ...QUOTE, bid: 99, ask: 101 } });
        await tick();
        expect(spread.el.shadowRoot?.textContent).toContain('99');
        expect(spread.el.shadowRoot?.textContent).toContain('101');
    });
});

describe('busy state', () => {
    it('disables the max button while busy', async () => {
        const { el } = mount({ busy: true });
        await tick();
        const max = el.shadowRoot?.querySelector<HTMLButtonElement>('button.max');
        expect(max?.disabled).toBe(true);

        const idle = mount({ busy: false });
        await tick();
        expect(idle.el.shadowRoot?.querySelector<HTMLButtonElement>('button.max')?.disabled).toBe(false);
    });
});

describe('event plumbing', () => {
    it('emits with bubbles and composed so a host can hear it', async () => {
        const el = document.createElement('sg-trade-form') as SgTradeForm;
        const listener = vi.fn();
        document.body.appendChild(el);
        document.addEventListener('sg-trade-submit', listener);
        Object.assign(el as unknown as Internals, { typedSymbol: 'AAPL', qty: 1, mode: 'scheduled' });
        await submit(el);

        expect(listener).toHaveBeenCalled();
        document.removeEventListener('sg-trade-submit', listener);
    });
});
