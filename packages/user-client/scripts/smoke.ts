import {
    API_VERSION,
    API_VERSION_HEADER,
    authorizeUrl,
    challengeS256,
    CSRF_HEADER,
    endSession,
    fetchCsrfToken,
    parseJwtPayload,
    randomVerifier,
    type SessionClient,
} from '../src/index.ts';
import { sha256Bytes } from '../src/sha256.ts';

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`ok: ${msg}`);
}

const verifier = randomVerifier();
assert(verifier.length === 64, 'verifier length');
const challenge = await challengeS256(verifier);
assert(challenge.length > 20, 's256 challenge');
assert(challenge !== (await challengeS256(verifier + 'x')), 'challenge changes');
const url = authorizeUrl({
    authorizeEndpoint: '/user-api/oauth/authorize',
    clientId: 'fitness',
    redirectUri: 'http://localhost/fitness/',
    challenge,
    state: 'abc',
});
assert(url.includes('code_challenge_method=S256'), 'authorize S256');
assert(url.includes('client_id=fitness'), 'authorize client');
assert(parseJwtPayload('not-a-jwt') === null, 'reject junk jwt');
const payload = btoa(JSON.stringify({ sub: '1' })).replace(/=+$/g, '');
assert(parseJwtPayload(`aaa.${payload}.bbb`)?.['sub'] === '1', 'parse jwt payload');

function hex(bytes: Uint8Array): string {
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const enc = new TextEncoder();
assert(
    hex(sha256Bytes(enc.encode(''))) === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'sha256 empty vector',
);
assert(
    hex(sha256Bytes(enc.encode('abc'))) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    'sha256 abc vector',
);
for (const input of ['abcdbcdecdefdefgefghfghighijhijk', 'x'.repeat(200)]) {
    const data = enc.encode(input);
    const ref = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    assert(hex(sha256Bytes(data)) === hex(ref), `sha256 matches WebCrypto for ${data.length} bytes`);
}
assert(
    (await challengeS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')) ===
        'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    'challenge matches RFC 7636 vector',
);
{
    // Plain-HTTP origins have no WebCrypto: pin the fallback to WebCrypto output.
    const expected = await challengeS256(verifier);
    Object.defineProperty(globalThis.crypto, 'subtle', { value: undefined, configurable: true });
    try {
        assert((await challengeS256(verifier)) === expected, 'fallback challenge matches WebCrypto');
    } finally {
        delete (globalThis.crypto as unknown as Record<string, unknown>)['subtle'];
    }
}
// ---- session end ----
// The bug these cover: a client that only drops its own OAuth tokens is not
// signed out. user-api keeps a wb_session cookie, /oauth/authorize honours it,
// and the next sign-in is waved straight through with no credentials prompt.
{
    type Call = { url: string; init: RequestInit | undefined };
    const calls: Call[] = [];
    const json = (body: unknown, ok = true): Response => ({ ok, json: async () => body }) as unknown as Response;
    const recorder =
        (reply: (url: string) => Response) =>
        async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const url = String(input);
            calls.push({ url, init });
            return reply(url);
        };
    // Built by spread so an omitted reader stays absent rather than explicitly
    // undefined, which exactOptionalPropertyTypes rejects.
    const client = (fetch: typeof globalThis.fetch, readCookie?: (n: string) => string | undefined): SessionClient =>
        readCookie ? { base: '/user-api', fetch, readCookie } : { base: '/user-api', fetch };

    calls.length = 0;
    assert(
        (await endSession(
            client(
                recorder((url) => (url.endsWith('/logout') ? json({ ok: true }) : json({ csrf: 'tok' }))),
                () => 'cookie-token',
            ),
        )) === true,
        'endSession posts logout and reports success',
    );
    assert(calls.length === 1, 'a cookie-held token needs no csrf round trip');
    assert(calls[0]?.url === '/user-api/logout', 'logout goes to the identity base');
    assert(calls[0]?.init?.method === 'POST', 'logout is a POST');
    assert((calls[0]?.init?.credentials ?? 'same-origin') === 'include', 'logout sends the session cookie');

    calls.length = 0;
    assert(
        (await endSession(
            client(
                recorder((url) => (url.endsWith('/logout') ? json({ ok: true }) : json({ csrf: 'fresh' }))),
                () => undefined,
            ),
        )) === true,
        'falls back to the csrf body when no cookie is held',
    );
    assert(calls.length === 2, 'no cookie means one csrf fetch then the logout post');
    assert(
        new Headers(calls[1]?.init?.headers).get(CSRF_HEADER) === 'fresh',
        'the fetched token is echoed in the csrf header',
    );

    calls.length = 0;
    assert(
        (await endSession(
            client(
                recorder((url) => (url.endsWith('/logout') ? json({ ok: true }) : json({ csrf: 'held' }))),
                () => 'held',
            ),
        )) === true,
        'the cookie value is preferred over a refetch',
    );
    assert(new Headers(calls[0]?.init?.headers).get(CSRF_HEADER) === 'held', 'cookie token wins');

    calls.length = 0;
    assert(
        (await endSession(
            client(recorder((url) => (url.endsWith('/logout') ? json({}, false) : json({ csrf: 't' })))),
        )) === false,
        'a rejected logout reports false rather than success',
    );

    // No document and no cookie reader yields no token, so nothing is attempted.
    calls.length = 0;
    assert(
        (await endSession(client(recorder(() => json({ error: 'offline' }, false))))) === false,
        'no csrf token means no logout attempt and a false result',
    );
    assert(
        calls.every((c) => !c.url.endsWith('/logout')),
        'no token means logout is never posted',
    );

    // The version header is what stops a 404 reading as a working route. A stub
    // that ignores headers would pass even with it missing, so this one enforces
    // it the way the real mappings do.
    const versioned =
        (reply: (url: string) => Response) =>
        async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const url = String(input);
            calls.push({ url, init });
            const headers = new Headers(init?.headers);
            if (headers.get(API_VERSION_HEADER) !== API_VERSION) {
                // A missing or wrong version answers 404, like an unknown route.
                return json({}, false);
            }
            return reply(url);
        };
    calls.length = 0;
    assert(
        (await endSession(
            client(
                versioned(() => json({ ok: true })),
                () => 'tok',
            ),
        )) === true,
        'a logout carrying the api version header succeeds',
    );
    calls.length = 0;
    assert(
        (await endSession(client(versioned(() => json({ ok: true }))))) === false,
        'a missing api version header is rejected rather than treated as working',
    );

    // A network failure must not reject: the caller clears local state after
    // awaiting this, and skipping that cleanup offline is the worst outcome.
    const boom = async (): Promise<Response> => {
        throw new TypeError('Failed to fetch');
    };
    assert((await endSession(client(boom, () => 'tok'))) === false, 'a thrown fetch yields false, not a rejection');
    assert((await fetchCsrfToken(client(boom))) === null, 'a thrown csrf fetch yields null, not a rejection');
    const htmlPage = async (): Promise<Response> =>
        ({
            ok: true,
            json: async () => {
                throw new SyntaxError('Unexpected token <');
            },
        }) as unknown as Response;
    assert((await fetchCsrfToken(client(htmlPage))) === null, 'a non-JSON csrf body yields null');
    assert(
        (await fetchCsrfToken(client(recorder(() => json({ csrf: '' }))))) === null,
        'an empty csrf token is not a token',
    );
    assert(
        (await fetchCsrfToken(client(recorder(() => json({ csrf: 7 }))))) === null,
        'a non-string csrf token is rejected',
    );
}
console.log('user-client smoke ok');
