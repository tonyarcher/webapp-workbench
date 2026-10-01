// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { history, navigate, parsePath, viewToPath } from './router';

describe('parsePath', () => {
    it('falls back to the dashboard for an empty or unknown route', () => {
        expect(parsePath('', '')).toEqual({ kind: 'dashboard' });
        expect(parsePath('/', '')).toEqual({ kind: 'dashboard' });
        expect(parsePath('/nowhere', '')).toEqual({ kind: 'dashboard' });
        expect(parsePath('/nowhere/deeper', '')).toEqual({ kind: 'dashboard' });
    });

    it('reads each named route', () => {
        expect(parsePath('/portfolio', '')).toEqual({ kind: 'portfolio' });
        expect(parsePath('/orders', '')).toEqual({ kind: 'orders' });
        expect(parsePath('/settings', '')).toEqual({ kind: 'settings' });
    });

    it('reads the trade route without a symbol', () => {
        expect(parsePath('/trade', '')).toEqual({ kind: 'trade' });
        expect(parsePath('/trade', '?orderType=market')).toEqual({ kind: 'trade' });
    });

    it('reads the trade route with a symbol', () => {
        expect(parsePath('/trade', '?symbol=AAPL')).toEqual({ kind: 'trade', symbol: 'AAPL' });
        expect(parsePath('/trade', '?orderType=market&symbol=MSFT')).toEqual({
            kind: 'trade',
            symbol: 'MSFT',
        });
    });

    it('treats a blank symbol as no symbol rather than an empty one', () => {
        expect(parsePath('/trade', '?symbol=')).toEqual({ kind: 'trade' });
        expect(parsePath('/trade', '?symbol=%20%20')).toEqual({ kind: 'trade' });
    });

    it('trims the symbol it was given', () => {
        expect(parsePath('/trade', '?symbol=%20AAPL%20')).toEqual({ kind: 'trade', symbol: 'AAPL' });
    });
});

describe('viewToPath', () => {
    it('writes each route back to its path', () => {
        expect(viewToPath({ kind: 'dashboard' })).toBe('/');
        expect(viewToPath({ kind: 'portfolio' })).toBe('/portfolio');
        expect(viewToPath({ kind: 'orders' })).toBe('/orders');
        expect(viewToPath({ kind: 'settings' })).toBe('/settings');
    });

    it('carries a trade symbol, encoded', () => {
        expect(viewToPath({ kind: 'trade' })).toBe('/trade');
        expect(viewToPath({ kind: 'trade', symbol: 'AAPL' })).toBe('/trade?symbol=AAPL');
        expect(viewToPath({ kind: 'trade', symbol: 'BRK B' })).toBe('/trade?symbol=BRK%20B');
    });

    it('round-trips a view through a path and back', () => {
        const views = [
            { kind: 'dashboard' },
            { kind: 'portfolio' },
            { kind: 'orders' },
            { kind: 'settings' },
            { kind: 'trade' },
            { kind: 'trade', symbol: 'AAPL' },
        ] as const;

        for (const view of views) {
            const path = viewToPath(view);
            const [pathname = '/', search] = path.split('?');
            expect(parsePath(pathname, search ? `?${search}` : '')).toEqual(view);
        }
    });
});

describe('navigate', () => {
    it('pushes the path onto the hash history', () => {
        const push = vi.spyOn(history, 'push').mockReturnValue(undefined as never);

        navigate({ kind: 'orders' });

        expect(push).toHaveBeenCalledWith('/orders');
        push.mockRestore();
    });
});
