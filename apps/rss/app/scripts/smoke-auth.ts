// Auth smoke: JWT exp helpers and concurrent-refresh request coalescing.
import { isTokenFresh, tokenExp } from '../src/services/auth';
import { assert } from './smoke-assert';

// ---- auth token helpers (login state without browser storage) ----
function fakeJwt(payload: Record<string, unknown>): string {
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    return `${b64({ alg: 'RS256' })}.${b64(payload)}.sig`;
}
const freshExp = Math.floor(Date.now() / 1000) + 600;
assert(tokenExp(fakeJwt({ exp: freshExp })) === freshExp, 'tokenExp reads exp from the JWT payload');
assert(tokenExp('not-a-jwt') === null, 'tokenExp is null for malformed tokens');
assert(isTokenFresh(freshExp) === true, 'isTokenFresh accepts a token with margin');
assert(
    isTokenFresh(Math.floor(Date.now() / 1000) + 30) === false,
    'isTokenFresh rejects tokens inside the refresh margin',
);

// Concurrent refreshes share one token request and keep the rotated pair.
{
    const store = new Map<string, string>();
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realLocation = shims['location'];
    const realLocalStorage = shims['localStorage'];
    shims['location'] = { origin: 'http://localhost', search: '', assign: () => {} };
    shims['localStorage'] = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
    };
    let calls = 0;
    shims['fetch'] = async () => {
        calls += 1;
        return new Response(
            JSON.stringify({
                access_token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 900 }),
                refresh_token: 'r-new',
                expires_in: 900,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
    };
    const { refreshTokens } = await import('../src/services/auth');
    store.set('rss.auth.tokens', JSON.stringify({ access: fakeJwt({ exp: 1 }), refresh: 'r-old', exp: 1 }));
    const [first, second] = await Promise.all([refreshTokens(), refreshTokens()]);
    assert(calls === 1, 'concurrent refreshTokens share one token request');
    assert(first?.refresh === 'r-new' && second?.refresh === 'r-new', 'concurrent refreshes resolve the rotated pair');
    assert(
        JSON.parse(store.get('rss.auth.tokens') as string).refresh === 'r-new',
        'rotated pair survives concurrent refresh',
    );
    shims['fetch'] = realFetch;
    shims['location'] = realLocation;
    shims['localStorage'] = realLocalStorage;
}
