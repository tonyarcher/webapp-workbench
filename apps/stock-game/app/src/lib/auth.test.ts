import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientMocks = vi.hoisted(() => ({
    authorizeUrl: vi.fn(() => 'https://identity.test/authorize?x=1'),
    challengeS256: vi.fn(async (verifier: string) => `challenge-${verifier}`),
    parseJwtPayload: vi.fn((token: string): Record<string, unknown> | null => ({ token })),
    randomVerifier: vi.fn(() => 'verifier-1'),
}));

vi.mock('user-client', () => clientMocks);

function memoryStorage(): Storage {
    const store = new Map<string, string>();
    return {
        getItem: (key: string): string | null => store.get(key) ?? null,
        setItem: (key: string, value: string): void => void store.set(key, value),
        removeItem: (key: string): void => void store.delete(key),
        clear: (): void => void store.clear(),
        key: (index: number): string | null => [...store.keys()][index] ?? null,
        get length(): number {
            return store.size;
        },
    } as Storage;
}

function installBrowserShims(): void {
    Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStorage(), configurable: true });
    Object.defineProperty(globalThis, 'location', {
        value: { origin: 'http://localhost:3000', search: '', assign: vi.fn() },
        configurable: true,
        writable: true,
    });
    Object.defineProperty(globalThis, 'history', {
        value: { replaceState: vi.fn() },
        configurable: true,
        writable: true,
    });
}

function setSearch(search: string): void {
    Object.defineProperty(globalThis, 'location', {
        value: { origin: 'http://localhost:3000', search, assign: vi.fn() },
        configurable: true,
        writable: true,
    });
}

function seedTokens(expOffsetSec = 900, refresh = 'r-old'): void {
    localStorage.setItem(
        'sg.auth.tokens',
        JSON.stringify({ access: 'access-1', refresh, exp: Math.floor(Date.now() / 1000) + expOffsetSec }),
    );
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function tokenBody(expiresIn = 900): unknown {
    return { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: expiresIn };
}

async function load() {
    return import('./auth');
}

beforeEach(() => {
    installBrowserShims();
    vi.resetModules();
    vi.restoreAllMocks();
    clientMocks.randomVerifier.mockReturnValue('verifier-1');
    clientMocks.authorizeUrl.mockReturnValue('https://identity.test/authorize?x=1');
    clientMocks.challengeS256.mockImplementation(async (v: string) => `challenge-${v}`);
    clientMocks.parseJwtPayload.mockImplementation((token: string) => ({ token }));
});

describe('isTokenFresh', () => {
    it('needs more than a minute of headroom, and refuses exactly sixty seconds', async () => {
        const { isTokenFresh } = await load();

        expect(isTokenFresh(1_000, 900)).toBe(true);
        expect(isTokenFresh(961, 900)).toBe(true);
        expect(isTokenFresh(960, 900)).toBe(false);
        expect(isTokenFresh(10, 900)).toBe(false);
    });

    it('defaults the clock to now', async () => {
        const { isTokenFresh } = await load();
        expect(isTokenFresh(Math.floor(Date.now() / 1000) + 61)).toBe(true);
    });
});

describe('hasSession', () => {
    it('is false with nothing, unparseable text, or the wrong field types', async () => {
        const { hasSession } = await load();
        expect(hasSession()).toBe(false);

        localStorage.setItem('sg.auth.tokens', 'not json');
        expect(hasSession()).toBe(false);

        localStorage.setItem('sg.auth.tokens', JSON.stringify({ access: 1, refresh: 'r', exp: 1 }));
        expect(hasSession()).toBe(false);

        localStorage.setItem('sg.auth.tokens', JSON.stringify({ access: 'a', refresh: 2, exp: 1 }));
        expect(hasSession()).toBe(false);

        localStorage.setItem('sg.auth.tokens', JSON.stringify({ access: 'a', refresh: 'r', exp: 'soon' }));
        expect(hasSession()).toBe(false);

        seedTokens();
        expect(hasSession()).toBe(true);
    });
});

describe('currentUsername', () => {
    it('reads preferred_username, or nothing', async () => {
        const { currentUsername } = await load();
        expect(currentUsername()).toBeNull();

        seedTokens();
        clientMocks.parseJwtPayload.mockReturnValue({ preferred_username: 'alice' });
        expect(currentUsername()).toBe('alice');

        clientMocks.parseJwtPayload.mockReturnValue({ sub: 'x' });
        expect(currentUsername()).toBeNull();

        clientMocks.parseJwtPayload.mockReturnValue(null);
        expect(currentUsername()).toBeNull();
    });
});

describe('startLogin', () => {
    it('stashes the verifier and state, then sends the browser to the authorize URL', async () => {
        const { startLogin } = await load();
        clientMocks.randomVerifier.mockReturnValueOnce('verifier-1').mockReturnValueOnce('state-1');

        await startLogin();

        expect(sessionStorage.getItem('sg.auth.verifier')).toBe('verifier-1');
        expect(sessionStorage.getItem('sg.auth.state')).toBe('state-1');
        expect(clientMocks.challengeS256).toHaveBeenCalledWith('verifier-1');
        expect(location.assign).toHaveBeenCalledWith('https://identity.test/authorize?x=1');
        expect(clientMocks.authorizeUrl).toHaveBeenCalledWith(
            expect.objectContaining({
                clientId: 'stock-game',
                challenge: 'challenge-verifier-1',
                state: 'state-1',
            }),
        );
    });
});

describe('finishLoginFromCallback', () => {
    it('refuses a reply with no code or no state', async () => {
        const { finishLoginFromCallback } = await load();

        setSearch('');
        expect(await finishLoginFromCallback()).toBe(false);

        setSearch('?code=abc');
        expect(await finishLoginFromCallback()).toBe(false);

        setSearch('?state=abc');
        expect(await finishLoginFromCallback()).toBe(false);
    });

    it('throws when the state does not match this browser', async () => {
        const { finishLoginFromCallback } = await load();
        sessionStorage.setItem('sg.auth.state', 'expected');
        sessionStorage.setItem('sg.auth.verifier', 'verifier-1');
        setSearch('?code=abc&state=different');

        await expect(finishLoginFromCallback()).rejects.toThrow(/did not match/i);
    });

    it('throws when the verifier was never stashed', async () => {
        const { finishLoginFromCallback } = await load();
        sessionStorage.setItem('sg.auth.state', 'abc');
        setSearch('?code=abc&state=abc');

        await expect(finishLoginFromCallback()).rejects.toThrow(/did not match/i);
    });

    it('clears the callback from the address bar on a matching reply', async () => {
        const { finishLoginFromCallback } = await load();
        sessionStorage.setItem('sg.auth.state', 'abc');
        sessionStorage.setItem('sg.auth.verifier', 'verifier-1');
        setSearch('?code=abc&state=abc');
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => jsonResponse(tokenBody())),
        );

        expect(await finishLoginFromCallback()).toBe(true);

        expect(history.replaceState).toHaveBeenCalled();
        expect(sessionStorage.getItem('sg.auth.state')).toBeNull();
        expect(sessionStorage.getItem('sg.auth.verifier')).toBeNull();
        expect(JSON.parse(localStorage.getItem('sg.auth.tokens') ?? '{}')).toMatchObject({
            access: 'new-access',
            refresh: 'new-refresh',
        });
    });

    it('throws when the token endpoint refuses', async () => {
        const { finishLoginFromCallback } = await load();
        sessionStorage.setItem('sg.auth.state', 'abc');
        sessionStorage.setItem('sg.auth.verifier', 'verifier-1');
        setSearch('?code=abc&state=abc');
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('nope', { status: 400 })),
        );

        await expect(finishLoginFromCallback()).rejects.toThrow(/refused/i);
        expect(localStorage.getItem('sg.auth.tokens')).toBeNull();
    });

    it.each([
        ['a body that is not an object', 'plain text'],
        ['null', null],
        ['no access token', { refresh_token: 'r', expires_in: 900 }],
        ['no refresh token', { access_token: 'a', expires_in: 900 }],
        ['a non-numeric expiry', { access_token: 'a', refresh_token: 'r', expires_in: '900' }],
    ])('refuses %s', async (_label, body) => {
        const { finishLoginFromCallback } = await load();
        sessionStorage.setItem('sg.auth.state', 'abc');
        sessionStorage.setItem('sg.auth.verifier', 'verifier-1');
        setSearch('?code=abc&state=abc');
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
        );

        await expect(finishLoginFromCallback()).rejects.toThrow(/refused/i);
    });
});

describe('getAccessToken', () => {
    it('is null with no session', async () => {
        const { getAccessToken } = await load();
        expect(await getAccessToken()).toBeNull();
    });

    it('returns a fresh token without calling the network', async () => {
        const { getAccessToken } = await load();
        seedTokens();
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        expect(await getAccessToken()).toBe('access-1');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refreshes a stale token', async () => {
        const { getAccessToken } = await load();
        seedTokens(-900);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => jsonResponse(tokenBody())),
        );

        expect(await getAccessToken()).toBe('new-access');
        expect(JSON.parse(localStorage.getItem('sg.auth.tokens') ?? '{}')).toMatchObject({
            refresh: 'new-refresh',
        });
    });

    it('is null when the refresh is refused', async () => {
        const { getAccessToken } = await load();
        seedTokens(-900);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('no', { status: 500 })),
        );

        expect(await getAccessToken()).toBeNull();
    });
});

describe('refreshTokens', () => {
    it('shares one in-flight refresh between callers', async () => {
        const { refreshTokens } = await load();
        seedTokens(-900);
        const fetchMock = vi.fn(async () => jsonResponse(tokenBody()));
        vi.stubGlobal('fetch', fetchMock);

        const [a, b] = await Promise.all([refreshTokens(), refreshTokens()]);

        expect(a).toEqual(b);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('is null with nothing to refresh', async () => {
        const { refreshTokens } = await load();
        expect(await refreshTokens()).toBeNull();
    });

    it('clears a dead refresh token, but leaves a rotated one alone', async () => {
        const { refreshTokens } = await load();
        seedTokens(-900, 'r-old');
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('no', { status: 401 })),
        );

        expect(await refreshTokens()).toBeNull();
        expect(localStorage.getItem('sg.auth.tokens')).toBeNull();
    });

    it('keeps tokens another caller already rotated', async () => {
        const { refreshTokens } = await load();
        seedTokens(-900, 'r-old');
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                localStorage.setItem(
                    'sg.auth.tokens',
                    JSON.stringify({ access: 'a2', refresh: 'r-new', exp: Math.floor(Date.now() / 1000) + 900 }),
                );
                return new Response('no', { status: 401 });
            }),
        );

        expect(await refreshTokens()).toBeNull();
        expect(JSON.parse(localStorage.getItem('sg.auth.tokens') ?? '{}')).toMatchObject({
            refresh: 'r-new',
        });
    });

    it('abandons a refresh that finishes after a logout', async () => {
        const { logout, refreshTokens } = await load();
        seedTokens(-900);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                logout();
                return jsonResponse(tokenBody());
            }),
        );

        expect(await refreshTokens()).toBeNull();
        expect(localStorage.getItem('sg.auth.tokens')).toBeNull();
    });
});

describe('logout', () => {
    it('drops the stored session', async () => {
        const { logout } = await load();
        seedTokens();
        logout();
        expect(localStorage.getItem('sg.auth.tokens')).toBeNull();
    });
});
