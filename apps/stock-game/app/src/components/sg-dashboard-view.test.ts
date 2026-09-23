// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const chartCalls: unknown[][] = [];
vi.mock('lightweight-charts', () => ({
    ColorType: { Solid: 0 },
    LineSeries: {},
    createChart: () => ({
        addSeries: () => ({ setData: (...args: unknown[]) => chartCalls.push(args), applyOptions: () => {} }),
        remove: () => {},
    }),
}));

vi.mock('../lib/auth', () => ({
    getAccessToken: vi.fn(async () => 'test-token' as string | null),
    refreshTokens: vi.fn(async () => null as string | null),
}));

import './sg-dashboard-view';
import type { SgDashboardView } from './sg-dashboard-view';
import { getQueryClient } from '../lib/queryClient';

const CONFIG = {
    startingCashCents: 1_000_000,
    startDate: Date.parse('2024-01-01'),
    provider: 'yahoo',
    quoteDelayMinutes: 15,
    commissionCentsPerTrade: 0,
};

const SERIES = {
    startingCashCents: 1_000_000,
    startDate: Date.parse('2024-01-01'),
    endDate: Date.parse('2024-01-04'),
    points: [
        { time: Date.parse('2024-01-02'), cashCents: 1_000_000, holdingsCents: 0, totalCents: 1_000_000, gainCents: 0 },
        {
            time: Date.parse('2024-01-03'),
            cashCents: 900_000,
            holdingsCents: 120_000,
            totalCents: 1_020_000,
            gainCents: 20_000,
        },
    ],
    totalReturnPct: 2,
    totalGainCents: 20_000,
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

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function settled(): Promise<void> {
    for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('sg-dashboard-view', () => {
    beforeEach(() => {
        getQueryClient().clear();
        chartCalls.length = 0;
        vi.unstubAllGlobals();
    });

    it('renders stats, chart, and holdings from the loaded data', async () => {
        const calls: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => {
                calls.push(url);
                if (url.endsWith('/config')) return jsonResponse(CONFIG);
                if (url.includes('/portfolio')) return jsonResponse(SERIES);
                if (url.endsWith('/holdings')) return jsonResponse([HOLDING]);
                throw new Error(`unexpected fetch ${url}`);
            }),
        );
        const el = document.createElement('sg-dashboard-view') as SgDashboardView;
        document.body.appendChild(el);
        await settled();
        expect(el.shadowRoot?.textContent).toContain('Dashboard');
        expect(el.shadowRoot?.textContent).toContain('$10,200.00');
        expect(el.shadowRoot?.textContent).toContain('Total return');
        expect(el.isConnected).toBe(true);
        const chart = el.shadowRoot?.querySelector('sg-portfolio-chart');
        expect(chart).not.toBeNull();
        const table = el.shadowRoot?.querySelector('sg-holdings-table');
        expect(table?.shadowRoot?.textContent).toContain('AAPL');
        el.remove();
    });

    it('shows a single error when any of the three fetches fails', async () => {
        const priorDefaults = getQueryClient().getDefaultOptions();
        getQueryClient().setDefaultOptions({ queries: { retry: false } });
        try {
            vi.stubGlobal(
                'fetch',
                vi.fn(async (url: string) => {
                    if (url.includes('/portfolio')) return jsonResponse({ error: 'boom' }, 500);
                    if (url.endsWith('/config')) return jsonResponse(CONFIG);
                    if (url.endsWith('/holdings')) return jsonResponse([HOLDING]);
                    throw new Error(`unexpected fetch ${url}`);
                }),
            );
            const el = document.createElement('sg-dashboard-view') as SgDashboardView;
            document.body.appendChild(el);
            await settled();
            expect(el.shadowRoot?.textContent).toContain('boom');
            expect(el.shadowRoot?.textContent).not.toContain('Dashboard');
            el.remove();
        } finally {
            getQueryClient().setDefaultOptions(priorDefaults);
        }
    });

    it('ignores a late resolve after disconnect', async () => {
        let resolveConfig: ((res: Response) => void) | undefined;
        vi.stubGlobal(
            'fetch',
            vi.fn((url: string) => {
                if (url.endsWith('/config')) {
                    return new Promise<Response>((resolve) => {
                        resolveConfig = resolve;
                    });
                }
                if (url.includes('/portfolio')) return Promise.resolve(jsonResponse(SERIES));
                if (url.endsWith('/holdings')) return Promise.resolve(jsonResponse([HOLDING]));
                throw new Error(`unexpected fetch ${url}`);
            }),
        );
        const el = document.createElement('sg-dashboard-view') as SgDashboardView;
        document.body.appendChild(el);
        await settled();
        expect(resolveConfig).toBeDefined();
        el.remove();
        resolveConfig?.(jsonResponse(CONFIG));
        await settled();
        expect(el.isConnected).toBe(false);
        expect(el.config).toBeNull();
    });
});
