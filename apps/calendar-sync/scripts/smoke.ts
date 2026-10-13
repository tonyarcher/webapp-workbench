import {
    defaultSettings,
    loadSettings,
    parseSettings,
    readLegacyTraktSecrets,
    saveSettings,
    serializeSettings,
} from '../src/services/settings';
import { appConfig, parseAppConfig, resolveApiBase, resolveIdentityBase, setAppConfig } from '../src/services/config';
import { isTokenFresh, tokenExp } from '../src/services/auth';

function assert(cond: unknown, msg: string): void {
    if (!cond) throw new Error(`FAIL: ${msg}`);
}

// ---- settings: prefs only, secrets never persist ----
{
    const settings = defaultSettings();
    assert(settings.version === 1, 'default version');
    assert(settings.trakt.includeCalendar === true, 'default calendar on');
    assert(settings.google.writtenUids.length === 0, 'default no uids');
    assert(!('clientSecret' in settings.trakt), 'no secret field on shape');
    const round = parseSettings(serializeSettings(settings));
    assert(round !== null, 'round trip');
    assert(round?.trakt.includeHistory === true, 'round trip history');
}

{
    // Pre-vault browsers stored app credentials locally: prefs still parse,
    // and the secrets stay readable for the one-shot migration only.
    const legacy = parseSettings(
        '{"version":1,"trakt":{"clientId":"id","clientSecret":"sec","accessToken":"tok","includeCalendar":false}}',
    );
    assert(legacy?.trakt.includeCalendar === false, 'legacy prefs parse');
    assert(!('accessToken' in (legacy?.trakt ?? {})), 'legacy tokens dropped from shape');
    const round = parseSettings(serializeSettings(legacy!));
    assert(!('clientSecret' in (round?.trakt ?? {})), 're-save drops secrets');
}

assert(parseSettings(null) === null, 'empty settings');
assert(parseSettings('{') === null, 'corrupt json');
assert(parseSettings('{"version":2}') === null, 'wrong version');
assert(parseSettings('[]') === null, 'array rejected');

{
    const partial = parseSettings('{"version":1,"trakt":{}}');
    assert(partial?.trakt.includeCalendar === true, 'missing toggles default on');
    assert(partial?.google.clientId === '', 'missing google default');
}

// ---- legacy migration read ----
{
    const store = new Map<string, string>();
    const shims = globalThis as Record<string, unknown>;
    const realLocalStorage = shims['localStorage'];
    shims['localStorage'] = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
    };
    try {
        assert(readLegacyTraktSecrets() === null, 'no secrets when storage empty');
        store.set(
            'calendar-sync.settings.v1',
            '{"version":1,"trakt":{"clientId":"id","clientSecret":"sec","accessToken":"tok"}}',
        );
        const secrets = readLegacyTraktSecrets();
        assert(secrets?.clientId === 'id' && secrets?.clientSecret === 'sec', 'legacy secrets readable');
        // Saving the parsed shape drops the secrets from storage.
        saveSettings(loadSettings());
        const raw = store.get('calendar-sync.settings.v1') ?? '';
        assert(!raw.includes('clientSecret'), 'save strips secrets');
        assert(!raw.includes('accessToken'), 'save strips tokens');
        store.delete('calendar-sync.settings.v1');
        store.set('calendar-sync.settings.v1', '{"version":1,"trakt":{"clientId":"only-id"}}');
        assert(readLegacyTraktSecrets() === null, 'partial secrets do not migrate');
    } finally {
        shims['localStorage'] = realLocalStorage;
    }
}

// ---- config: runtime block parsing and base resolution ----
{
    assert(parseAppConfig(null).apiBase === '', 'missing block defaults');
    assert(parseAppConfig('{oops').apiBase === '', 'corrupt block defaults');
    assert(parseAppConfig('{"apiBase":42}').apiBase === '', 'wrong-typed block defaults');
    const parsed = parseAppConfig('{"apiBase":"https://api.example","identityBase":"https://id.example"}');
    assert(parsed.apiBase === 'https://api.example', 'block api base');
    assert(parsed.identityBase === 'https://id.example', 'block identity base');
    assert(resolveApiBase('https://cfg.example', undefined, '/') === 'https://cfg.example', 'config wins');
    assert(resolveApiBase('', 'https://vite.example', '/') === 'https://vite.example', 'vite second');
    assert(resolveApiBase('', undefined, '/calendar-sync/') === '/calendar-sync/api', 'same-origin gateway route');
    assert(resolveIdentityBase('', 'https://app.example') === 'https://app.example/user-api', 'identity default');
    assert(
        resolveIdentityBase('https://id.example', 'https://app.example') === 'https://id.example',
        'identity config',
    );
    setAppConfig(parsed);
    assert(appConfig().apiBase === 'https://api.example', 'config store round trip');
    setAppConfig({ apiBase: '', identityBase: '' });
}

// ---- auth helpers (login state without browser storage) ----
function fakeJwt(payload: Record<string, unknown>): string {
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    return `${b64({ alg: 'RS256' })}.${b64(payload)}.sig`;
}
{
    const freshExp = Math.floor(Date.now() / 1000) + 600;
    assert(tokenExp(fakeJwt({ exp: freshExp })) === freshExp, 'tokenExp reads exp');
    assert(tokenExp('not-a-jwt') === null, 'tokenExp null for malformed');
    assert(isTokenFresh(freshExp) === true, 'fresh token accepted');
    assert(isTokenFresh(Math.floor(Date.now() / 1000) + 30) === false, 'margin rejects near-expiry');
}

// ---- api client against stub fetch ----
{
    const store = new Map<string, string>();
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realLocalStorage = shims['localStorage'];
    const realWindow = shims['window'];
    const seen: { url: string; init?: RequestInit | undefined }[] = [];
    shims['localStorage'] = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
    };
    shims['window'] = { dispatchEvent: () => true };
    const freshExp = Math.floor(Date.now() / 1000) + 900;
    store.set(
        'calendar-sync.auth.tokens',
        JSON.stringify({ access: fakeJwt({ exp: freshExp }), refresh: 'r', exp: freshExp }),
    );
    const bodies: Record<string, unknown> = {
        '/trakt/credentials': { configured: true, authorized: true, expiresAt: 123 },
        '/trakt/device/code': {
            deviceCode: 'dc',
            userCode: 'UC-1',
            verificationUrl: 'https://trakt.tv/activate',
            expiresIn: 600,
            interval: 5,
        },
        '/trakt/device/token': { authorized: true, expiresAt: 456 },
        '/trakt/calendars/shows': [
            {
                first_aired: '2026-01-01T00:00:00.000Z',
                show: { title: 'S', ids: { trakt: 1 } },
                episode: { season: 1, number: 2, ids: { trakt: 2 } },
            },
        ],
        '/trakt/calendars/movies': [{ released: '2026-02-01', movie: { title: 'M', year: 2026, ids: { trakt: 3 } } }],
        '/trakt/history/shows': [
            {
                watched_at: '2026-03-01T00:00:00.000Z',
                show: { title: 'S', ids: { trakt: 1 } },
                episode: { season: 1, number: 1, ids: { trakt: 4 } },
            },
        ],
        '/trakt/history/movies': [],
    };
    shims['fetch'] = (async (url: string | URL | Request, init?: RequestInit) => {
        const key = String(url);
        seen.push({ url: key, init });
        for (const [path, body] of Object.entries(bodies)) {
            if (key.includes(path)) {
                return new Response(JSON.stringify(body), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    try {
        const api = await import('../src/services/api');
        const { fetchTraktEventsViaApi } = await import('../src/services/trakt-sync');
        await api.saveTraktCredentials('id', 'sec');
        const saved = seen.at(-1);
        assert(saved?.url.endsWith('/trakt/credentials') === true, 'credentials posted to vault');
        assert(String(saved?.init?.body).includes('"clientSecret":"sec"'), 'secret in vault body');
        assert((saved?.init?.headers as Record<string, string>)['X-Api-Version'] === '1', 'version header sent');
        const status = await api.traktStatus();
        assert(status.configured && status.authorized && status.expiresAt === 123, 'status maps');
        const code = await api.requestDeviceCode();
        assert(code.userCode === 'UC-1' && code.interval === 5, 'device code maps');
        assert((await api.pollDeviceToken('dc')) === true, 'poll true authorizes');
        const events = await fetchTraktEventsViaApi({ now: Date.parse('2026-06-01T00:00:00Z') });
        assert(events.length >= 3, `orchestration maps windows, got ${events.length}`);
        assert(
            events.some((e) => e.uid.includes(':air:show:')),
            'show mapped',
        );
        assert(
            events.some((e) => e.uid.includes(':air:movie:')),
            'movie mapped',
        );
        assert(
            events.some((e) => e.uid.includes(':watch:show:')),
            'history mapped',
        );
        assert(
            seen.some((s) => s.url.includes('/trakt/calendars/movies')),
            'movies window fetched',
        );
        assert(
            seen.some((s) => s.url.includes('/trakt/history/movies')),
            'history fetched',
        );
    } finally {
        shims['fetch'] = realFetch;
        shims['localStorage'] = realLocalStorage;
        shims['window'] = realWindow;
    }
}

// ---- device-flow terminal errors ----
{
    const { isTerminalDeviceError, pollDeviceUntil } = await import('../src/services/trakt-sync');
    assert(isTerminalDeviceError(new Error('Trakt access denied')) === true, 'denial is terminal');
    assert(isTerminalDeviceError(new Error('Trakt device code expired')) === true, 'expiry is terminal');
    assert(isTerminalDeviceError(new Error('boom')) === false, 'transient failure is not terminal');
    assert(isTerminalDeviceError('nope') === false, 'non-errors are not terminal');

    const now = { at: 1_000 };
    const instantSleep = async (): Promise<void> => {};
    assert(
        (await pollDeviceUntil({
            poll: () => Promise.resolve(true),
            intervalMs: 1_000,
            expiresAt: 9_000,
            now: () => now.at,
            sleepFn: instantSleep,
        })) === 'authorized',
        'first-try authorization',
    );
    let polls = 0;
    assert(
        (await pollDeviceUntil({
            poll: () => {
                polls += 1;
                return Promise.resolve(polls >= 3);
            },
            intervalMs: 1_000,
            expiresAt: 9_000,
            now: () => now.at,
            sleepFn: instantSleep,
        })) === 'authorized',
        'authorization after pending polls',
    );
    assert(polls === 3, 'pending polls do not count as failures');
    let flaky = 0;
    assert(
        (await pollDeviceUntil({
            poll: () => {
                flaky += 1;
                if (flaky < 3) return Promise.reject(new Error('boom'));
                return Promise.resolve(true);
            },
            intervalMs: 1_000,
            expiresAt: 99_000,
            now: () => now.at,
            sleepFn: instantSleep,
        })) === 'authorized',
        'transient failures retry',
    );
    assert(
        (await pollDeviceUntil({
            poll: () => Promise.reject(new Error('boom')),
            intervalMs: 1_000,
            expiresAt: 99_000,
            now: () => now.at,
            sleepFn: instantSleep,
        })) === 'unreachable',
        'persistent failures give up as unreachable',
    );
    assert(
        (await pollDeviceUntil({
            poll: () => Promise.resolve(false),
            intervalMs: 1_000,
            expiresAt: 1_000,
            now: () => now.at,
            sleepFn: instantSleep,
        })) === 'expired',
        'past expiry without authorization',
    );
    let terminal = '';
    try {
        await pollDeviceUntil({
            poll: () => Promise.reject(new Error('Trakt access denied')),
            intervalMs: 1_000,
            expiresAt: 99_000,
            now: () => now.at,
            sleepFn: instantSleep,
        });
    } catch (err) {
        terminal = err instanceof Error ? err.message : '';
    }
    assert(terminal === 'Trakt access denied', 'terminal rejection propagates');
    const aborter = new AbortController();
    aborter.abort();
    let aborted = '';
    try {
        await pollDeviceUntil({
            poll: () => Promise.resolve(true),
            intervalMs: 1_000,
            expiresAt: 99_000,
            now: () => now.at,
            sleepFn: instantSleep,
            signal: aborter.signal,
        });
    } catch (err) {
        aborted = err instanceof Error ? err.name : '';
    }
    assert(aborted === 'AbortError', 'abort during poll wins over authorization');
    const aborter2 = new AbortController();
    aborter2.abort();
    let abortedFailing = '';
    try {
        await pollDeviceUntil({
            poll: () => Promise.reject(new Error('boom')),
            intervalMs: 1_000,
            expiresAt: 99_000,
            now: () => now.at,
            sleepFn: instantSleep,
            signal: aborter2.signal,
        });
    } catch (err) {
        abortedFailing = err instanceof Error ? err.name : '';
    }
    assert(abortedFailing === 'AbortError', 'abort during failing polls wins over unreachable');
    const aborter3 = new AbortController();
    aborter3.abort();
    let abortedExpired = '';
    try {
        await pollDeviceUntil({
            poll: () => Promise.resolve(false),
            intervalMs: 1_000,
            expiresAt: 1_000,
            now: () => now.at,
            sleepFn: instantSleep,
            signal: aborter3.signal,
        });
    } catch (err) {
        abortedExpired = err instanceof Error ? err.name : '';
    }
    assert(abortedExpired === 'AbortError', 'abort at expiry wins over expired');
    const aborter4 = new AbortController();
    aborter4.abort();
    let abortedTerminal = '';
    try {
        await pollDeviceUntil({
            poll: () => Promise.reject(new Error('Trakt access denied')),
            intervalMs: 1_000,
            expiresAt: 99_000,
            now: () => now.at,
            sleepFn: instantSleep,
            signal: aborter4.signal,
        });
    } catch (err) {
        abortedTerminal = err instanceof Error ? err.name : '';
    }
    assert(abortedTerminal === 'AbortError', 'abort wins over a racing terminal rejection');
}

console.log('smoke.ts: all assertions passed');

export {};
