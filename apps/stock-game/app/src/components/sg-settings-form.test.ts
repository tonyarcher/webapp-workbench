// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameConfig } from '@stock-game/shared';
import './sg-settings-form';
import { SgSettingsForm } from './sg-settings-form';

type Internals = Record<string, unknown>;
type SubmitDetail = {
    startingCashCents: number;
    startDate: number;
    provider: string;
    quoteDelayMinutes: number;
    commissionCentsPerTrade: number;
};

const CONFIG: GameConfig = {
    startingCashCents: 100_000,
    startDate: Date.parse('2024-01-02T00:00:00'),
    provider: 'yahoo',
    quoteDelayMinutes: 15,
    commissionCentsPerTrade: 0,
};

async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function internals(el: SgSettingsForm): Internals {
    return el as unknown as Internals;
}

async function mount(config: GameConfig | null = CONFIG): Promise<{ el: SgSettingsForm; seen: SubmitDetail[] }> {
    const el = document.createElement('sg-settings-form') as SgSettingsForm;
    const seen: SubmitDetail[] = [];
    el.addEventListener('sg-config-submit', (event) => {
        seen.push((event as CustomEvent<SubmitDetail>).detail);
    });
    el.config = config;
    document.body.appendChild(el);
    await tick();
    return { el, seen };
}

async function submit(el: SgSettingsForm): Promise<void> {
    (internals(el)['onSubmit'] as () => void).call(el);
    await tick();
}

function validatorFor(el: SgSettingsForm) {
    return (
        internals(el)['validateAndEmit'] as (
            this: SgSettingsForm,
            cash: number,
            date: number,
            provider: string | undefined,
            delay: number,
            commission: number,
        ) => boolean
    ).bind(el);
}

function field(el: SgSettingsForm, id: string): HTMLInputElement | HTMLSelectElement | null {
    return el.shadowRoot?.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`) ?? null;
}

async function setField(el: SgSettingsForm, id: string, value: string): Promise<void> {
    const input = field(el, id);
    if (input === null) throw new Error(`no field ${id}`);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
}

function errorText(el: SgSettingsForm): string | undefined {
    return el.shadowRoot?.querySelector('.error')?.textContent?.trim() ?? undefined;
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('draft values', () => {
    it('renders cash and commission in dollars, delay in minutes', async () => {
        const { el } = await mount({ ...CONFIG, startingCashCents: 123_456, commissionCentsPerTrade: 7 });
        expect(field(el, 'cash')?.value).toBe('1234.56');
        expect(field(el, 'commission')?.value).toBe('0.07');
        expect(field(el, 'quoteDelay')?.value).toBe('15');
    });

    it('shows a loading line and no form until a config arrives', async () => {
        const { el } = await mount(null);
        expect(el.shadowRoot?.textContent).toContain('Loading configuration');
        expect(field(el, 'cash')).toBeNull();
    });

    it('does nothing on submit without a config', async () => {
        const { el, seen } = await mount(null);
        await submit(el);
        expect(seen).toEqual([]);
    });
});

describe('a valid form emits cents and epoch milliseconds', () => {
    it('converts the typed dollars into cents', async () => {
        const { el, seen } = await mount();
        await setField(el, 'cash', '5000.25');
        await submit(el);

        expect(seen).toHaveLength(1);
        expect(seen[0]?.startingCashCents).toBe(500_025);
    });

    it('carries the configured start date when the field is untouched', async () => {
        const { el, seen } = await mount();
        await submit(el);

        expect(seen[0]?.startDate).toBe(CONFIG.startDate);
    });

    it('parses a typed date as midnight local', async () => {
        const { el, seen } = await mount();
        await setField(el, 'date', '2024-03-01');
        await submit(el);

        expect(seen[0]?.startDate).toBe(Date.parse('2024-03-01T00:00:00'));
    });

    it('sends the commission in cents', async () => {
        const { el, seen } = await mount();
        await setField(el, 'commission', '1.50');
        await submit(el);

        expect(seen[0]?.commissionCentsPerTrade).toBe(150);
    });

    it('accepts every shipped provider', async () => {
        for (const provider of ['yahoo', 'twelvedata', 'alphaVantage']) {
            const { el, seen } = await mount();
            await setField(el, 'provider', provider);
            await submit(el);
            expect(seen[0]?.provider).toBe(provider);
        }
    });
});

describe('validation', () => {
    const expectRefused = async (patch: Partial<GameConfig>): Promise<SubmitDetail[]> => {
        const { el, seen } = await mount({ ...CONFIG, ...patch });
        await submit(el);
        return seen;
    };

    it('refuses a start date that is not a real, already-reached day', async () => {
        expect(await expectRefused({ startDate: 0 })).toEqual([]);
        expect(await expectRefused({ startDate: -1 })).toEqual([]);
        expect(await expectRefused({ startDate: Date.now() + 86_400_000 })).toEqual([]);
        expect(await expectRefused({ startDate: Date.now() + 3_600_000 })).toEqual([]);
    });

    it('accepts today and any past start date', async () => {
        expect(await expectRefused({ startDate: Date.now() })).toHaveLength(1);
        expect(await expectRefused({ startDate: Date.now() - 86_400_000 })).toHaveLength(1);
    });

    it('refuses starting cash that is not a positive whole number of cents', async () => {
        expect(await expectRefused({ startingCashCents: 0 })).toEqual([]);
        expect(await expectRefused({ startingCashCents: -100 })).toEqual([]);
    });

    it('rounds a fractional cent away rather than refusing it', async () => {
        const { el, seen } = await mount({ ...CONFIG, startingCashCents: 10.5 });
        await submit(el);
        expect(seen[0]?.startingCashCents).toBe(11);
    });

    it('refuses a quote delay outside zero to one hundred twenty', async () => {
        expect(await expectRefused({ quoteDelayMinutes: -1 })).toEqual([]);
        expect(await expectRefused({ quoteDelayMinutes: 121 })).toEqual([]);
    });

    it('rounds a fractional delay rather than refusing it', async () => {
        const { el, seen } = await mount({ ...CONFIG, quoteDelayMinutes: 1.5 });
        await submit(el);
        expect(seen[0]?.quoteDelayMinutes).toBe(2);
    });

    it('accepts the ends of the delay range', async () => {
        expect(await expectRefused({ quoteDelayMinutes: 0 })).toHaveLength(1);
        expect(await expectRefused({ quoteDelayMinutes: 120 })).toHaveLength(1);
    });

    it('refuses a negative commission', async () => {
        expect(await expectRefused({ commissionCentsPerTrade: -1 })).toEqual([]);
    });

    it('refuses an empty provider', async () => {
        const { el, seen } = await mount();
        await setField(el, 'provider', '');
        await submit(el);
        expect(seen).toEqual([]);
    });

    it('validates an unshipped provider by length, which the select cannot offer', async () => {
        const { el, seen } = await mount();
        const emit = validatorFor(el);

        expect(emit(100_000, CONFIG.startDate, 'my-broker', 15, 0)).toBe(true);
        expect(seen[0]?.provider).toBe('my-broker');

        expect(emit(100_000, CONFIG.startDate, 'x'.repeat(17), 15, 0)).toBe(false);
        expect(emit(100_000, CONFIG.startDate, 'x'.repeat(16), 15, 0)).toBe(true);
        expect(emit(100_000, CONFIG.startDate, undefined, 15, 0)).toBe(false);
    });

    it('refuses a date the input cannot hold, which the browser also rejects', async () => {
        const { el, seen } = await mount();
        const emit = validatorFor(el);

        // A date input drops an unparseable value outright, so this reaches the
        // validator only from a config, not from typing.
        expect(emit(100_000, Number.NaN, 'yahoo', 15, 0)).toBe(false);
        expect(emit(100_000, 1.5, 'yahoo', 15, 0)).toBe(false);
        expect(emit(100_000, Date.parse('2024-01-02T00:00:00'), 'yahoo', 15, 0)).toBe(true);
        expect(seen).toHaveLength(1);
    });

    it('reports the same message for every refusal', async () => {
        const { el, seen } = await mount({ ...CONFIG, startingCashCents: 0 });
        await submit(el);

        expect(seen).toEqual([]);
        expect(errorText(el)).toBe('Check the starting cash and start date values');
    });

    it('clears a previous refusal once the form is valid again', async () => {
        const { el, seen } = await mount({ ...CONFIG, startingCashCents: 0 });
        await submit(el);
        expect(errorText(el)).toBeDefined();

        await setField(el, 'cash', '1000');
        await submit(el);

        expect(seen).toHaveLength(1);
        expect(errorText(el)).toBeUndefined();
    });
});

describe('busy state', () => {
    it('disables the submit button while busy', async () => {
        const { el } = await mount();
        expect(el.shadowRoot?.querySelector<HTMLButtonElement>('button.submit')?.disabled).toBe(false);

        el.busy = true;
        await tick();
        expect(el.shadowRoot?.querySelector<HTMLButtonElement>('button.submit')?.disabled).toBe(true);
    });
});

describe('event plumbing', () => {
    it('bubbles and composes the submit event so a host can hear it', async () => {
        const el = document.createElement('sg-settings-form') as SgSettingsForm;
        const listener = (): void => {};
        document.addEventListener('sg-config-submit', listener);
        el.config = CONFIG;
        document.body.appendChild(el);
        await tick();
        await submit(el);

        expect(listener).toBeDefined();
        document.removeEventListener('sg-config-submit', listener);
    });
});
