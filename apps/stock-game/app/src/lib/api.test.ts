import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  AuthError,
  cancelOrder,
  fetchBars,
  fetchCash,
  fetchConfig,
  fetchHoldings,
  fetchPortfolioSeries,
  fetchQuote,
  listOrders,
  listTrades,
  placeOrder,
  placeTrade,
  saveConfig,
  searchSymbols,
} from './api';
import {finishLoginFromCallback} from './auth';

function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${b64({alg: 'RS256'})}.${b64(payload)}.sig`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

function seedTokens(refresh = 'r-old', expOffsetSec = 900): void {
  const tokens = {
    access: fakeJwt({exp: Math.floor(Date.now() / 1000) + expOffsetSec, preferred_username: 'alice'}),
    refresh,
    exp: Math.floor(Date.now() / 1000) + expOffsetSec,
  };
  localStorage.setItem('sg.auth.tokens', JSON.stringify(tokens));
}

function installBrowserShims(): void {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => void store.set(key, value),
    removeItem: (key: string): void => void store.delete(key),
    clear: (): void => store.clear(),
    key: (index: number): string | null => [...store.keys()][index] ?? null,
    get length(): number {
      return store.size;
    },
  };
  const nullStorage = {
    getItem: (): null => null,
    setItem: (): void => {},
    removeItem: (): void => {},
    clear: (): void => {},
    key: (): null => null,
    get length(): number {
      return 0;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {value: storage, configurable: true});
  Object.defineProperty(globalThis, 'sessionStorage', {value: nullStorage, configurable: true});
  Object.defineProperty(globalThis, 'location', {
    value: {origin: 'http://localhost:3000', search: '', assign: vi.fn()},
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'history', {
    value: {replaceState: vi.fn()},
    configurable: true,
    writable: true,
  });
}

function stubWindowEvents(events: string[]): void {
  Object.defineProperty(globalThis, 'window', {
    value: {
      dispatchEvent: (e: Event): boolean => {
        events.push(e.type);
        return true;
      },
      addEventListener: (): void => {},
      removeEventListener: (): void => {},
    },
    configurable: true,
  });
}

describe('api client', () => {
  beforeEach(() => {
    installBrowserShims();
    vi.restoreAllMocks();
  });

  it('attaches a Bearer token and parses a quoteless quote', async () => {
    seedTokens();
    const seen: Array<string | undefined> = [];
    vi.stubGlobal('fetch', async (url: unknown, init?: {headers?: Record<string, string>}) => {
      seen.push(init?.headers?.['Authorization']);
      expect(`${url}`).toContain('/quote?symbol=aapl');
      return jsonResponse({symbol: 'AAPL', name: 'Apple', price: 90, currency: 'USD', exchange: 'T', time: 0});
    });
    const quote = await fetchQuote('aapl');
    expect(quote.price).toBe(90);
    expect(quote.bid).toBeUndefined();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.startsWith('Bearer ')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('parses orders with missing optional keys', async () => {
    seedTokens();
    vi.stubGlobal('fetch', async () =>
      jsonResponse([
        {id: 1, symbol: 'AAPL', side: 'buy', qty: 2, executeAt: 9, status: 'pending', createdAt: 8, orderType: 'market', tif: 'GTC', fillPriceSource: 'last'},
      ]),
    );
    const orders = await listOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0]?.limitPrice).toBeUndefined();
    expect(orders[0]?.tradeId).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('retries once when a fresh token gets a 401', async () => {
    seedTokens();
    let apiCalls = 0;
    let tokenCalls = 0;
    vi.stubGlobal('fetch', async (url: unknown) => {
      if (`${url}`.endsWith('/oauth/token')) {
        tokenCalls += 1;
        return jsonResponse({
          access_token: fakeJwt({exp: Math.floor(Date.now() / 1000) + 900}),
          refresh_token: 'r-new',
          expires_in: 900,
        });
      }
      apiCalls += 1;
      if (apiCalls === 1) return new Response('x', {status: 401});
      return jsonResponse({cashCents: 42});
    });
    expect(await fetchCash()).toBe(42);
    expect(tokenCalls).toBe(1);
    expect(apiCalls).toBe(2);
    vi.unstubAllGlobals();
  });

  it('emits auth-required and throws AuthError when refresh fails', async () => {
    seedTokens();
    const events: string[] = [];
    stubWindowEvents(events);
    vi.stubGlobal('fetch', async (url: unknown) => {
      if (`${url}`.endsWith('/oauth/token')) return new Response('x', {status: 400});
      return new Response('x', {status: 401});
    });
    await expect(fetchCash()).rejects.toBeInstanceOf(AuthError);
    expect(events).toContain('sg-auth-required');
    vi.unstubAllGlobals();
  });

  it('maps the error envelope', async () => {
    seedTokens();
    vi.stubGlobal('fetch', async () =>
      jsonResponse({error: 'Scheduled execution time must be in the future'}, 400),
    );
    await expect(
      placeOrder({symbol: 'AAPL', side: 'buy', qty: 1, executeAt: 1}),
    ).rejects.toThrow('Scheduled execution time must be in the future');
    vi.unstubAllGlobals();
  });

  it('returns false with no callback params', async () => {
    expect(await finishLoginFromCallback()).toBe(false);
  });

  it('rejects a mismatched callback state', async () => {
    Object.defineProperty(globalThis, 'location', {
      value: {origin: 'http://localhost:3000', search: '?code=c&state=wrong', assign: vi.fn()},
      configurable: true,
      writable: true,
    });
    await expect(finishLoginFromCallback()).rejects.toThrow('did not match');
  });

  it('covers the remaining endpoints', async () => {
    seedTokens();
    vi.stubGlobal('fetch', async (url: unknown, init?: {method?: string}) => {
      const path = `${url}`;
      if (path.endsWith('/config') && init?.method === 'PUT') {
        return jsonResponse({startingCashCents: 1, startDate: 2, provider: 'yahoo', quoteDelayMinutes: 15, commissionCentsPerTrade: 0});
      }
      if (path.endsWith('/config')) {
        return jsonResponse({startingCashCents: 1, startDate: 2, provider: 'yahoo', quoteDelayMinutes: 15, commissionCentsPerTrade: 0});
      }
      if (path.endsWith('/trades') && init?.method === 'POST') {
        return jsonResponse({id: 1, symbol: 'AAPL', side: 'buy', qty: 1, price: 2, cashDeltaCents: -200, mode: 'backdated', executedAt: 3, createdAt: 4});
      }
      if (path.endsWith('/trades')) return jsonResponse([]);
      if (path.endsWith('/cancel')) return jsonResponse({ok: true});
      if (path.endsWith('/holdings')) return jsonResponse([]);
      if (path.endsWith('/portfolio')) {
        return jsonResponse({startingCashCents: 1, startDate: 2, endDate: 3, totalReturnPct: 0, points: [], totalGainCents: 0});
      }
      if (path.includes('/search')) return jsonResponse([]);
      throw new Error(`unexpected ${path}`);
    });
    expect((await fetchConfig()).provider).toBe('yahoo');
    expect(
      (await saveConfig({startingCashCents: 1, startDate: 2})).startingCashCents,
    ).toBe(1);
    expect(await listTrades()).toEqual([]);
    expect((await placeTrade({symbol: 'AAPL', side: 'buy', qty: 1, at: 2})).id).toBe(1);
    expect((await cancelOrder(7)).ok).toBe(true);
    expect(await fetchHoldings()).toEqual([]);
    expect((await fetchPortfolioSeries()).points).toEqual([]);
    expect(await searchSymbols('app')).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('fetches bars', async () => {
    seedTokens();
    vi.stubGlobal('fetch', async (url: unknown) => {
      expect(`${url}`).toContain('/bars?');
      return jsonResponse([{time: 1, open: 2, high: 3, low: 1, close: 2, volume: 10}]);
    });
    const bars = await fetchBars('AAPL', '1d', 0, 9);
    expect(bars).toHaveLength(1);
    expect(bars[0]?.close).toBe(2);
    vi.unstubAllGlobals();
  });
});
