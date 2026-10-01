// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import './sg-trade-form';
import { SgTradeForm } from './sg-trade-form';

type Internals = Record<string, unknown>;

async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function internals(el: SgTradeForm): Internals {
    return el as unknown as Internals;
}

async function mount(patch: Internals = {}): Promise<SgTradeForm> {
    const el = document.createElement('sg-trade-form') as SgTradeForm;
    Object.assign(el as unknown as Internals, { typedSymbol: 'AAPL', qty: 1, ...patch });
    document.body.appendChild(el);
    await tick();
    return el;
}

function groupStartingWith(el: SgTradeForm, label: string): ParentNode {
    const found = [...(el.shadowRoot?.querySelectorAll('.segmented') ?? [])].find(
        (group) => group.children[0]?.textContent?.trim() === label,
    );
    if (!found) throw new Error(`no segmented group starting with "${label}"`);
    return found;
}

function priceInputs(el: SgTradeForm): HTMLInputElement[] {
    return [...(el.shadowRoot?.querySelectorAll<HTMLInputElement>('input[type="number"]') ?? [])].filter(
        (input) => !input.closest('.shares-row'),
    );
}

function sharesInput(el: SgTradeForm): HTMLInputElement | undefined {
    return el.shadowRoot?.querySelector<HTMLInputElement>('.shares-row input[type="number"]') ?? undefined;
}

async function fire(target: EventTarget | null | undefined, type: string): Promise<void> {
    target?.dispatchEvent(new Event(type, { bubbles: true }));
    await tick();
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('order type', () => {
    it('takes the order type from the select and re-renders its price fields', async () => {
        const el = await mount();
        const select = el.shadowRoot?.querySelector('select') as HTMLSelectElement;

        expect(priceInputs(el)).toHaveLength(0);
        select.value = 'limit';
        await fire(select, 'change');

        expect(internals(el)['orderType']).toBe('limit');
        expect(priceInputs(el)).toHaveLength(1);
    });

    it('shows both price inputs for a stop-limit order', async () => {
        const el = await mount({ orderType: 'stopLimit' });
        expect(priceInputs(el)).toHaveLength(2);
    });

    it('clears a price when its input is emptied', async () => {
        const el = await mount({ orderType: 'stopLimit', limitPrice: 99, stopPrice: 90 });
        const limit = priceInputs(el)[0] as HTMLInputElement;

        limit.value = '';
        await fire(limit, 'input');

        expect(internals(el)['limitPrice']).toBeUndefined();
        expect(internals(el)['stopPrice']).toBe(90);
    });
});

describe('time in force and fill source', () => {
    it('takes the time in force from its buttons', async () => {
        const el = await mount({ mode: 'scheduled', tif: 'GTC' });
        const tif = groupStartingWith(el, 'Day');

        await fire(tif.children[0], 'click');
        expect(internals(el)['tif']).toBe('DAY');

        await fire(tif.children[1], 'click');
        expect(internals(el)['tif']).toBe('GTC');
    });

    it('takes every fill source from its buttons', async () => {
        const el = await mount({ mode: 'scheduled' });
        const fill = groupStartingWith(el, 'Last');

        for (const [index, source] of ['last', 'bid', 'ask', 'mid'].entries()) {
            await fire(fill.children[index], 'click');
            expect(internals(el)['fillPriceSource']).toBe(source);
        }
    });

    it('hides the scheduled-only controls in backdated mode', async () => {
        const el = await mount({ mode: 'backdated' });
        expect(el.shadowRoot?.querySelectorAll('.segmented')).toHaveLength(2);
    });
});

describe('sides', () => {
    it('takes each side from its buttons and picks a matching fill source', async () => {
        const el = await mount();
        const sides = groupStartingWith(el, 'Buy');

        for (const [index, side] of ['buy', 'sell', 'short', 'cover'].entries()) {
            await fire(sides.children[index], 'click');
            expect(internals(el)['side']).toBe(side);
        }

        await fire(sides.children[2], 'click');
        expect(internals(el)['fillPriceSource']).toBe('bid');
    });
});

describe('shares and time', () => {
    it('takes the share count from its input', async () => {
        const el = await mount({ orderType: 'market' });
        const qty = sharesInput(el) as HTMLInputElement;

        qty.value = '7';
        await fire(qty, 'input');

        expect(internals(el)['qty']).toBe(7);
    });

    it('takes the mode from its buttons', async () => {
        const el = await mount();
        const mode = groupStartingWith(el, 'Backdated');

        await fire(mode.children[0], 'click');
        expect(internals(el)['mode']).toBe('backdated');
        expect(internals(el)['useCalendar']).toBe(true);

        await fire(mode.children[1], 'click');
        expect(internals(el)['mode']).toBe('scheduled');
    });

    it('takes the chosen moment from the date input and labels it by mode', async () => {
        const backdated = await mount({ mode: 'backdated', useCalendar: true });
        const input = backdated.shadowRoot?.querySelector('input[type="datetime-local"]') as HTMLInputElement;

        input.value = '2024-01-02T16:00';
        await fire(input, 'input');

        expect(internals(backdated)['when']).toBe('2024-01-02T16:00');
        expect(backdated.shadowRoot?.textContent).toContain('Trade date/time');

        const scheduled = await mount({ mode: 'scheduled', useCalendar: true });
        expect(scheduled.shadowRoot?.textContent).toContain('Execute at');
    });

    it('shows the hint until the calendar is switched on', async () => {
        const el = await mount({ useCalendar: false });
        expect(el.shadowRoot?.textContent).toContain('Uses right now');

        (internals(el)['setUseCalendar'] as (on: boolean) => void).call(el, true);
        await tick();

        expect(el.shadowRoot?.querySelector('input[type="datetime-local"]')).not.toBeNull();
    });
});

describe('submit label', () => {
    it('names the action for each mode', async () => {
        const now = await mount({ useCalendar: false });
        expect(now.shadowRoot?.querySelector('.submit')?.textContent).toContain('Place order');

        const scheduled = await mount({ useCalendar: true, mode: 'scheduled' });
        expect(scheduled.shadowRoot?.querySelector('.submit')?.textContent).toContain('Schedule order');

        const backdated = await mount({ useCalendar: true, mode: 'backdated' });
        expect(backdated.shadowRoot?.querySelector('.submit')?.textContent).toContain('Place trade');
    });
});
